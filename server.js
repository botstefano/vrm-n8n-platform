import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3001);
const FRONTEND_ORIGINS = (process.env.VRM_FRONTEND_URL || '').split(',').map((value) => value.trim()).filter(Boolean);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const supabase = SUPABASE_URL && SUPABASE_SECRET_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    })
  : null;

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || FRONTEND_ORIGINS.includes(origin) || /^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?$/.test(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  let database = 'not_configured';
  if (supabase) {
    const { error } = await supabase.from('roles').select('id', { head: true, count: 'exact' });
    database = error ? 'unavailable' : 'connected';
  }
  res.status(200).json({
    status: 'ok',
    database,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

function requireDatabase(_req, res, next) {
  if (!supabase) return res.status(503).json({ error: 'Backend sin configurar: faltan SUPABASE_URL y SUPABASE_SECRET_KEY.' });
  next();
}

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Autenticación requerida.' });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Sesión inválida o expirada.' });

    const { data: profile, error: profileError } = await supabase
      .from('users').select('id,email,full_name,is_active').eq('id', data.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || !profile.is_active) return res.status(403).json({ error: 'Usuario no habilitado en VRM.' });

    const { data: memberships, error: roleError } = await supabase
      .from('user_roles').select('roles(code,name)').eq('user_id', data.user.id);
    if (roleError) throw roleError;
    const roles = (memberships || []).map((item) => item.roles?.code).filter(Boolean);
    if (!roles.length) return res.status(403).json({ error: 'El usuario no tiene un rol asignado en VRM.' });

    req.user = { id: data.user.id, email: profile.email, full_name: profile.full_name, roles };
    next();
  } catch (error) {
    next(error);
  }
}

function allowRoles(...allowed) {
  return (req, res, next) => {
    if (req.user?.roles?.some((role) => allowed.includes(role))) return next();
    return res.status(403).json({ error: 'No tienes permisos para realizar esta operación.' });
  };
}

async function writeAudit(req, action, entity, entityId, details = {}) {
  const { error } = await supabase.from('audit_log').insert({
    actor: req.user?.email || 'system',
    action,
    entity,
    entity_id: String(entityId ?? ''),
    details
  });
  if (error) console.error('No se pudo registrar auditoría:', error.message);
}

async function recalculateVendorScore(vendorId) {
  const [{ data: vendor, error: vendorError }, { data: findings, error: findingsError }, { data: assessments, error: assessmentsError }] = await Promise.all([
    supabase.from('vendors').select('*').eq('id', vendorId).single(),
    supabase.from('vendor_findings').select('severity,status').eq('vendor_id', vendorId),
    supabase.from('assessments').select('status').eq('vendor_id', vendorId)
  ]);
  if (vendorError) throw vendorError;
  if (findingsError) throw findingsError;
  if (assessmentsError) throw assessmentsError;

  const multiplier = 0.7 + Number(vendor.criticality || 3) * 0.12;
  const deductions = { critical: 22, high: 12, medium: 5, low: 2, info: 0 };
  let score = 100;
  for (const finding of findings || []) {
    if (finding.status === 'closed') continue;
    let deduction = deductions[finding.severity] || 0;
    if (finding.status === 'in_progress') deduction *= 0.6;
    if (finding.status === 'accepted') deduction *= 0.4;
    score -= deduction * multiplier;
  }
  if (vendor.next_evaluation && new Date(vendor.next_evaluation) < new Date()) score -= 5;
  if ((assessments || []).some((a) => ['pending', 'in_progress'].includes(a.status)) && vendor.status === 'reevaluation') score -= 3;
  score = Math.max(0, Math.min(100, Math.round(score * 10) / 10));

  let risk = 'low';
  if (score < 45) risk = 'critical';
  else if (score < 65) risk = 'high';
  else if (score < 80) risk = 'medium';
  else if (score >= 92 && Number(vendor.criticality) <= 3) risk = 'minimal';

  const { error: updateError } = await supabase.from('vendors').update({ current_score: score, current_risk: risk }).eq('id', vendorId);
  if (updateError) throw updateError;
  const { error: historyError } = await supabase.from('score_history').insert({ vendor_id: vendorId, score, risk });
  if (historyError) throw historyError;
  return { score, risk };
}

async function dispatchAlertRecord(payload, reqUser = null) {
  const severity = ['critical', 'high', 'medium', 'low', 'info'].includes(payload.severity) ? payload.severity : 'medium';
  const route = ['critical', 'high'].includes(severity) ? 'slack+email' : 'slack';
  const fingerprint = payload.fingerprint || [
    payload.source || 'unknown',
    payload.source_ref || payload.title || 'untitled',
    payload.vendor_id || '',
    severity
  ].join(':');
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: duplicate, error: duplicateError } = await supabase
    .from('alert_notifications').select('id').eq('fingerprint', fingerprint).gt('created_at', cutoff).limit(1);
  if (duplicateError) throw duplicateError;
  const deduped = (duplicate || []).length > 0;
  const row = {
    vendor_id: payload.vendor_id || null,
    severity,
    route,
    title: String(payload.title || 'Alerta VRM').slice(0, 300),
    fingerprint,
    source: payload.source || null,
    source_ref: payload.source_ref || null,
    description: payload.description || null,
    delivery_status: deduped ? 'deduped' : 'pending'
  };
  const { data, error } = await supabase.from('alert_notifications').insert(row).select().single();
  if (error) throw error;
  if (!deduped && process.env.N8N_BASE_URL && process.env.ALERTS_WEBHOOK_TOKEN) {
    try {
      const response = await fetch(process.env.N8N_BASE_URL.replace(/\/$/, '') + '/webhook/vrm-alerts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Alert-Token': process.env.ALERTS_WEBHOOK_TOKEN },
        body: JSON.stringify({ ...payload, severity, fingerprint })
      });
      await supabase.from('alert_notifications').update({
        delivery_status: response.ok ? 'sent' : 'failed',
        delivery_meta: { http_status: response.status }
      }).eq('id', data.id);
    } catch (error) {
      await supabase.from('alert_notifications').update({
        delivery_status: 'failed',
        delivery_meta: { error: String(error.message || error) }
      }).eq('id', data.id);
    }
  }
  return { ...data, status: data.delivery_status, timestamp: data.created_at, vendor_name: null, email_subject: null, email_html: null, slack_text: null };
}

app.use('/api', requireDatabase, authenticate);

app.get('/api/bootstrap', async (req, res, next) => {
  try {
    const { data: activeQuestionnaires, error: questionnaireError } = await supabase
      .from('questionnaires').select('id').eq('is_active', true).limit(1);
    if (questionnaireError) throw questionnaireError;
    if (!activeQuestionnaires?.length) {
      const definition = { sections: [
        { id: 'governance', title: 'Gobernanza y Políticas de Seguridad', questions: [
          { id: 'q1-1', text: '¿Cuenta la organización con una certificación SOC 2 Tipo II o ISO 27001 vigente?', weight: 25 },
          { id: 'q1-2', text: '¿Se revisan las políticas de seguridad al menos anualmente?', weight: 15 }
        ]},
        { id: 'access', title: 'Cifrado y Gestión de Accesos', questions: [
          { id: 'q2-1', text: '¿Se exige MFA en todos los accesos administrativos?', weight: 25 },
          { id: 'q2-2', text: '¿Los datos se cifran en tránsito y en reposo?', weight: 20 },
          { id: 'q2-3', text: '¿Existe rotación automatizada de credenciales y secretos de API?', weight: 15 }
        ]}
      ]};
      const { error } = await supabase.from('questionnaires').insert({
        name: 'Cuestionario de seguridad estándar (ISO 27001 / SOC 2)', version: 1, is_active: true, definition
      });
      if (error) throw error;
    }
    const tables = [
      'vendors','vendor_technologies','questionnaires','assessments','vendor_findings',
      'monitoring_jobs','users','roles','user_roles','audit_log','audit_log_archive',
      'score_history','alert_notifications','workflow_execution_logs'
    ];
    const results = await Promise.all(tables.map(async (table) => {
      const { data, error } = await supabase.from(table).select('*').order(
        table === 'vendors' ? 'created_at' :
        table === 'vendor_findings' ? 'detected_at' :
        table === 'audit_log' || table === 'audit_log_archive' ? 'created_at' :
        table === 'score_history' ? 'calculated_at' :
        table === 'alert_notifications' ? 'created_at' :
        table === 'workflow_execution_logs' ? 'started_at' : 'id',
        { ascending: false }
      );
      if (error) throw error;
      return [table, data || []];
    }));
    const rows = Object.fromEntries(results);
    const roleMap = new Map();
    for (const membership of rows.user_roles) {
      const role = rows.roles.find((item) => item.id === membership.role_id);
      if (!role) continue;
      roleMap.set(membership.user_id, [...(roleMap.get(membership.user_id) || []), role.code]);
    }
    const payload = {
      user: { ...req.user, roles: roleMap.get(req.user.id) || req.user.roles },
      vendors: rows.vendors,
      technologies: rows.vendor_technologies,
      questionnaires: rows.questionnaires.map((q) => ({ ...q, sections: q.definition?.sections || [] })),
      assessments: rows.assessments,
      findings: rows.vendor_findings,
      monitoringJobs: rows.monitoring_jobs,
      users: rows.users.map((u) => ({ ...u, roles: roleMap.get(u.id) || [] })),
      auditLog: rows.audit_log,
      auditArchive: rows.audit_log_archive,
      scoreHistory: rows.score_history,
      alerts: rows.alert_notifications.map((a) => ({
        ...a, timestamp: a.created_at, status: a.delivery_status,
        vendor_name: rows.vendors.find((v) => v.id === a.vendor_id)?.legal_name
      })),
      workflowLogs: rows.workflow_execution_logs.map((log) => ({
        id: log.id, workflowId: log.workflow_code, workflowName: log.workflow_name,
        startedAt: log.started_at, completedAt: log.completed_at, status: log.status,
        summary: log.summary, steps: log.details?.steps || []
      }))
    };
    res.json(payload);
  } catch (error) { next(error); }
});

app.post('/api/vendors', allowRoles('admin','risk_analyst'), async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!String(body.legal_name || '').trim()) return res.status(400).json({ error: 'legal_name es obligatorio.' });
    const { data, error } = await supabase.from('vendors').insert({
      ...(body.id ? { id: body.id } : {}),
      legal_name: String(body.legal_name).trim(),
      website: body.website || null,
      status: body.status || 'onboarding',
      criticality: Math.min(5, Math.max(1, Number(body.criticality || 3))),
      current_risk: body.current_risk || 'low',
      current_score: Number.isFinite(Number(body.current_score)) ? Number(body.current_score) : 100,
      next_evaluation: body.next_evaluation || null,
      primary_contact: body.primary_contact || {}
    }).select().single();
    if (error) throw error;
    await writeAudit(req, 'insert_vendor', 'vendors', data.id, { legal_name: data.legal_name });
    res.status(201).json(data);
  } catch (error) { next(error); }
});

app.patch('/api/vendors/:id', allowRoles('admin','risk_analyst'), async (req, res, next) => {
  try {
    const allowed = ['legal_name','website','status','criticality','current_risk','current_score','next_evaluation','primary_contact'];
    const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
    const { data, error } = await supabase.from('vendors').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    await writeAudit(req, 'update_vendor', 'vendors', data.id, updates);
    res.json(data);
  } catch (error) { next(error); }
});

app.delete('/api/vendors/:id', allowRoles('admin'), async (req, res, next) => {
  try {
    const { error } = await supabase.from('vendors').delete().eq('id', req.params.id);
    if (error) throw error;
    await writeAudit(req, 'delete_vendor', 'vendors', req.params.id, {});
    res.status(204).end();
  } catch (error) { next(error); }
});

app.post('/api/technologies', allowRoles('admin','risk_analyst'), async (req, res, next) => {
  try {
    const { vendor_id, product_name, cpe_match, is_active = true } = req.body || {};
    if (!vendor_id || !cpe_match) return res.status(400).json({ error: 'vendor_id y cpe_match son obligatorios.' });
    const { data, error } = await supabase.from('vendor_technologies')
      .insert({ ...(req.body?.id ? { id: req.body.id } : {}), vendor_id, product_name: product_name || null, cpe_match, is_active }).select().single();
    if (error) throw error;
    await writeAudit(req, 'insert_technology', 'vendor_technologies', data.id, { product_name, cpe_match });
    res.status(201).json(data);
  } catch (error) { next(error); }
});

app.delete('/api/technologies/:id', allowRoles('admin','risk_analyst'), async (req, res, next) => {
  try {
    const { error } = await supabase.from('vendor_technologies').delete().eq('id', req.params.id);
    if (error) throw error;
    await writeAudit(req, 'delete_technology', 'vendor_technologies', req.params.id, {});
    res.status(204).end();
  } catch (error) { next(error); }
});

app.post('/api/findings', allowRoles('admin','risk_analyst'), async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.vendor_id || !body.source || !body.source_ref || !body.title || !body.severity) {
      return res.status(400).json({ error: 'vendor_id, source, source_ref, title y severity son obligatorios.' });
    }
    const { data, error } = await supabase.from('vendor_findings').insert({
      ...(body.id ? { id: body.id } : {}),
      vendor_id: body.vendor_id, source: body.source, source_ref: body.source_ref,
      title: body.title, description: body.description || null, severity: body.severity,
      status: body.status || 'open', evidence: body.evidence || {}, due_date: body.due_date || null
    }).select().single();
    if (error?.code === '23505') return res.status(409).json({ error: 'El hallazgo ya existe para ese proveedor, fuente y referencia.' });
    if (error) throw error;
    await writeAudit(req, 'insert_finding', 'vendor_findings', data.id, { title: data.title, severity: data.severity });
    await recalculateVendorScore(data.vendor_id);
    res.status(201).json(data);
  } catch (error) { next(error); }
});

app.patch('/api/findings/:id', allowRoles('admin','risk_analyst'), async (req, res, next) => {
  try {
    const allowed = ['status','resolution','due_date'];
    const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
    if (updates.status === 'closed') updates.closed_at = new Date().toISOString();
    const { data, error } = await supabase.from('vendor_findings').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    await writeAudit(req, 'update_finding_status', 'vendor_findings', data.id, updates);
    await recalculateVendorScore(data.vendor_id);
    res.json(data);
  } catch (error) { next(error); }
});

app.post('/api/scorecards/recalculate/:vendorId', allowRoles('admin','risk_analyst','auditor'), async (req, res, next) => {
  try { res.json(await recalculateVendorScore(req.params.vendorId)); }
  catch (error) { next(error); }
});

app.post('/api/scorecards/recalculate-all', allowRoles('admin','risk_analyst'), async (_req, res, next) => {
  try {
    const { data: vendors, error } = await supabase.from('vendors')
      .select('id').in('status', ['approved','conditional','monitoring','incident','reevaluation']);
    if (error) throw error;
    const results = [];
    for (const vendor of vendors || []) results.push({ vendor_id: vendor.id, ...(await recalculateVendorScore(vendor.id)) });
    res.json({ refreshed: results.length, results });
  } catch (error) { next(error); }
});

app.post('/api/assessments/reevaluate', allowRoles('admin','risk_analyst'), async (req, res, next) => {
  try {
    const { data: dueVendors, error } = await supabase.from('vendors').select('*')
      .in('status', ['approved','conditional','monitoring'])
      .or(`next_evaluation.is.null,next_evaluation.lte.${new Date().toISOString()}`);
    if (error) throw error;
    const { data: questionnaires, error: qError } = await supabase.from('questionnaires')
      .select('*').eq('is_active', true).order('version', { ascending: false }).limit(1);
    if (qError) throw qError;
    if (!questionnaires?.length) return res.status(409).json({ error: 'No hay un cuestionario activo. Crea uno antes de programar reevaluaciones.' });
    const created = [];
    for (const vendor of dueVendors || []) {
      const { data: pending, error: pendingError } = await supabase.from('assessments').select('id')
        .eq('vendor_id', vendor.id).in('status', ['pending','in_progress']).limit(1);
      if (pendingError) throw pendingError;
      if (pending?.length) continue;
      const { data: assessment, error: assessmentError } = await supabase.from('assessments').insert({
        vendor_id: vendor.id, questionnaire_id: questionnaires[0].id, status: 'pending', started_at: new Date().toISOString()
      }).select().single();
      if (assessmentError) throw assessmentError;
      const intervalDays = Number(vendor.criticality) >= 4 ? 90 : Number(vendor.criticality) === 3 ? 180 : 365;
      await supabase.from('vendors').update({
        status: 'reevaluation',
        next_evaluation: new Date(Date.now() + intervalDays * 86400000).toISOString()
      }).eq('id', vendor.id);
      await writeAudit(req, 'create_assessment', 'assessments', assessment.id, { vendor_id: vendor.id });
      created.push(assessment);
    }
    res.json({ assessmentsCreated: created.length, assessments: created });
  } catch (error) { next(error); }
});

app.post('/api/assessments/:id/complete', allowRoles('admin','risk_analyst'), async (req, res, next) => {
  try {
    const score = Math.max(0, Math.min(100, Number(req.body?.score ?? 0)));
    const { data, error } = await supabase.from('assessments').update({
      status: 'completed', completed_at: new Date().toISOString(), submitted_at: new Date().toISOString(),
      score, responses: req.body?.responses || {}
    }).eq('id', req.params.id).select().single();
    if (error) throw error;
    const nextVendorStatus = score >= 75 ? 'approved' : 'conditional';
    await supabase.from('vendors').update({ status: nextVendorStatus }).eq('id', data.vendor_id).eq('status', 'reevaluation');
    await writeAudit(req, 'complete_assessment', 'assessments', data.id, { score });
    await recalculateVendorScore(data.vendor_id);
    res.json(data);
  } catch (error) { next(error); }
});

app.post('/api/alerts', allowRoles('admin','risk_analyst'), async (req, res, next) => {
  try {
    const alert = await dispatchAlertRecord(req.body || {}, req.user);
    await writeAudit(req, 'dispatch_alert', 'alert_notifications', alert.id, { severity: alert.severity, route: alert.route });
    res.status(201).json(alert);
  }
  catch (error) { next(error); }
});

app.post('/api/audit', allowRoles('admin','risk_analyst','auditor'), async (req, res, next) => {
  try {
    const { action, entity, entity_id, details } = req.body || {};
    if (!action) return res.status(400).json({ error: 'action es obligatorio.' });
    const { data, error } = await supabase.from('audit_log').insert({
      actor: req.user.email, action, entity: entity || null, entity_id: String(entity_id || ''), details: details || {}
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) { next(error); }
});

app.post('/api/cleanup', allowRoles('admin'), async (req, res, next) => {
  try {
    const staleDays = Math.max(1, Number(req.body?.staleDays || process.env.STALE_FINDING_DAYS || 90));
    const retentionYears = Math.max(1, Number(req.body?.retentionYears || process.env.AUDIT_RETENTION_YEARS || 5));
    const { data: closed, error: closeError } = await supabase.from('vendor_findings').update({
      status: 'closed', closed_at: new Date().toISOString(), resolution: 'auto_closed_stale'
    }).eq('status','open').lt('due_date', new Date(Date.now() - staleDays * 86400000).toISOString()).select('id');
    if (closeError) throw closeError;
    const cutoff = new Date(Date.now() - retentionYears * 365 * 86400000).toISOString();
    const { data: oldAudit, error: auditError } = await supabase.from('audit_log').select('*').lt('created_at', cutoff);
    if (auditError) throw auditError;
    if (oldAudit?.length) {
      const archiveRows = oldAudit.map(({ id, created_at, actor, action, entity, entity_id, details }) =>
        ({ id, created_at, actor, action, entity, entity_id, details }));
      const { error: archiveError } = await supabase.from('audit_log_archive').upsert(archiveRows);
      if (archiveError) throw archiveError;
      const { error: deleteError } = await supabase.from('audit_log').delete().lt('created_at', cutoff);
      if (deleteError) throw deleteError;
    }
    const { data: oldScores, error: scoreError } = await supabase.from('score_history').delete()
      .lt('calculated_at', new Date(Date.now() - 365 * 86400000).toISOString()).select('id');
    if (scoreError) throw scoreError;
    await writeAudit(req, 'run_cleanup', 'system', 'wf-10', {
      closed_findings: closed?.length || 0, archived_audit: oldAudit?.length || 0, purged_scores: oldScores?.length || 0
    });
    res.json({ closedFindings: closed?.length || 0, archivedAudit: oldAudit?.length || 0, purgedScores: oldScores?.length || 0 });
  } catch (error) { next(error); }
});

app.post('/api/workflows/:workflowCode/execute', allowRoles('admin','risk_analyst'), async (req, res) => {
  if (!process.env.N8N_MANUAL_WEBHOOK_BASE_URL) {
    return res.status(503).json({ error: 'La ejecución manual de n8n aún no está configurada. Los workflows programados deben ejecutarse desde n8n.' });
  }
  try {
    const code = String(req.params.workflowCode).replace(/[^a-z0-9-]/gi, '');
    const url = process.env.N8N_MANUAL_WEBHOOK_BASE_URL.replace(/\/$/, '') + '/' + encodeURIComponent(code);
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requested_by: req.user.email }) });
    if (!response.ok) return res.status(502).json({ error: `n8n respondió con HTTP ${response.status}.` });
    res.json({ status: 'accepted', workflowCode: code, result: await response.text() });
  } catch (error) { res.status(502).json({ error: error.message || 'No se pudo contactar con n8n.' }); }
});

// Static frontend support is useful when this repository is deployed as a single Web Service.
app.use(express.static(path.join(__dirname, 'dist')));
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const message = error?.message || 'Error interno del servidor.';
  res.status(error?.status || 500).json({ error: message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VRM API listening on port ${PORT}; Supabase ${supabase ? 'configured' : 'NOT configured'}`);
});
