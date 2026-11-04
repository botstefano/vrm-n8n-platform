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
  FindingSeverity,
  FindingStatus,
} from '../types';
import { apiRequest } from './api';

function createId(): string { return crypto.randomUUID(); }

function escapeHtml(value: unknown): string {
  const entities: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  };
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
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
    this.listeners.forEach((l) => l());
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
        this.remote(apiRequest(`/api/findings/${existing.id}`, {
          method: 'PATCH', body: { severity: findingData.severity }
        }));
        this.dispatchAlert({
          severity: findingData.severity,
          title: `[ESCALATED] ${findingData.title}`,
          vendor_id: findingData.vendor_id,
          source: findingData.source,
          source_ref: findingData.source_ref,
          description: findingData.description
        });
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
      this.remote(apiRequest(`/api/findings/${id}`, { method: 'PATCH', body: { status, resolution, due_date: f.due_date } }));
      this.notify();
    }
  }

  // Re-evaluation creation is server-side; signing secrets never run in the browser.
  public async triggerReevaluationForDue(): Promise<{ assessmentsCreated: number; assessments?: Assessment[] }> {
    const result = await apiRequest<{ assessmentsCreated: number; assessments?: Assessment[] }>(
      '/api/assessments/reevaluate', { method: 'POST', body: {} }
    );
    await this.hydrateFromApi();
    return result;
  }

  public async completeAssessment(
    assessmentId: string,
    calculatedScore: number = 88,
    responses: Record<string, boolean> = {}
  ): Promise<void> {
    await apiRequest(`/api/assessments/${assessmentId}/complete`, {
      method: 'POST',
      body: { score: calculatedScore, responses }
    });
    await this.hydrateFromApi();
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
        <p><strong>Severidad:</strong> <span style="text-transform: uppercase;">${escapeHtml(s)}</span></p>
        <p><strong>Título:</strong> ${escapeHtml(params.title)}</p>
        ${vendor ? `<p><strong>Proveedor:</strong> ${escapeHtml(vendor.legal_name)}</p>` : ''}
        <p><strong>Fuente:</strong> ${escapeHtml(params.source || 'n/a')} (${escapeHtml(params.source_ref || '')})</p>
        ${params.description ? `<p style="background: #f8fafc; padding: 12px; border-left: 4px solid #94a3b8;">${escapeHtml(params.description)}</p>` : ''}
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
      status: isDeduped ? 'deduped' : 'pending',
      slack_text,
      email_subject,
      email_html
    };

    this.alerts.unshift(alertItem);
    this.remote(apiRequest<any>('/api/alerts', { method: 'POST', body: params }).then((saved) => {
      const index = this.alerts.findIndex((item) => item.id === alertItem.id);
      if (index >= 0) {
        this.alerts[index] = { ...this.alerts[index], id: saved.id, timestamp: saved.timestamp, status: saved.status };
        this.notify();
      }
      return saved;
    }));
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
  public async runCleanupAndArchive(staleDays: number = 90, retentionYears: number = 5): Promise<{
    closedFindings: number;
    archivedAudit: number;
    purgedScores: number;
  }> {
    const result = await apiRequest<{
      closedFindings: number;
      archivedAudit: number;
      purgedScores: number;
    }>('/api/cleanup', { method: 'POST', body: { staleDays, retentionYears } });
    await this.hydrateFromApi();
    return result;
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

  // Manual runs are delegated to n8n; no simulated successful workflow runs.
  public async executeWorkflow(workflowId: string): Promise<WorkflowRunLog> {
    const startedAt = new Date().toISOString();
    const response = await apiRequest<{ status: string; workflowCode: string }>(
      `/api/workflows/${encodeURIComponent(workflowId)}/execute`,
      { method: 'POST', body: {} }
    );
    const entry: WorkflowRunLog = {
      id: createId(), workflowId, workflowName: workflowId.toUpperCase(),
      startedAt, status: 'running', steps: [],
      summary: response.status === 'accepted'
        ? 'n8n aceptó la solicitud. El resultado final se registrará cuando el workflow termine.'
        : 'Solicitud recibida por el servicio de automatización.'
    };
    this.workflowLogs.unshift(entry);
    this.notify();
    return entry;
  }
}

export const store = new VrmStore();
