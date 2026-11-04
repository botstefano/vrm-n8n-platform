import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
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
    if (!origin || FRONTEND_ORIGINS.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
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
  const healthy = database === 'connected';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
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
    if (!data.user.email_confirmed_at) return res.status(403).json({ error: 'Debes verificar el correo de tu cuenta de Supabase antes de acceder a VRM.' });

    // New schemas use auth.users.id as the profile ID. Existing installations may
    // have legacy UUIDs in public.users, so fall back to the verified Auth email.
    let { data: profile, error: profileError } = await supabase
      .from('users').select('id,email,full_name,is_active').eq('id', data.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile && data.user.email) {
      const fallback = await supabase.from('users')
        .select('id,email,full_name,is_active').eq('email', data.user.email.toLowerCase()).maybeSingle();
      if (fallback.error) throw fallback.error;
      profile = fallback.data;
    }
    if (!profile || !profile.is_active) return res.status(403).json({ error: 'Usuario no habilitado en VRM.' });

    const { data: memberships, error: roleError } = await supabase
      .from('user_roles').select('roles(code,name)').eq('user_id', profile.id);
    if (roleError) throw roleError;
    const roles = (memberships || []).map((item) => item.roles?.code).filter(Boolean);
    if (!roles.length) return res.status(403).json({ error: 'El usuario no tiene un rol asignado en VRM.' });

    req.user = {
      id: data.user.id,
      profile_id: profile.id,
      email: data.user.email || profile.email,
      full_name: profile.full_name,
      roles
    };
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

function verifyN8nSignature(req, res, next) {
  const expected = process.env.N8N_WEBHOOK_SECRET || '';
  const supplied = req.get('X-N8N-Signature') || '';
  if (!expected || expected.length < 32) return res.status(503).json({ error: 'N8N_WEBHOOK_SECRET debe estar configurado con al menos 32 caracteres aleatorios.' });
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (!supplied || expectedBuffer.length !== suppliedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return res.status(401).json({ error: 'Firma de n8n inválida.' });
  }
  next();
}

function createPortalToken(payload) {
  const secret = process.env.PORTAL_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error('PORTAL_TOKEN_SECRET debe estar configurado y contener al menos 32 caracteres aleatorios.');
    error.status = 503;
    throw error;
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const token = encoded + '.' + signature;
  return {
    token,
    hash: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Number(payload.exp)).toISOString()
  };
}

function verifyPortalToken(token) {
  const secret = process.env.PORTAL_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error('PORTAL_TOKEN_SECRET debe estar configurado y contener al menos 32 caracteres aleatorios.');
    error.status = 503;
    throw error;
  }
  if (typeof token !== 'string' || token.length > 4096) {
    const error = new Error('Enlace de evaluación no válido.');
    error.status = 400;
    throw error;
  }
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    const error = new Error('Enlace de evaluación no válido.');
    error.status = 400;
    throw error;
  }
  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url');
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(parts[1]);
  if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    const error = new Error('La firma del enlace de evaluación no es válida.');
    error.status = 401;
    throw error;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    const error = new Error('El contenido del enlace de evaluación no es válido.');
    error.status = 400;
    throw error;
  }
  if (!payload?.aid || !payload?.vid || !Number.isFinite(Number(payload.exp))) {
    const error = new Error('El contenido del enlace de evaluación está incompleto.');
    error.status = 400;
    throw error;
  }
  if (Number(payload.exp) <= Date.now()) {
    const error = new Error('El enlace de evaluación ha caducado.');
    error.status = 410;
    throw error;
  }
  return payload;
}

function buildPortalLink(assessment) {
  if (!assessment?.portal_token_hash || !assessment?.token_expires_at || !process.env.PORTAL_TOKEN_SECRET) return null;
  const exp = new Date(assessment.token_expires_at).getTime();
  const payload = { aid: assessment.id, vid: assessment.vendor_id, exp };
  const { token, hash } = createPortalToken(payload);
  if (hash !== assessment.portal_token_hash) return null;
  const base = (FRONTEND_ORIGINS[0] || process.env.VRM_PORTAL_URL || '').replace(/\/$/, '');
  return base ? base + '/portal/assessment/' + token : null;
}

async function loadPublicAssessment(token) {
  const payload = verifyPortalToken(token);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const { data: assessment, error } = await supabase.from('assessments').select('*')
    .eq('id', payload.aid).eq('vendor_id', payload.vid).eq('portal_token_hash', hash).maybeSingle();
  if (error) throw error;
  if (!assessment) {
    const missing = new Error('El enlace no existe, fue revocado o ya se utilizó.');
    missing.status = 404;
    throw missing;
  }
  if (!assessment.token_expires_at || new Date(assessment.token_expires_at).getTime() <= Date.now()) {
    const expired = new Error('El enlace de evaluación ha caducado.');
    expired.status = 410;
    throw expired;
  }
  if (!['pending', 'in_progress'].includes(assessment.status)) {
    const completed = new Error('Esta evaluación ya no admite respuestas.');
    completed.status = 410;
    throw completed;
  }
  const [{ data: vendor, error: vendorError }, { data: questionnaire, error: questionnaireError }] = await Promise.all([
    supabase.from('vendors').select('id,legal_name').eq('id', assessment.vendor_id).single(),
    supabase.from('questionnaires').select('id,name,version,definition').eq('id', assessment.questionnaire_id).single()
  ]);
  if (vendorError) throw vendorError;
  if (questionnaireError) throw questionnaireError;
  return { assessment, vendor, questionnaire };
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
    .from('alert_notifications').select('id').eq('fingerprint', fingerprint).gt('created_at', cutoff)
    .in('delivery_status', ['sent','deduped']).limit(1);
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
  let finalDeliveryStatus = row.delivery_status;
  if (!deduped && process.env.N8N_BASE_URL && process.env.ALERTS_WEBHOOK_TOKEN) {
    try {
      const response = await fetch(process.env.N8N_BASE_URL.replace(/\/$/, '') + '/webhook/vrm-alerts', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Alert-Token': process.env.ALERTS_WEBHOOK_TOKEN },
        body: JSON.stringify({ ...payload, severity, fingerprint })
      });
      const responseBody = await response.json().catch(() => ({}));
      finalDeliveryStatus = !response.ok ? 'failed' : (responseBody.deduped ? 'deduped' : 'sent');
      const { error: deliveryError } = await supabase.from('alert_notifications').update({
        delivery_status: finalDeliveryStatus,
        delivery_meta: { http_status: response.status, response: responseBody }
      }).eq('id', data.id);
      if (deliveryError) console.error('No se pudo actualizar el estado de la alerta:', deliveryError.message);
    } catch (error) {
      finalDeliveryStatus = 'failed';
      await supabase.from('alert_notifications').update({
        delivery_status: 'failed',
        delivery_meta: { error: String(error.message || error) }
      }).eq('id', data.id);
    }
  }
  return { ...data, delivery_status: finalDeliveryStatus, status: finalDeliveryStatus, timestamp: data.created_at, vendor_name: null, email_subject: null, email_html: null, slack_text: null };
}

// Portal público de proveedores: acceso únicamente mediante enlace HMAC firmado, vigente y de un solo uso.
app.get('/api/public/assessments/:token', requireDatabase, async (req, res, next) => {
  try {
    const { assessment, vendor, questionnaire } = await loadPublicAssessment(req.params.token);
    res.json({
      vendor: { id: vendor.id, legal_name: vendor.legal_name },
      assessment: { id: assessment.id, status: assessment.status, token_expires_at: assessment.token_expires_at },
      questionnaire: {
        id: questionnaire.id,
        name: questionnaire.name,
        version: questionnaire.version,
        sections: questionnaire.definition?.sections || []
      }
    });
  } catch (error) { next(error); }
});

app.post('/api/public/assessments/:token/complete', requireDatabase, async (req, res, next) => {
  try {
    const { assessment, vendor, questionnaire } = await loadPublicAssessment(req.params.token);
    const responses = req.body?.responses;
    if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
      return res.status(400).json({ error: 'Debes enviar las respuestas del cuestionario.' });
    }
    const questions = (questionnaire.definition?.sections || []).flatMap((section) => section.questions || []);
    if (!questions.length) return res.status(409).json({ error: 'El cuestionario no contiene preguntas configuradas.' });
    const questionIds = new Set(questions.map((question) => question.id));
    if (Object.keys(responses).some((id) => !questionIds.has(id))) {
      return res.status(400).json({ error: 'El formulario contiene respuestas que no pertenecen a este cuestionario.' });
    }
    for (const question of questions) {
      if (typeof responses[question.id] !== 'boolean') {
        return res.status(400).json({ error: 'Responde todas las preguntas antes de enviar la evaluación.' });
      }
    }
    const totalWeight = questions.reduce((sum, question) => sum + Math.max(0, Number(question.weight) || 0), 0);
    if (totalWeight <= 0) return res.status(409).json({ error: 'El cuestionario no tiene ponderaciones válidas.' });
    const earnedWeight = questions.reduce((sum, question) =>
      sum + (responses[question.id] === true ? Math.max(0, Number(question.weight) || 0) : 0), 0);
    const score = Math.round((earnedWeight / totalWeight) * 1000) / 10;
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const { data: saved, error } = await supabase.from('assessments').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      score,
      responses,
      portal_token_hash: null,
      token_expires_at: null
    }).eq('id', assessment.id).eq('portal_token_hash', tokenHash)
      .in('status', ['pending','in_progress']).select().maybeSingle();
    if (error) throw error;
    if (!saved) return res.status(409).json({ error: 'La evaluación ya fue enviada o el enlace fue utilizado.' });

    const { data: updatedVendor, error: vendorStatusError } = await supabase.from('vendors').update({
      status: score >= 75 ? 'approved' : 'conditional'
    }).eq('id', vendor.id).eq('status', 'reevaluation').select('id').maybeSingle();
    const vendorStatusUpdated = !vendorStatusError && Boolean(updatedVendor);
    if (vendorStatusError) console.error('Assessment saved, but vendor status update failed:', vendorStatusError.message);
    const { error: auditError } = await supabase.from('audit_log').insert({
      actor: 'vendor_portal',
      action: 'vendor_assessment_submitted',
      entity: 'assessments',
      entity_id: assessment.id,
      details: { vendor_id: vendor.id, score }
    });
    if (auditError) console.error('Assessment audit insert failed:', auditError.message);
    let scorecardUpdated = true;
    try { await recalculateVendorScore(vendor.id); }
    catch (scoreError) {
      scorecardUpdated = false;
      console.error('Assessment scorecard refresh failed:', scoreError.message);
    }
    res.json({ completed: true, score, vendorStatusUpdated, scorecardUpdated, message: 'La evaluación fue registrada correctamente.' });
  } catch (error) { next(error); }
});

// Webhooks privados para llamadas salientes desde n8n. Se validan con secreto compartido.
app.post('/api/v1/scorecard/recalc/:vendorId', requireDatabase, verifyN8nSignature, async (req, res, next) => {
  try {
    res.json(await recalculateVendorScore(req.params.vendorId));
  } catch (error) { next(error); }
});

app.post('/api/v1/webhooks/n8n/findings-created', requireDatabase, verifyN8nSignature, async (req, res, next) => {
  try {
    const body = req.body || {};
    if (body.vendor_id) await recalculateVendorScore(body.vendor_id);
    await supabase.from('audit_log').insert({
      actor: 'n8n', action: 'finding_ingested', entity: 'vendor_findings',
      entity_id: String(body.finding_id || body.source_ref || ''),
      details: { vendor_id: body.vendor_id, source: body.source, severity: body.severity, title: body.title }
    });
    res.json({ received: true, scorecardUpdated: Boolean(body.vendor_id) });
  } catch (error) { next(error); }
});

app.post('/api/v1/webhooks/n8n/assessment-created', requireDatabase, verifyN8nSignature, async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.assessment_id || !body.vendor_id || !body.link) {
      return res.status(400).json({ error: 'assessment_id, vendor_id y link son obligatorios.' });
    }
    const linkUrl = new URL(body.link);
    const token = linkUrl.pathname.split('/').filter(Boolean).at(-1);
    const payload = verifyPortalToken(token);
    if (payload.aid !== body.assessment_id || payload.vid !== body.vendor_id) {
      return res.status(400).json({ error: 'El enlace HMAC no corresponde a la evaluación informada.' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { data: assessment, error } = await supabase.from('assessments').update({
      portal_token_hash: tokenHash,
      token_expires_at: new Date(Number(payload.exp)).toISOString()
    }).eq('id', body.assessment_id).eq('vendor_id', body.vendor_id)
      .in('status', ['pending','in_progress']).select('id').maybeSingle();
    if (error) throw error;
    if (!assessment) return res.status(404).json({ error: 'No se encontró una evaluación pendiente para registrar el enlace.' });
    const { error: auditError } = await supabase.from('audit_log').insert({
      actor: 'n8n', action: 'assessment_invitation_prepared', entity: 'assessments',
      entity_id: String(body.assessment_id),
      details: { vendor_id: body.vendor_id, email_present: Boolean(body.email), link_registered: true }
    });
    if (auditError) throw auditError;
    res.json({ received: true, tokenRegistered: true, emailPresent: Boolean(body.email) });
  } catch (error) { next(error); }
});

app.post('/api/v1/webhooks/n8n/workflow-failed', requireDatabase, verifyN8nSignature, async (req, res, next) => {
  try {
    const body = req.body || {};
    await supabase.from('audit_log').insert({
      actor: 'n8n', action: 'workflow_failed', entity: 'n8n_workflow',
      entity_id: String(body.workflow || body.workflow_id || ''),
      details: { node: body.node, message: body.message, execution_id: body.execution_id }
    });
    res.json({ received: true });
  } catch (error) { next(error); }
});

app.post('/api/v1/webhooks/n8n/workflow-completed', requireDatabase, verifyN8nSignature, async (req, res, next) => {
  try {
    const body = req.body || {};
    const requestId = String(body.request_id || '');
    const workflowCode = String(body.workflow_code || '').toLowerCase();
    const status = String(body.status || '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      return res.status(400).json({ error: 'request_id debe ser un UUID válido.' });
    }
    if (!/^wf-(0[1-9]|10)$/.test(workflowCode)) return res.status(400).json({ error: 'workflow_code no válido.' });
    if (!['success','partial','failed'].includes(status)) return res.status(400).json({ error: 'status debe ser success, partial o failed.' });

    const { data: current, error: currentError } = await supabase.from('workflow_execution_logs')
      .select('id,details,completed_at')
      .eq('id', requestId)
      .eq('workflow_code', workflowCode)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return res.status(404).json({ error: 'No existe una ejecución manual con ese request_id.' });
    if (current.completed_at && !(current.status === 'partial' && ['success','failed'].includes(status))) {
      return res.json({ received: true, alreadyCompleted: true, status: current.status });
    }

    const details = {
      ...(current.details || {}),
      result: body.details && typeof body.details === 'object' ? body.details : {},
      callback_received_at: new Date().toISOString()
    };
    const { error: updateError } = await supabase.from('workflow_execution_logs').update({
      status,
      completed_at: new Date().toISOString(),
      summary: String(body.summary || `Workflow ${workflowCode.toUpperCase()} finalizó: ${status}.`).slice(0, 1000),
      details
    }).eq('id', requestId).eq('workflow_code', workflowCode);
    if (updateError) throw updateError;
    res.json({ received: true, requestId, status });
  } catch (error) { next(error); }
});

app.use('/api', requireDatabase, authenticate);

app.get('/api/health', async (_req, res, next) => {
  try {
    const { error } = await supabase.from('roles').select('id', { head: true, count: 'exact' });
    if (error) throw error;
    res.json({ status: 'online', database: 'connected', checkedAt: new Date().toISOString() });
  } catch (error) { next(error); }
});

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
      const orderColumn =
        table === 'vendors' ? 'created_at' :
        table === 'vendor_findings' ? 'detected_at' :
        table === 'audit_log' || table === 'audit_log_archive' ? 'created_at' :
        table === 'score_history' ? 'calculated_at' :
        table === 'alert_notifications' ? 'created_at' :
        table === 'workflow_execution_logs' ? 'started_at' :
        table === 'user_roles' ? 'user_id' : 'id';
      const { data, error } = await supabase.from(table).select('*').order(orderColumn, { ascending: false });
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
      user: { ...req.user, roles: roleMap.get(req.user.profile_id) || req.user.roles },
      vendors: rows.vendors.map((vendor) => ({ ...vendor, website: vendor.website || '', current_score: Number(vendor.current_score ?? 100), primary_contact: vendor.primary_contact || {} })),
      technologies: rows.vendor_technologies,
      questionnaires: rows.questionnaires.map((q) => ({ ...q, sections: q.definition?.sections || [] })),
      assessments: rows.assessments.map(({ portal_token_hash, ...assessment }) => ({
        ...assessment,
        score: assessment.score === null ? null : Number(assessment.score),
        // The signed URL is a bearer credential. Never disclose it to read-only auditors.
        portal_link: req.user.roles.some((role) => ['admin', 'risk_analyst'].includes(role))
          ? buildPortalLink({ ...assessment, portal_token_hash })
          : null
      })),
      findings: rows.vendor_findings.map((finding) => ({ ...finding, description: finding.description || '', evidence: finding.evidence || {} })),
      monitoringJobs: rows.monitoring_jobs.map((job) => ({
        ...job,
        status: job.status === 'ok' || job.status === 'healthy' ? 'healthy'
          : job.status === 'error' || job.status === 'failed' ? 'failed'
          : job.status === 'partial' ? 'overdue' : (job.status || 'idle')
      })),
      users: rows.users.filter((u) => u.id === req.user.profile_id).map((u) => ({ ...u, full_name: u.full_name || u.email, roles: roleMap.get(u.id) || [] })),
      auditLog: rows.audit_log.map((entry) => ({ ...entry, actor: entry.actor || 'system', entity: entry.entity || '', entity_id: entry.entity_id || '', details: entry.details || {} })),
      auditArchive: rows.audit_log_archive.map((entry) => ({ ...entry, actor: entry.actor || 'system', entity: entry.entity || '', entity_id: entry.entity_id || '', details: entry.details || {} })),
      scoreHistory: rows.score_history.map((entry) => ({ ...entry, score: Number(entry.score || 0) })),
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
    const scorecard = await recalculateVendorScore(data.id);
    await writeAudit(req, 'insert_vendor', 'vendors', data.id, { legal_name: data.legal_name });
    res.status(201).json({ ...data, current_score: scorecard.score, current_risk: scorecard.risk });
  } catch (error) { next(error); }
});

app.patch('/api/vendors/:id', allowRoles('admin','risk_analyst'), async (req, res, next) => {
  try {
    const allowed = ['legal_name','website','status','criticality','next_evaluation','primary_contact'];
    const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
    const { data, error } = await supabase.from('vendors').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    if (['criticality','next_evaluation','status'].some((key) => Object.prototype.hasOwnProperty.call(updates, key))) {
      await recalculateVendorScore(data.id);
    }
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
    if (['critical','high'].includes(data.severity)) {
      try {
        await dispatchAlertRecord({
          severity: data.severity, title: data.title, vendor_id: data.vendor_id,
          source: data.source, source_ref: data.source_ref, description: data.description
        }, req.user);
      } catch (alertError) {
        console.error('Finding saved but alert dispatch failed:', alertError.message);
      }
    }
    res.status(201).json(data);
  } catch (error) { next(error); }
});

app.patch('/api/findings/:id', allowRoles('admin','risk_analyst'), async (req, res, next) => {
  try {
    const allowed = ['status','severity','resolution','due_date'];
    const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
    const { data: previous, error: previousError } = await supabase.from('vendor_findings')
      .select('id,vendor_id,title,source,source_ref,severity,status,description')
      .eq('id', req.params.id).single();
    if (previousError) throw previousError;
    const severityRank = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
    const isEscalation = Object.prototype.hasOwnProperty.call(updates, 'severity') &&
      (severityRank[updates.severity] ?? -1) > (severityRank[previous.severity] ?? -1) &&
      previous.status !== 'closed';
    if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
      updates.closed_at = updates.status === 'closed' ? new Date().toISOString() : null;
    }
    const { data, error } = await supabase.from('vendor_findings').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    await writeAudit(req, 'update_finding_status', 'vendor_findings', data.id, updates);
    await recalculateVendorScore(data.vendor_id);
    if (isEscalation && ['critical','high'].includes(data.severity)) {
      try {
        await dispatchAlertRecord({
          severity: data.severity, title: '[ESCALATED] ' + data.title, vendor_id: data.vendor_id,
          source: data.source, source_ref: data.source_ref, description: data.description
        }, req.user);
      } catch (alertError) {
        console.error('Finding severity updated but escalation alert failed:', alertError.message);
      }
    }
    res.json(data);
  } catch (error) { next(error); }
});

app.post('/api/scorecards/recalculate/:vendorId', allowRoles('admin','risk_analyst'), async (req, res, next) => {
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
      const assessmentId = crypto.randomUUID();
      const exp = Date.now() + 30 * 86400000;
      const portal = createPortalToken({ aid: assessmentId, vid: vendor.id, exp });
      const { data: assessment, error: assessmentError } = await supabase.from('assessments').insert({
        id: assessmentId, vendor_id: vendor.id, questionnaire_id: questionnaires[0].id,
        status: 'pending', started_at: new Date().toISOString(),
        portal_token_hash: portal.hash, token_expires_at: portal.expiresAt
      }).select().single();
      if (assessmentError) throw assessmentError;
      const intervalDays = Number(vendor.criticality) >= 4 ? 90 : Number(vendor.criticality) === 3 ? 180 : 365;
      const { error: vendorUpdateError } = await supabase.from('vendors').update({
        status: 'reevaluation',
        next_evaluation: new Date(Date.now() + intervalDays * 86400000).toISOString()
      }).eq('id', vendor.id);
      if (vendorUpdateError) throw vendorUpdateError;
      await writeAudit(req, 'create_assessment', 'assessments', assessment.id, { vendor_id: vendor.id });
      const frontendBase = (FRONTEND_ORIGINS[0] || '').replace(/\/$/, '');
      created.push({ ...assessment, portal_link: frontendBase ? frontendBase + '/portal/assessment/' + portal.token : null });
    }
    res.json({ assessmentsCreated: created.length, assessments: created });
  } catch (error) { next(error); }
});

app.post('/api/assessments/:id/complete', allowRoles('admin','risk_analyst'), async (req, res, next) => {
  try {
    const score = Math.max(0, Math.min(100, Number(req.body?.score ?? 0)));
    const { data, error } = await supabase.from('assessments').update({
      status: 'completed', completed_at: new Date().toISOString(), submitted_at: new Date().toISOString(),
      score, responses: req.body?.responses || {}, portal_token_hash: null, token_expires_at: null
    }).eq('id', req.params.id).in('status', ['pending','in_progress']).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ error: 'La evaluación ya fue completada o no admite más respuestas.' });
    const nextVendorStatus = score >= 75 ? 'approved' : 'conditional';
    const { data: updatedVendor, error: vendorStatusError } = await supabase.from('vendors').update({ status: nextVendorStatus })
      .eq('id', data.vendor_id).eq('status', 'reevaluation').select('id').maybeSingle();
    const vendorStatusUpdated = !vendorStatusError && Boolean(updatedVendor);
    await writeAudit(req, 'complete_assessment', 'assessments', data.id, { score, vendor_status_updated: vendorStatusUpdated });
    let scorecardUpdated = true;
    try { await recalculateVendorScore(data.vendor_id); }
    catch (scoreError) {
      scorecardUpdated = false;
      console.error('Assessment scorecard refresh failed:', scoreError.message);
    }
    res.json({ ...data, vendorStatusUpdated, scorecardUpdated });
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

app.post('/api/audit', allowRoles('admin','risk_analyst'), async (req, res, next) => {
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
    const scoreRetentionYears = Math.max(1, Number(process.env.SCORE_RETENTION_YEARS || 2));
    const { data: oldScores, error: scoreError } = await supabase.from('score_history').delete()
      .lt('calculated_at', new Date(Date.now() - scoreRetentionYears * 365 * 86400000).toISOString()).select('id');
    if (scoreError) throw scoreError;
    await writeAudit(req, 'run_cleanup', 'system', 'wf-10', {
      closed_findings: closed?.length || 0, archived_audit: oldAudit?.length || 0, purged_scores: oldScores?.length || 0
    });
    res.json({ closedFindings: closed?.length || 0, archivedAudit: oldAudit?.length || 0, purgedScores: oldScores?.length || 0 });
  } catch (error) { next(error); }
});

app.get('/api/workflows/logs', async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('workflow_execution_logs')
      .select('*').order('started_at', { ascending: false }).limit(50);
    if (error) throw error;
    res.json({ workflowLogs: (data || []).map((log) => ({
      id: log.id,
      workflowId: log.workflow_code,
      workflowName: log.workflow_name,
      startedAt: log.started_at,
      completedAt: log.completed_at,
      status: log.status,
      summary: log.summary,
      steps: log.details?.steps || []
    })) });
  } catch (error) { next(error); }
});

app.post('/api/workflows/:workflowCode/execute', allowRoles('admin','risk_analyst'), async (req, res, next) => {
  const code = String(req.params.workflowCode).toLowerCase();
  if (code === 'wf-00') return res.status(409).json({ error: 'WF-00 es un manejador de errores basado en eventos y no admite ejecución manual.' });
  if (!/^wf-(0[1-9]|10)$/.test(code)) return res.status(400).json({ error: 'Código de workflow no válido.' });
  if (code === 'wf-10' && !req.user.roles.includes('admin')) return res.status(403).json({ error: 'WF-10 está reservado para administradores.' });
  if (!process.env.N8N_MANUAL_WEBHOOK_BASE_URL || !process.env.ALERTS_WEBHOOK_TOKEN) {
    return res.status(503).json({ error: 'Configura N8N_MANUAL_WEBHOOK_BASE_URL y ALERTS_WEBHOOK_TOKEN en Render, e importa los workflows actualizados en n8n.' });
  }

  const requestId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  try {
    const { error: logError } = await supabase.from('workflow_execution_logs').insert({
      id: requestId,
      workflow_code: code,
      workflow_name: code.toUpperCase(),
      started_at: startedAt,
      status: 'running',
      summary: 'Solicitud enviada a n8n; esperando el resultado final.',
      details: { request_id: requestId, requested_by: req.user.email, manual: true }
    });
    if (logError) throw logError;

    const url = process.env.N8N_MANUAL_WEBHOOK_BASE_URL.replace(/\/$/, '') + '/' + encodeURIComponent(code);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Alert-Token': process.env.ALERTS_WEBHOOK_TOKEN },
      body: JSON.stringify({ requested_by: req.user.email, workflow_code: code, request_id: requestId })
    });
    const responseText = await response.text();
    if (!response.ok) {
      await supabase.from('workflow_execution_logs').update({
        status: 'failed', completed_at: new Date().toISOString(),
        summary: `n8n respondió con HTTP ${response.status}.`,
        details: { request_id: requestId, requested_by: req.user.email, response: responseText.slice(0, 500) }
      }).eq('id', requestId);
      return res.status(502).json({ error: `n8n respondió con HTTP ${response.status}: ${responseText.slice(0, 300)}` });
    }
    res.json({ status: 'accepted', workflowCode: code, requestId, message: 'Webhook aceptado por n8n.' });
  } catch (error) {
    await supabase.from('workflow_execution_logs').update({
      status: 'failed', completed_at: new Date().toISOString(),
      summary: 'No se pudo iniciar la ejecución en n8n.',
      details: { request_id: requestId, requested_by: req.user.email, error: String(error.message || error).slice(0, 500) }
    }).eq('id', requestId);
    next(error);
  }
});

// Static frontend support is useful when this repository is deployed as a single Web Service.
app.use(express.static(path.join(__dirname, 'dist')));
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = Number(error?.status || 500);
  const safeToExpose = status >= 400 && status < 500;
  const message = safeToExpose
    ? (error?.message || 'Solicitud no válida.')
    : 'Error interno del servidor. Revisa los registros del servicio para obtener detalles.';
  res.status(status >= 400 && status <= 599 ? status : 500).json({ error: message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VRM API listening on port ${PORT}; Supabase ${supabase ? 'configured' : 'NOT configured'}`);
});
