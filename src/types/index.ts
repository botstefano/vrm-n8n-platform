export type VendorStatus =
  | 'onboarding'
  | 'approved'
  | 'conditional'
  | 'monitoring'
  | 'incident'
  | 'reevaluation'
  | 'suspended'
  | 'offboarded';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'minimal';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type FindingStatus = 'open' | 'in_progress' | 'accepted' | 'closed';

export type FindingSource = 'nvd' | 'ct_log' | 'tls_expiry' | 'shodan' | 'manual';

export interface VendorContact {
  name?: string;
  email: string;
  phone?: string;
  role?: string;
}

export interface Vendor {
  id: string;
  legal_name: string;
  website: string;
  status: VendorStatus;
  criticality: number; // 1 to 5
  current_risk: RiskLevel;
  current_score: number; // 0.00 to 100.00
  next_evaluation: string | null;
  primary_contact: VendorContact;
  created_at: string;
  updated_at: string;
}

export interface VendorTechnology {
  id: string;
  vendor_id: string;
  product_name: string;
  cpe_match: string;
  is_active: boolean;
}

export interface Questionnaire {
  id: string;
  name: string;
  version: number;
  is_active: boolean;
  sections?: {
    id: string;
    title: string;
    questions: {
      id: string;
      text: string;
      weight: number;
    }[];
  }[];
}

export interface Assessment {
  id: string;
  vendor_id: string;
  questionnaire_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'expired';
  started_at: string | null;
  completed_at: string | null;
  score?: number | null;
  portal_token?: string;
}

export interface VendorFinding {
  id: string;
  vendor_id: string;
  source: FindingSource;
  source_ref: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  status: FindingStatus;
  evidence: Record<string, any>;
  resolution?: string | null;
  detected_at: string;
  due_date: string | null;
  closed_at: string | null;
}

export interface MonitoringJob {
  id: number;
  vendor_id: string | null;
  job_type: 'nvd' | 'ct_log' | 'tls_expiry' | 'shodan' | 'scorecard_refresh_all' | 'cleanup_archive' | 'health_check' | 'weekly_digest';
  last_run: string | null;
  next_run: string | null;
  status: 'healthy' | 'running' | 'overdue' | 'failed' | 'idle';
  result_meta: Record<string, any>;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
}

export interface AuditLogEntry {
  id: number;
  created_at: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string;
  details: Record<string, any>;
}

export interface ScoreHistoryEntry {
  id: number;
  vendor_id: string;
  score: number;
  risk: RiskLevel;
  calculated_at: string;
}

export interface AlertNotification {
  id: string;
  timestamp: string;
  severity: FindingSeverity;
  route: 'slack' | 'slack+email';
  title: string;
  fingerprint: string;
  vendor_id?: string;
  vendor_name?: string;
  source?: string;
  source_ref?: string;
  description?: string;
  status: 'sent' | 'deduped';
  slack_text?: string;
  email_subject?: string;
  email_html?: string;
}

export interface WorkflowSummary {
  id: string;
  code: string;
  name: string;
  trigger: string;
  scheduleDescription: string;
  jobType?: string;
  description: string;
  targetSources: string[];
  status: 'active' | 'inactive';
}
