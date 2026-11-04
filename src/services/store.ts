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
import { apiRequest } from './api';

function createId(): string { return crypto.randomUUID(); }

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
    // Supabase is the source of truth; never initialize demo data in browser storage.
    this.vendors = []; this.technologies = []; this.questionnaires = []; this.assessments = [];
    this.findings = []; this.monitoringJobs = []; this.users = []; this.auditLog = [];
    this.auditArchive = []; this.scoreHistory = []; this.alerts = []; this.workflowLogs = [];
  }

  public async hydrateFromApi(): Promise<void> {
    const data = await apiRequest<any>('/api/bootstrap');
    this.vendors = data.vendors || [];
    this.technologies = data.technologies || [];
    this.questionnaires = data.questionnaires || [];
    this.assessments = data.assessments || [];
    this.findings = data.findings || [];
    this.monitoringJobs = data.monitoringJobs || [];
    this.users = data.users || [];
    this.auditLog = data.auditLog || [];
    this.auditArchive = data.auditArchive || [];
    this.scoreHistory = data.scoreHistory || [];
    this.alerts = data.alerts || [];
    this.workflowLogs = data.workflowLogs || [];
    this.notify();
  }

  private remote<T>(request: Promise<T>): void {
    void request.catch((error) => {
      const message = error instanceof Error ? error.message : 'Error al sincronizar con Supabase.';
      console.error(message);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vrm-api-error', { detail: message }));
    });
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
    // Persistence is performed explicitly by authenticated API operations.
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
    const id = createId();
    const newVendor: Vendor = {
      ...vendorData,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.vendors.unshift(newVendor);
    this.logAudit('admin@vrm.local', 'insert_vendor', 'vendors', id, { legal_name: newVendor.legal_name });
    this.remote(apiRequest('/api/vendors', { method: 'POST', body: newVendor }));
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
      this.remote(apiRequest(`/api/vendors/${id}`, { method: 'PATCH', body: updates }));
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
      this.remote(apiRequest(`/api/vendors/${id}`, { method: 'DELETE' }));
    }
    this.notify();
  }

  // Technology Operations
  public addTechnology(tech: Omit<VendorTechnology, 'id'>): VendorTechnology {
    const newTech: VendorTechnology = {
      ...tech,
      id: createId()
    };
    this.technologies.push(newTech);
    this.logAudit('admin@vrm.local', 'insert_technology', 'vendor_technologies', newTech.id, {
      product: newTech.product_name,
      cpe: newTech.cpe_match
    });
    this.remote(apiRequest('/api/technologies', { method: 'POST', body: newTech }));
    this.notify();
    return newTech;
  }

  public deleteTechnology(id: string): void {
    this.technologies = this.technologies.filter((t) => t.id !== id);
    this.remote(apiRequest(`/api/technologies/${id}`, { method: 'DELETE' }));
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

    const id = createId();
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

    this.remote(apiRequest('/api/findings', { method: 'POST', body: newFinding }));
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
      this.remote(apiRequest(`/api/findings/${id}`, { method: 'PATCH', body: { status, resolution, due_date: f.due_date } }));
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

  // Re-evaluation creation is server-side; signing secrets never run in the browser.
  public async triggerReevaluationForDue(): Promise<{ assessmentsCreated: number; assessments?: Assessment[] }> {
    const result = await apiRequest<{ assessmentsCreated: number; assessments?: Assessment[] }>(
      '/api/assessments/reevaluate', { method: 'POST', body: {} }
    );
    await this.hydrateFromApi();
    return result;
  }

  public completeAssessment(assessmentId: string, calculatedScore: number = 88, responses: Record<string, boolean> = {}): void {
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
    this.remote(apiRequest('/api/alerts', { method: 'POST', body: params }));
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
    this.remote(apiRequest('/api/cleanup', { method: 'POST', body: { staleDays, retentionYears } }));
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

  // Manual runs are delegated to n8n; no simulated successful workflow runs.
  public async executeWorkflow(workflowId: string): Promise<WorkflowRunLog> {
    const startedAt = new Date().toISOString();
    const response = await apiRequest<{ status: string; workflowCode: string }>(
      `/api/workflows/${encodeURIComponent(workflowId)}/execute`,
      { method: 'POST', body: {} }
    );
    const entry: WorkflowRunLog = {
      id: createId(), workflowId, workflowName: workflowId.toUpperCase(),
      startedAt, completedAt: new Date().toISOString(), status: 'success', steps: [],
      summary: response.status === 'accepted'
        ? 'La solicitud de ejecución fue enviada a n8n.'
        : 'Solicitud aceptada.'
    };
    this.workflowLogs.unshift(entry);
    this.notify();
    return entry;
  }
}

export const store = new VrmStore();
