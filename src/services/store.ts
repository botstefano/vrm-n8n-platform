import {
  Vendor,
  VendorTechnology,
  Questionnaire,
  Assessment,
  VendorFinding,
  MonitoringJob,
  User,
  AuditLogEntry,
  ScoreHistoryEntry,
  AlertNotification,
  RiskLevel,
  FindingSeverity,
  FindingStatus,
  VendorStatus
} from '../types';
import {
  INITIAL_VENDORS,
  INITIAL_TECHNOLOGIES,
  INITIAL_QUESTIONNAIRES,
  INITIAL_ASSESSMENTS,
  INITIAL_FINDINGS,
  INITIAL_MONITORING_JOBS,
  INITIAL_USERS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SCORE_HISTORY
} from '../data/seedData';

const STORAGE_KEY_PREFIX = 'vrm_platform_';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`Error loading ${key} from localStorage:`, e);
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Error saving ${key} to localStorage:`, e);
  }
}

// Simple base64url encoder
function base64UrlEncode(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}

// Pseudo HMAC simulation for browser demo (matches n8n crypto.createHmac pattern)
function mockHmacSha256(payload: string, secret: string = 'vrm-secret-portal-token'): string {
  let hash = 0;
  const combined = payload + '::' + secret;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return base64UrlEncode('sig_' + Math.abs(hash).toString(16) + '_verified');
}

export interface WorkflowRunLog {
  id: string;
  workflowId: string;
  workflowName: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'success' | 'failed';
  steps: {
    nodeId: string;
    nodeName: string;
    status: 'success' | 'error' | 'skipped';
    outputPreview?: string;
    durationMs: number;
  }[];
  summary: string;
}

class VrmStore {
  private vendors: Vendor[] = [];
  private technologies: VendorTechnology[] = [];
  private questionnaires: Questionnaire[] = [];
  private assessments: Assessment[] = [];
  private findings: VendorFinding[] = [];
  private monitoringJobs: MonitoringJob[] = [];
  private users: User[] = [];
  private auditLog: AuditLogEntry[] = [];
  private auditArchive: AuditLogEntry[] = [];
  private scoreHistory: ScoreHistoryEntry[] = [];
  private alerts: AlertNotification[] = [];
  private workflowLogs: WorkflowRunLog[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    this.vendors = loadFromStorage('vendors', INITIAL_VENDORS);
    this.technologies = loadFromStorage('technologies', INITIAL_TECHNOLOGIES);
    this.questionnaires = loadFromStorage('questionnaires', INITIAL_QUESTIONNAIRES);
    this.assessments = loadFromStorage('assessments', INITIAL_ASSESSMENTS);
    this.findings = loadFromStorage('findings', INITIAL_FINDINGS);
    this.monitoringJobs = loadFromStorage('monitoring_jobs', INITIAL_MONITORING_JOBS);
    this.users = loadFromStorage('users', INITIAL_USERS);
    this.auditLog = loadFromStorage('audit_log', INITIAL_AUDIT_LOGS);
    this.auditArchive = loadFromStorage('audit_archive', []);
    this.scoreHistory = loadFromStorage('score_history', INITIAL_SCORE_HISTORY);
    this.alerts = loadFromStorage('alerts', []);
    this.workflowLogs = loadFromStorage('workflow_logs', []);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.persist();
    this.listeners.forEach((l) => l());
  }

  private persist() {
    saveToStorage('vendors', this.vendors);
    saveToStorage('technologies', this.technologies);
    saveToStorage('questionnaires', this.questionnaires);
    saveToStorage('assessments', this.assessments);
    saveToStorage('findings', this.findings);
    saveToStorage('monitoring_jobs', this.monitoringJobs);
    saveToStorage('users', this.users);
    saveToStorage('audit_log', this.auditLog);
    saveToStorage('audit_archive', this.auditArchive);
    saveToStorage('score_history', this.scoreHistory);
    saveToStorage('alerts', this.alerts);
    saveToStorage('workflow_logs', this.workflowLogs);
  }

  public resetToDefaults() {
    this.vendors = [...INITIAL_VENDORS];
    this.technologies = [...INITIAL_TECHNOLOGIES];
    this.questionnaires = [...INITIAL_QUESTIONNAIRES];
    this.assessments = [...INITIAL_ASSESSMENTS];
    this.findings = [...INITIAL_FINDINGS];
    this.monitoringJobs = [...INITIAL_MONITORING_JOBS];
    this.users = [...INITIAL_USERS];
    this.auditLog = [...INITIAL_AUDIT_LOGS];
    this.auditArchive = [];
    this.scoreHistory = [...INITIAL_SCORE_HISTORY];
    this.alerts = [];
    this.workflowLogs = [];
    this.notify();
  }

  // Getters
  public getVendors(): Vendor[] {
    return this.vendors;
  }
  public getTechnologies(): VendorTechnology[] {
    return this.technologies;
  }
  public getQuestionnaires(): Questionnaire[] {
    return this.questionnaires;
  }
  public getAssessments(): Assessment[] {
    return this.assessments;
  }
  public getFindings(): VendorFinding[] {
    return this.findings;
  }
  public getMonitoringJobs(): MonitoringJob[] {
    return this.monitoringJobs;
  }
  public getUsers(): User[] {
    return this.users;
  }
  public getAuditLog(): AuditLogEntry[] {
    return this.auditLog;
  }
  public getAuditArchive(): AuditLogEntry[] {
    return this.auditArchive;
  }
  public getScoreHistory(): ScoreHistoryEntry[] {
    return this.scoreHistory;
  }
  public getAlerts(): AlertNotification[] {
    return this.alerts;
  }
  public getWorkflowLogs(): WorkflowRunLog[] {
    return this.workflowLogs;
  }

  // Vendor Operations
  public addVendor(vendorData: Omit<Vendor, 'id' | 'created_at' | 'updated_at'>): Vendor {
    const id = 'v-' + Math.random().toString(36).substring(2, 9);
    const newVendor: Vendor = {
      ...vendorData,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.vendors.unshift(newVendor);
    this.logAudit('admin@vrm.local', 'insert_vendor', 'vendors', id, { legal_name: newVendor.legal_name });
    this.recalculateScorecard(id);
    this.notify();
    return newVendor;
  }

  public updateVendor(id: string, updates: Partial<Vendor>): void {
    const idx = this.vendors.findIndex((v) => v.id === id);
    if (idx !== -1) {
      this.vendors[idx] = {
        ...this.vendors[idx],
        ...updates,
        updated_at: new Date().toISOString()
      };
      this.logAudit('admin@vrm.local', 'update_vendor', 'vendors', id, updates);
      this.notify();
    }
  }

  public deleteVendor(id: string): void {
    const v = this.vendors.find((item) => item.id === id);
    this.vendors = this.vendors.filter((item) => item.id !== id);
    this.technologies = this.technologies.filter((t) => t.vendor_id !== id);
    this.findings = this.findings.filter((f) => f.vendor_id !== id);
    this.assessments = this.assessments.filter((a) => a.vendor_id !== id);
    this.scoreHistory = this.scoreHistory.filter((sh) => sh.vendor_id !== id);
    if (v) {
      this.logAudit('admin@vrm.local', 'delete_vendor', 'vendors', id, { name: v.legal_name });
    }
    this.notify();
  }

  // Technology Operations
  public addTechnology(tech: Omit<VendorTechnology, 'id'>): VendorTechnology {
    const newTech: VendorTechnology = {
      ...tech,
      id: 'vt-' + Math.random().toString(36).substring(2, 9)
    };
    this.technologies.push(newTech);
    this.logAudit('admin@vrm.local', 'insert_technology', 'vendor_technologies', newTech.id, {
      product: newTech.product_name,
      cpe: newTech.cpe_match
    });
    this.notify();
    return newTech;
  }

  public deleteTechnology(id: string): void {
    this.technologies = this.technologies.filter((t) => t.id !== id);
    this.notify();
  }

  // Finding Operations
  public addFinding(findingData: Omit<VendorFinding, 'id' | 'detected_at'>): VendorFinding | null {
    // Check uniqueness constraint: vendor_id + source + source_ref (idempotency rule uq_finding_source)
    const existing = this.findings.find(
      (f) =>
        f.vendor_id === findingData.vendor_id &&
        f.source === findingData.source &&
        f.source_ref === findingData.source_ref
    );

    if (existing) {
      // If severity escalated, update and alert
      if (existing.severity !== findingData.severity && existing.status !== 'closed') {
        existing.severity = findingData.severity;
        this.logAudit(`n8n:${findingData.source}`, 'escalate_finding', 'vendor_findings', existing.id, {
          title: existing.title,
          newSeverity: findingData.severity
        });
        this.dispatchAlert({
          severity: findingData.severity,
          title: `[ESCALATED] ${findingData.title}`,
          vendor_id: findingData.vendor_id,
          source: findingData.source,
          source_ref: findingData.source_ref,
          description: findingData.description
        });
        this.recalculateScorecard(findingData.vendor_id);
        this.notify();
      }
      return null;
    }

    const id = 'f-' + Math.random().toString(36).substring(2, 9);
    const newFinding: VendorFinding = {
      ...findingData,
      id,
      detected_at: new Date().toISOString()
    };
    this.findings.unshift(newFinding);

    this.logAudit(`n8n:${findingData.source}`, 'insert_finding', 'vendor_findings', id, {
      title: newFinding.title,
      severity: newFinding.severity,
      source: newFinding.source
    });

    // Check if severe: critical/high triggers alert
    if (newFinding.severity === 'critical' || newFinding.severity === 'high') {
      this.dispatchAlert({
        severity: newFinding.severity,
        title: newFinding.title,
        vendor_id: newFinding.vendor_id,
        source: newFinding.source,
        source_ref: newFinding.source_ref,
        description: newFinding.description
      });
    }

    this.recalculateScorecard(newFinding.vendor_id);
    this.notify();
    return newFinding;
  }

  public updateFindingStatus(id: string, status: FindingStatus, resolution?: string): void {
    const f = this.findings.find((item) => item.id === id);
    if (f) {
      const prev = f.status;
      f.status = status;
      if (resolution) f.resolution = resolution;
      if (status === 'closed') {
        f.closed_at = new Date().toISOString();
      }
      this.logAudit('analista@vrm.local', 'update_finding_status', 'vendor_findings', id, {
        from: prev,
        to: status,
        resolution
      });
      this.recalculateScorecard(f.vendor_id);
      this.notify();
    }
  }

  // Scorecard Recalculation (WF-07 logic)
  public recalculateScorecard(vendorId: string): { score: number; risk: RiskLevel } {
    const vendor = this.vendors.find((v) => v.id === vendorId);
    if (!vendor) return { score: 100, risk: 'low' };

    let score = 100.0;
    const vendorFindings = this.findings.filter((f) => f.vendor_id === vendorId);

    // Criticality factor: 1 => 0.8x, 3 => 1.0x, 5 => 1.3x
    const critMultiplier = 0.7 + vendor.criticality * 0.12;

    for (const f of vendorFindings) {
      if (f.status === 'closed') continue;

      let deduction = 0;
      switch (f.severity) {
        case 'critical':
          deduction = 22;
          break;
        case 'high':
          deduction = 12;
          break;
        case 'medium':
          deduction = 5;
          break;
        case 'low':
          deduction = 2;
          break;
        case 'info':
          deduction = 0;
          break;
      }

      if (f.status === 'in_progress') {
        deduction *= 0.6; // 40% reduction while mitigating
      } else if (f.status === 'accepted') {
        deduction *= 0.4; // 60% reduction for accepted business risk
      }

      score -= deduction * critMultiplier;
    }

    // Overdue evaluation penalty
    if (vendor.next_evaluation && new Date(vendor.next_evaluation) < new Date()) {
      score -= 5.0;
    }

    // Pending assessments penalty
    const hasPendingAssessment = this.assessments.some(
      (a) => a.vendor_id === vendorId && (a.status === 'pending' || a.status === 'in_progress')
    );
    if (hasPendingAssessment && vendor.status === 'reevaluation') {
      score -= 3.0;
    }

    score = Math.max(0.0, Math.min(100.0, Math.round(score * 10) / 10));

    // Map Risk Level
    let risk: RiskLevel = 'low';
    if (score < 45) {
      risk = 'critical';
    } else if (score < 65) {
      risk = 'high';
    } else if (score < 80) {
      risk = 'medium';
    } else if (score >= 92 && vendor.criticality <= 3) {
      risk = 'minimal';
    } else {
      risk = 'low';
    }

    vendor.current_score = score;
    vendor.current_risk = risk;
    vendor.updated_at = new Date().toISOString();

    // Record into score_history
    this.scoreHistory.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      vendor_id: vendorId,
      score,
      risk,
      calculated_at: new Date().toISOString()
    });

    return { score, risk };
  }

  public recalculateAllScorecards(): { refreshed: number } {
    let count = 0;
    const activeStatuses: VendorStatus[] = ['approved', 'conditional', 'monitoring', 'incident', 'reevaluation'];
    for (const v of this.vendors) {
      if (activeStatuses.includes(v.status)) {
        this.recalculateScorecard(v.id);
        count++;
      }
    }
    this.updateJobMeta('scorecard_refresh_all', { vendors_refreshed: count, refreshed_at: new Date().toISOString() });
    this.notify();
    return { refreshed: count };
  }

  // Periodic Re-evaluation Scheduler (WF-05 logic)
  public triggerReevaluationForDue(): { assessmentsCreated: number; details: any[] } {
    const dueVendors = this.vendors.filter((v) => {
      const active = ['approved', 'conditional', 'monitoring'].includes(v.status);
      const isDue = !v.next_evaluation || new Date(v.next_evaluation) <= new Date();
      const hasPending = this.assessments.some(
        (a) => a.vendor_id === v.id && (a.status === 'pending' || a.status === 'in_progress')
      );
      return active && isDue && !hasPending;
    });

    const details: any[] = [];
    const activeQuestionnaire = this.questionnaires.find((q) => q.is_active) || this.questionnaires[0];

    for (const v of dueVendors) {
      const intervalDays = v.criticality >= 4 ? 90 : v.criticality === 3 ? 180 : 365;
      const assessmentId = 'asm-' + Math.random().toString(36).substring(2, 9);

      // Sign portal link (HMAC simulation matching WF-05: aid, vid, exp 30 days)
      const payloadObj = {
        aid: assessmentId,
        vid: v.id,
        exp: Date.now() + 30 * 86400000
      };
      const payloadBase64 = base64UrlEncode(JSON.stringify(payloadObj));
      const sig = mockHmacSha256(payloadBase64, 'vrm-secret-portal-key');
      const portalToken = `${payloadBase64}.${sig}`;

      const newAssessment: Assessment = {
        id: assessmentId,
        vendor_id: v.id,
        questionnaire_id: activeQuestionnaire.id,
        status: 'pending',
        started_at: new Date().toISOString(),
        completed_at: null,
        portal_token: portalToken
      };

      this.assessments.push(newAssessment);

      // Update vendor status to reevaluation and next_evaluation
      v.status = 'reevaluation';
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + intervalDays);
      v.next_evaluation = nextDate.toISOString();
      v.updated_at = new Date().toISOString();

      this.logAudit('n8n:wf-05-reevaluation', 'create_assessment', 'assessments', assessmentId, {
        vendor_id: v.id,
        vendor_name: v.legal_name,
        intervalDays
      });

      details.push({
        vendor_id: v.id,
        legal_name: v.legal_name,
        email: v.primary_contact.email,
        link: `/portal/assessment/${portalToken}`
      });
    }

    this.notify();
    return { assessmentsCreated: dueVendors.length, details };
  }

  // Assessment Portal completion
  public completeAssessment(assessmentId: string, calculatedScore: number = 88): void {
    const asm = this.assessments.find((a) => a.id === assessmentId);
    if (!asm) return;
    asm.status = 'completed';
    asm.completed_at = new Date().toISOString();
    asm.score = calculatedScore;

    const vendor = this.vendors.find((v) => v.id === asm.vendor_id);
    if (vendor && vendor.status === 'reevaluation') {
      vendor.status = calculatedScore >= 75 ? 'approved' : 'conditional';
      this.recalculateScorecard(vendor.id);
    }
    this.logAudit('portal:vendor', 'complete_assessment', 'assessments', assessmentId, {
      score: calculatedScore
    });
    this.notify();
  }

  // Multi-Channel Alert Dispatcher (WF-06 logic)
  public dispatchAlert(params: {
    severity: FindingSeverity;
    title: string;
    vendor_id?: string;
    source?: string;
    source_ref?: string;
    description?: string;
  }): AlertNotification {
    const s = params.severity;
    const route = s === 'critical' || s === 'high' ? 'slack+email' : 'slack';
    const vendor = params.vendor_id ? this.vendors.find((v) => v.id === params.vendor_id) : undefined;
    const fingerprint = [params.source || 'unknown', params.source_ref || params.title, params.vendor_id || '', s].join(
      ':'
    );

    // Redis dedupe simulation (1-hour window)
    const oneHourAgo = Date.now() - 3600000;
    const recentDuplicate = this.alerts.find(
      (a) => a.fingerprint === fingerprint && new Date(a.timestamp).getTime() > oneHourAgo
    );

    const isDeduped = !!recentDuplicate;

    const slack_text =
      `🚨 *[${s.toUpperCase()}]* ${params.title}\n` +
      (vendor ? `Proveedor: \`${vendor.legal_name}\` (${vendor.id})\n` : '') +
      `Fuente: ${params.source || 'n/a'}${params.source_ref ? ' · ' + params.source_ref : ''}\n` +
      (params.description ? `${params.description.slice(0, 300)}\n` : '');

    const email_subject = `[${s.toUpperCase()}] VRM Security Alert: ${params.title}`;
    const email_html = `
      <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: ${s === 'critical' ? '#dc2626' : s === 'high' ? '#ea580c' : '#2563eb'};">Alerta de Seguridad VRM</h2>
        <p><strong>Severidad:</strong> <span style="text-transform: uppercase;">${s}</span></p>
        <p><strong>Título:</strong> ${params.title}</p>
        ${vendor ? `<p><strong>Proveedor:</strong> ${vendor.legal_name}</p>` : ''}
        <p><strong>Fuente:</strong> ${params.source || 'n/a'} (${params.source_ref || ''})</p>
        ${params.description ? `<p style="background: #f8fafc; padding: 12px; border-left: 4px solid #94a3b8;">${params.description}</p>` : ''}
        <p style="color: #64748b; font-size: 12px;">Enviado automáticamente por el motor de automatización n8n VRM.</p>
      </div>
    `;

    const alertItem: AlertNotification = {
      id: 'alt-' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      severity: s,
      route,
      title: params.title,
      fingerprint,
      vendor_id: params.vendor_id,
      vendor_name: vendor?.legal_name,
      source: params.source,
      source_ref: params.source_ref,
      description: params.description,
      status: isDeduped ? 'deduped' : 'sent',
      slack_text,
      email_subject,
      email_html
    };

    this.alerts.unshift(alertItem);
    this.logAudit('n8n:wf-06-alerts', 'dispatch_alert', 'alerts', alertItem.id, {
      route,
      severity: s,
      status: alertItem.status,
      title: params.title
    });
    this.notify();
    return alertItem;
  }

  // Cleanup & Archiver (WF-10 logic)
  public runCleanupAndArchive(staleDays: number = 90, retentionYears: number = 1): {
    closedFindings: number;
    archivedAudit: number;
    purgedScores: number;
  } {
    const staleCutoff = new Date(Date.now() - staleDays * 86400000);
    let closedCount = 0;

    // 1. Close stale open findings
    for (const f of this.findings) {
      if (f.status === 'open' && new Date(f.detected_at) < staleCutoff) {
        f.status = 'closed';
        f.resolution = 'auto_closed_stale';
        f.closed_at = new Date().toISOString();
        closedCount++;
      }
    }

    // 2. Archive older audit log rows
    const auditCutoff = new Date(Date.now() - retentionYears * 365 * 86400000);
    const toArchive = this.auditLog.filter((a) => new Date(a.created_at) < auditCutoff);
    this.auditArchive.push(...toArchive);
    this.auditLog = this.auditLog.filter((a) => new Date(a.created_at) >= auditCutoff);

    // 3. Purge very old score history
    const scoreCutoff = new Date(Date.now() - 365 * 86400000);
    const initialScoreLen = this.scoreHistory.length;
    this.scoreHistory = this.scoreHistory.filter((sh) => new Date(sh.calculated_at) >= scoreCutoff);
    const purgedScores = initialScoreLen - this.scoreHistory.length;

    this.updateJobMeta('cleanup_archive', {
      stale_findings_closed: closedCount,
      audit_rows_archived: toArchive.length,
      scores_purged: purgedScores,
      cleaned_at: new Date().toISOString()
    });

    this.logAudit('n8n:wf-10-cleanup', 'run_cleanup', 'system', 'wf-10', {
      closedCount,
      archivedAudit: toArchive.length
    });

    this.notify();
    return {
      closedFindings: closedCount,
      archivedAudit: toArchive.length,
      purgedScores
    };
  }

  // Update Monitoring Jobs
  public updateJobMeta(jobType: MonitoringJob['job_type'], resultMeta: Record<string, any>, status: MonitoringJob['status'] = 'healthy'): void {
    const job = this.monitoringJobs.find((j) => j.job_type === jobType);
    if (job) {
      job.last_run = new Date().toISOString();
      job.status = status;
      job.result_meta = { ...job.result_meta, ...resultMeta };
    }
  }

  // Audit Log helper
  public logAudit(actor: string, action: string, entity: string, entity_id: string, details: Record<string, any>): void {
    const entry: AuditLogEntry = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      created_at: new Date().toISOString(),
      actor,
      action,
      entity,
      entity_id,
      details
    };
    this.auditLog.unshift(entry);
  }

  // Workflow Live Execution Simulator
  public async executeWorkflow(workflowId: string): Promise<WorkflowRunLog> {
    const startTime = new Date().toISOString();
    const runId = 'exec-' + Date.now().toString(36);
    let runLog: WorkflowRunLog;

    switch (workflowId) {
      case 'wf-01': {
        // NVD CVE Scanner
        const techs = this.technologies.filter((t) => t.is_active);
        const steps = [
          { nodeId: 'cron', nodeName: 'Cron 6h', status: 'success' as const, durationMs: 12, outputPreview: 'Triggered schedule window' },
          { nodeId: 'pg-window', nodeName: 'Get Window', status: 'success' as const, durationMs: 45, outputPreview: `Window: last 6h to ${new Date().toISOString()}` },
          { nodeId: 'pg-tech', nodeName: 'Get Technologies', status: 'success' as const, durationMs: 38, outputPreview: `Retrieved ${techs.length} active technologies` },
          { nodeId: 'http-nvd', nodeName: 'Query NVD 2.0 API', status: 'success' as const, durationMs: 410, outputPreview: 'Scanned CVE database for CPE matches' },
          { nodeId: 'code-parse', nodeName: 'Filter CVSS >= 7.0', status: 'success' as const, durationMs: 25, outputPreview: 'Evaluated vulnerability metrics and impact scores' },
          { nodeId: 'pg-insert', nodeName: 'Insert Findings (ON CONFLICT)', status: 'success' as const, durationMs: 65, outputPreview: 'Idempotent insertion completed' }
        ];

        // Simulate potential discovery for Cloudflare or GitHub
        const newFinding = this.addFinding({
          vendor_id: 'v-cloudflare',
          source: 'nvd',
          source_ref: `CVE-2024-${Math.floor(1000 + Math.random() * 9000)}`,
          title: 'Remote Memory Disclosure in HTTP Parser Component',
          description: 'A flaw in memory boundary validation inside the HTTP reverse proxy parsing pipeline allows an attacker to leak chunked buffers under high concurrency.',
          severity: 'high',
          status: 'open',
          evidence: {
            cve: `CVE-2024-${Math.floor(1000 + Math.random() * 9000)}`,
            cvss: 7.8,
            cpe: 'cpe:2.3:a:nginx:nginx:*:*:*:*:*:*:*:*'
          },
          due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
          closed_at: null
        });

        this.updateJobMeta('nvd', { items_scanned: techs.length, new_findings: newFinding ? 1 : 0, duration_ms: 595 });
        runLog = {
          id: runId,
          workflowId,
          workflowName: 'WF-01 NVD CVE Monitoring',
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          status: 'success',
          steps,
          summary: newFinding ? `Escaneó ${techs.length} tecnologías. Se detectó 1 nuevo CVE de severidad HIGH.` : `Escaneó ${techs.length} tecnologías. No se encontraron nuevas vulnerabilidades no registradas.`
        };
        break;
      }

      case 'wf-02': {
        // CT Logs crt.sh
        const steps = [
          { nodeId: 'cron', nodeName: 'Cron 24h', status: 'success' as const, durationMs: 10, outputPreview: 'Daily Certificate Transparency trigger' },
          { nodeId: 'pg-vendors', nodeName: 'Get Domains', status: 'success' as const, durationMs: 32, outputPreview: `Checked ${this.vendors.length} vendor domains` },
          { nodeId: 'http-crtsh', nodeName: 'Query crt.sh Logs', status: 'success' as const, durationMs: 820, outputPreview: 'Fetched 34 recent certificate transparency records' },
          { nodeId: 'code-flag', nodeName: 'Classify Sensitive Hosts', status: 'success' as const, durationMs: 35, outputPreview: 'Filtered subdomains matching (vpn|admin|staging|dev)' },
          { nodeId: 'pg-insert', nodeName: 'Insert CT Findings', status: 'success' as const, durationMs: 40, outputPreview: 'Idempotency verified against uq_finding_source' }
        ];

        this.updateJobMeta('ct_log', { certs_evaluated: 34, new_findings: 0, duration_ms: 937 });
        runLog = {
          id: runId,
          workflowId,
          workflowName: 'WF-02 CT Logs (Certificate Transparency)',
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          status: 'success',
          steps,
          summary: 'Consulta a crt.sh exitosa. Se examinaron 34 certificados de los proveedores monitoreados.'
        };
        break;
      }

      case 'wf-03': {
        // TLS Expiry
        const steps = [
          { nodeId: 'cron', nodeName: 'Cron 24h', status: 'success' as const, durationMs: 15, outputPreview: 'Daily TLS Expiry check' },
          { nodeId: 'tls-connect', nodeName: 'Native TLS Handshake', status: 'success' as const, durationMs: 350, outputPreview: 'Inspected X.509 cert chains for 5 domains' },
          { nodeId: 'eval-thresholds', nodeName: 'Evaluate <60d / <30d / <7d', status: 'success' as const, durationMs: 20, outputPreview: 'Threshold analysis completed' },
          { nodeId: 'pg-update', nodeName: 'Log Run & Findings', status: 'success' as const, durationMs: 48, outputPreview: 'Monitoring job updated' }
        ];

        this.updateJobMeta('tls_expiry', { checked_hosts: this.vendors.length, expiring_critical: 1, duration_ms: 433 });
        runLog = {
          id: runId,
          workflowId,
          workflowName: 'WF-03 TLS Expiry & Cipher Verifier',
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          status: 'success',
          steps,
          summary: 'Verificación TLS completada sin errores. Todos los endpoints activos verificados.'
        };
        break;
      }

      case 'wf-04': {
        // Attack Surface Shodan
        const steps = [
          { nodeId: 'cron', nodeName: 'Cron 24h', status: 'success' as const, durationMs: 12, outputPreview: 'Daily Attack Surface trigger' },
          { nodeId: 'dns-resolve', nodeName: 'Resolve Hostnames to IPs', status: 'success' as const, durationMs: 110, outputPreview: 'Resolved 6 hostnames' },
          { nodeId: 'shodan-query', nodeName: 'Query Shodan Host API', status: 'success' as const, durationMs: 680, outputPreview: 'Retrieved port telemetry and service banners' },
          { nodeId: 'code-ports', nodeName: 'Filter Critical Exposed Ports', status: 'success' as const, durationMs: 28, outputPreview: 'Checked ports 3389, 445, 6379, 27017, 9200' },
          { nodeId: 'notify', nodeName: 'Trigger Alert Webhook', status: 'success' as const, durationMs: 45, outputPreview: 'Alert dispatched to WF-06' }
        ];

        this.updateJobMeta('shodan', { hostnames_resolved: 6, open_ports_audited: 24, duration_ms: 875 });
        runLog = {
          id: runId,
          workflowId,
          workflowName: 'WF-04 Attack Surface (Shodan)',
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          status: 'success',
          steps,
          summary: 'Mapeo de superficie de ataque completado. Puertos de infraestructura bajo constante observación.'
        };
        break;
      }

      case 'wf-05': {
        // Re-evaluation scheduler
        const res = this.triggerReevaluationForDue();
        const steps = [
          { nodeId: 'cron', nodeName: 'Cron 6h', status: 'success' as const, durationMs: 10, outputPreview: 'Triggered 6h scheduler' },
          { nodeId: 'pg-due', nodeName: 'Find Due Vendors', status: 'success' as const, durationMs: 38, outputPreview: `Identified ${res.assessmentsCreated} vendors due for re-eval` },
          { nodeId: 'pg-reeval', nodeName: 'Create Assessment & Update Status', status: 'success' as const, durationMs: 72, outputPreview: 'Set vendor status = reevaluation' },
          { nodeId: 'sign-link', nodeName: 'Sign HMAC Portal Link', status: 'success' as const, durationMs: 18, outputPreview: 'Generated SHA256 HMAC tokens' },
          { nodeId: 'notify-backend', nodeName: 'Dispatch Vendor Email', status: 'success' as const, durationMs: 65, outputPreview: 'Assessment invites dispatched' }
        ];

        runLog = {
          id: runId,
          workflowId,
          workflowName: 'WF-05 Periodic Re-evaluation Scheduler',
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          status: 'success',
          steps,
          summary: `Se procesaron proveedores vencidos. Se crearon ${res.assessmentsCreated} nuevas evaluaciones con links firmados.`
        };
        break;
      }

      case 'wf-06': {
        // Alerts
        const alert = this.dispatchAlert({
          severity: 'high',
          title: 'Manual Alert Test via n8n WF-06 Trigger',
          source: 'manual_trigger',
          source_ref: 'test-' + Date.now().toString(36),
          description: 'Esta alerta fue disparada como prueba de verificación de canal Slack y correo electrónico.'
        });

        const steps = [
          { nodeId: 'webhook', nodeName: 'Webhook Alert Received', status: 'success' as const, durationMs: 12, outputPreview: `Header auth valid, payload parsed` },
          { nodeId: 'normalize', nodeName: 'Normalize & Route', status: 'success' as const, durationMs: 14, outputPreview: `Severity: ${alert.severity}, Route: ${alert.route}` },
          { nodeId: 'redis-get', nodeName: 'Check Dedupe in Redis', status: 'success' as const, durationMs: 22, outputPreview: `Fingerprint checked: ${alert.status}` },
          { nodeId: 'slack', nodeName: 'Post to Slack Webhook', status: 'success' as const, durationMs: 120, outputPreview: 'Block Kit formatted payload sent' },
          { nodeId: 'email', nodeName: 'Send SMTP Email', status: 'success' as const, durationMs: 190, outputPreview: 'HTML template sent to RBAC users' }
        ];

        runLog = {
          id: runId,
          workflowId,
          workflowName: 'WF-06 Multi-Channel Alert Dispatcher',
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          status: 'success',
          steps,
          summary: `Alerta procesada con éxito (Ruta: ${alert.route}). Dedupe status: ${alert.status}.`
        };
        break;
      }

      case 'wf-07': {
        // Scorecard refresh
        const res = this.recalculateAllScorecards();
        const steps = [
          { nodeId: 'cron', nodeName: 'Cron 1h', status: 'success' as const, durationMs: 10, outputPreview: 'Hourly refresh trigger' },
          { nodeId: 'pg-vendors', nodeName: 'Get Active Vendors', status: 'success' as const, durationMs: 28, outputPreview: `Found ${res.refreshed} active vendors` },
          { nodeId: 'backend-recalc', nodeName: 'Call Backend /scorecard/recalc', status: 'success' as const, durationMs: 310, outputPreview: 'All scores recalculated' },
          { nodeId: 'log-run', nodeName: 'Log Run to monitoring_jobs', status: 'success' as const, durationMs: 32, outputPreview: 'Updated score history table' }
        ];

        runLog = {
          id: runId,
          workflowId,
          workflowName: 'WF-07 Scorecard Refresh Engine',
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          status: 'success',
          steps,
          summary: `Recálculo general completado: ${res.refreshed} scorecards actualizados.`
        };
        break;
      }

      case 'wf-08': {
        // Health check
        const steps = [
          { nodeId: 'cron', nodeName: 'Cron 30m', status: 'success' as const, durationMs: 8, outputPreview: 'Deadman interval check' },
          { nodeId: 'pg-jobs', nodeName: 'Inspect monitoring_jobs', status: 'success' as const, durationMs: 32, outputPreview: `${this.monitoringJobs.length} jobs checked` },
          { nodeId: 'http-health', nodeName: 'Ping Backend /health', status: 'success' as const, durationMs: 45, outputPreview: 'HTTP 200 OK (latency: 18ms)' },
          { nodeId: 'check-overdue', nodeName: 'Evaluate Stalled Runs', status: 'success' as const, durationMs: 15, outputPreview: '0 overdue jobs detected' }
        ];

        this.updateJobMeta('health_check', { backend_status: 'online', healthy_jobs: this.monitoringJobs.length, overdue: 0 });
        runLog = {
          id: runId,
          workflowId,
          workflowName: 'WF-08 Health Check & Deadman Monitor',
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          status: 'success',
          steps,
          summary: 'Todos los servicios operacionales. Backend saludable y sin trabajos atrasados.'
        };
        break;
      }

      case 'wf-09': {
        // Weekly digest
        const steps = [
          { nodeId: 'cron', nodeName: 'Cron Monday 08:00', status: 'success' as const, durationMs: 10, outputPreview: 'Triggered weekly cadence' },
          { nodeId: 'pg-summary', nodeName: 'Query Open Findings & Risks', status: 'success' as const, durationMs: 44, outputPreview: `Aggregated findings across all vendors` },
          { nodeId: 'generate-html', nodeName: 'Render Digest Template', status: 'success' as const, durationMs: 30, outputPreview: 'Prepared executive summary' },
          { nodeId: 'send-bcc', nodeName: 'Send Email via BCC', status: 'success' as const, durationMs: 180, outputPreview: 'Dispatched to 3 security roles' }
        ];

        this.updateJobMeta('weekly_digest', { dispatched_at: new Date().toISOString(), recipients_count: 3 });
        runLog = {
          id: runId,
          workflowId,
          workflowName: 'WF-09 Weekly VRM Digest Generator',
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          status: 'success',
          steps,
          summary: 'Resumen semanal compilado y enviado a los responsables de riesgo y auditoría.'
        };
        break;
      }

      case 'wf-10': {
        // Cleanup & archive
        const res = this.runCleanupAndArchive(90, 1);
        const steps = [
          { nodeId: 'cron', nodeName: 'Cron Daily 03:00', status: 'success' as const, durationMs: 12, outputPreview: 'Maintenance schedule triggered' },
          { nodeId: 'close-stale', nodeName: 'Close Stale Findings (>90d)', status: 'success' as const, durationMs: 40, outputPreview: `Closed ${res.closedFindings} findings` },
          { nodeId: 'archive-audit', nodeName: 'Move Old Audit to Archive (>1y)', status: 'success' as const, durationMs: 65, outputPreview: `Archived ${res.archivedAudit} log entries` },
          { nodeId: 'purge-scores', nodeName: 'Prune Score History', status: 'success' as const, durationMs: 35, outputPreview: `Purged ${res.purgedScores} expired snapshots` }
        ];

        runLog = {
          id: runId,
          workflowId,
          workflowName: 'WF-10 Cleanup & Compliance Archiver',
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          status: 'success',
          steps,
          summary: `Limpieza completada: ${res.closedFindings} hallazgos cerrados, ${res.archivedAudit} registros archivados.`
        };
        break;
      }

      default: {
        // WF-00 or fallback
        const steps = [
          { nodeId: 'err-trigger', nodeName: 'Error Trigger Handler', status: 'success' as const, durationMs: 10, outputPreview: 'Captured simulated error event' },
          { nodeId: 'log-deadletter', nodeName: 'Log Dead-Letter Queue', status: 'success' as const, durationMs: 25, outputPreview: 'Stored diagnostic trace' },
          { nodeId: 'alert-relay', nodeName: 'Forward to WF-06', status: 'success' as const, durationMs: 40, outputPreview: 'Dispatched incident notification' }
        ];
        runLog = {
          id: runId,
          workflowId: 'wf-00',
          workflowName: 'WF-00 Global Error Handler',
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          status: 'success',
          steps,
          summary: 'Manejador global de errores verificado. Listo para capturar fallos no capturados.'
        };
      }
    }

    this.workflowLogs.unshift(runLog);
    if (this.workflowLogs.length > 30) this.workflowLogs.pop();
    this.notify();
    return runLog;
  }
}

export const store = new VrmStore();
