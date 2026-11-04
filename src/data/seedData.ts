import { WorkflowSummary } from '../types';

export const WORKFLOWS_REGISTRY: WorkflowSummary[] = [
  {
    id: 'wf-00',
    code: 'WF-00',
    name: 'Global Error Handler',
    trigger: 'Error Trigger',
    scheduleDescription: 'On any workflow execution failure',
    description: 'Captures runtime errors and node failures across all n8n workflows, registers dead-letters and relays failure alerts to WF-06 and the backend.',
    targetSources: ['system', 'error'],
    status: 'active'
  },
  {
    id: 'wf-01',
    code: 'WF-01',
    name: 'NVD CVE Vulnerability Scanner',
    trigger: 'Cron (Every 6h)',
    scheduleDescription: 'Every 6 hours (0 */6 * * *)',
    jobType: 'nvd',
    description: 'Queries NIST NVD API 2.0 for vendor technologies matched by CPE 2.3 expressions. Identifies new CVEs with CVSS >= NVD_MIN_CVSS and creates vendor findings.',
    targetSources: ['nvd'],
    status: 'active'
  },
  {
    id: 'wf-02',
    code: 'WF-02',
    name: 'Certificate Transparency (CT Logs)',
    trigger: 'Cron (Daily)',
    scheduleDescription: 'Every 24 hours (0 0 * * *)',
    jobType: 'ct_log',
    description: 'Queries crt.sh certificate transparency logs for new certificates in the lookback window. Flags shadow IT and exposed dev, staging, admin, or vpn subdomains.',
    targetSources: ['ct_log'],
    status: 'active'
  },
  {
    id: 'wf-03',
    code: 'WF-03',
    name: 'TLS Expiry & Cipher Verifier',
    trigger: 'Cron (Daily)',
    scheduleDescription: 'Every 24 hours (0 1 * * *)',
    jobType: 'tls_expiry',
    description: 'Connects directly to vendor HTTPS endpoints using node tls module. Flags expiring certs (<60, <30, <7 days or expired) and weak ciphers with idempotent alerts.',
    targetSources: ['tls_expiry'],
    status: 'active'
  },
  {
    id: 'wf-04',
    code: 'WF-04',
    name: 'Attack Surface & Shodan Scanner',
    trigger: 'Cron (Daily)',
    scheduleDescription: 'Every 24 hours (0 2 * * *)',
    jobType: 'shodan',
    description: 'Resolves vendor hostnames to IP ranges and inspects Shodan API. Flags dangerous exposed ports (RDP 3389, SMB 445, Redis 6379, MongoDB, Elasticsearch) and banner CVEs.',
    targetSources: ['shodan'],
    status: 'active'
  },
  {
    id: 'wf-05',
    code: 'WF-05',
    name: 'Periodic Re-evaluation Scheduler',
    trigger: 'Cron (Every 6h)',
    scheduleDescription: 'Every 6 hours (0 */6 * * *)',
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
    scheduleDescription: 'Every hour (0 * * * *)',
    jobType: 'scorecard_refresh_all',
    description: 'Triggers backend recalculation for all active vendors based on open findings severity, questionnaire compliance, and criticality weighting. Updates score history.',
    targetSources: ['scorecard'],
    status: 'active'
  },
  {
    id: 'wf-08',
    code: 'WF-08',
    name: 'Health Check & Deadman Monitor',
    trigger: 'Cron (Every 30m)',
    scheduleDescription: 'Every 30 minutes (*/30 * * * *)',
    jobType: 'health_check',
    description: 'Inspects monitoring_jobs table for stalled or overdue automation runs. Pings VRM backend /health endpoint and dispatches critical alert if services degrade.',
    targetSources: ['health'],
    status: 'active'
  },
  {
    id: 'wf-09',
    code: 'WF-09',
    name: 'Weekly VRM Digest Generator',
    trigger: 'Cron (Mondays 08:00)',
    scheduleDescription: 'Every Monday at 08:00 UTC (0 8 * * 1)',
    jobType: 'weekly_digest',
    description: 'Compiles an executive summary of critical open findings, high-risk vendors, overdue assessments, and system metrics; emails security stakeholders in BCC.',
    targetSources: ['digest'],
    status: 'active'
  },
  {
    id: 'wf-10',
    code: 'WF-10',
    name: 'Cleanup & Compliance Archiver',
    trigger: 'Cron (Daily 03:00)',
    scheduleDescription: 'Daily at 03:00 UTC (0 3 * * *)',
    jobType: 'cleanup_archive',
    description: 'Auto-closes findings older than STALE_FINDING_DAYS marked as auto_closed_stale, moves audit_log older than AUDIT_RETENTION_YEARS into audit_log_archive, and trims score history.',
    targetSources: ['cleanup'],
    status: 'active'
  }
];
