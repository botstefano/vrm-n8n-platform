import { WorkflowSummary } from '../types';

export const WORKFLOWS_REGISTRY: WorkflowSummary[] = [
  {
    id: 'wf-00',
    code: 'WF-00',
    name: 'Global Error Handler',
    trigger: 'Error Trigger',
    scheduleDescription: 'On any workflow execution failure',
    description: 'Captures runtime errors and node failures across n8n workflows, writes a failure event to the backend audit log, and relays an alert through WF-06.',
    targetSources: ['system', 'error'],
    status: 'active'
  },
  {
    id: 'wf-01',
    code: 'WF-01',
    name: 'NVD CVE Vulnerability Scanner',
    trigger: 'Cron (Every 6h)',
    scheduleDescription: 'Every 6 hours (n8n interval)',
    jobType: 'nvd',
    description: 'Queries NIST NVD API 2.0 for vendor technologies matched by CPE 2.3 expressions. Paginates CVE results and creates findings at or above NVD_MIN_CVSS.',
    targetSources: ['nvd'],
    status: 'active'
  },
  {
    id: 'wf-02',
    code: 'WF-02',
    name: 'Certificate Transparency (CT Logs)',
    trigger: 'Cron (Daily)',
    scheduleDescription: 'Every 24 hours (n8n interval)',
    jobType: 'ct_log',
    description: 'Queries crt.sh certificate transparency logs for new certificates in the lookback window. Flags shadow IT and exposed dev, staging, admin, or vpn subdomains.',
    targetSources: ['ct_log'],
    status: 'active'
  },
  {
    id: 'wf-03',
    code: 'WF-03',
    name: 'TLS Certificate Expiry Monitor',
    trigger: 'Cron (Daily)',
    scheduleDescription: 'Every 24 hours (n8n interval)',
    jobType: 'tls_expiry',
    description: 'Connects to public vendor HTTPS endpoints using the native TLS module, inspects X.509 certificates, and creates findings for certificates expiring in under 60, 30, or 7 days, or already expired. It does not currently assess weak cipher suites.',
    targetSources: ['tls_expiry'],
    status: 'active'
  },
  {
    id: 'wf-04',
    code: 'WF-04',
    name: 'Attack Surface & Shodan Scanner',
    trigger: 'Cron (Daily)',
    scheduleDescription: 'Every 24 hours (n8n interval)',
    jobType: 'shodan',
    description: 'Resolves vendor hostnames to public IP addresses and inspects the Shodan Host API. Flags dangerous exposed ports and CVEs associated with observed banners.',
    targetSources: ['shodan'],
    status: 'active'
  },
  {
    id: 'wf-05',
    code: 'WF-05',
    name: 'Periodic Re-evaluation Scheduler',
    trigger: 'Cron (Every 6h)',
    scheduleDescription: 'Every 6 hours (n8n interval)',
    description: 'Detects vendors due for security reevaluation according to criticality (Critical: 90 days, High: 180 days, Others: 365 days). Generates HMAC-SHA256 signed portal link and creates assessment.',
    targetSources: ['assessment'],
    status: 'active'
  },
  {
    id: 'wf-06',
    code: 'WF-06',
    name: 'Multi-Channel Alert Dispatcher',
    trigger: 'Webhook POST /webhook/vrm-alerts',
    scheduleDescription: 'Real-time on finding creation / incident',
    description: 'Applies Redis fingerprint deduplication (1h window). Formats and routes rich Slack Block Kit alerts and HTML emails to RBAC security analysts and admins.',
    targetSources: ['alerts'],
    status: 'active'
  },
  {
    id: 'wf-07',
    code: 'WF-07',
    name: 'Scorecard Refresh Engine',
    trigger: 'Cron (Hourly)',
    scheduleDescription: 'Every hour (n8n interval)',
    jobType: 'scorecard_refresh_all',
    description: 'Triggers backend recalculation for active vendors using finding severity, vendor criticality, overdue reevaluation and pending assessments. Updates score history.',
    targetSources: ['scorecard'],
    status: 'active'
  },
  {
    id: 'wf-08',
    code: 'WF-08',
    name: 'Health Check & Deadman Monitor',
    trigger: 'Cron (Every 30m)',
    scheduleDescription: 'Every 30 minutes (n8n interval)',
    description: 'Inspects monitoring_jobs table for stalled or overdue automation runs. Pings VRM backend /health endpoint and dispatches critical alert if services degrade.',
    targetSources: ['health'],
    status: 'active'
  },
  {
    id: 'wf-09',
    code: 'WF-09',
    name: 'Weekly VRM Digest Generator',
    trigger: 'Cron (Mondays 08:00)',
    scheduleDescription: 'Every Monday at 08:00 America/Lima (0 8 * * 1)',
    description: 'Compiles an executive summary of vendor risk distribution, open and overdue findings, recent findings, closures, and the ten highest-risk vendors; emails active VRM roles in BCC.',
    targetSources: ['digest'],
    status: 'active'
  },
  {
    id: 'wf-10',
    code: 'WF-10',
    name: 'Cleanup & Compliance Archiver',
    trigger: 'Cron (Daily 03:00)',
    scheduleDescription: 'Daily at 03:00 America/Lima (0 3 * * *)',
    jobType: 'cleanup_archive',
    description: 'Auto-closes open findings whose due date is older than STALE_FINDING_DAYS, archives audit_log rows older than AUDIT_RETENTION_YEARS, and purges score history older than SCORE_RETENTION_YEARS.',
    targetSources: ['cleanup'],
    status: 'active'
  }
];
