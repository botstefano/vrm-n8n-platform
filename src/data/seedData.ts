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
  WorkflowSummary
} from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'u-1',
    email: 'admin@vrm.local',
    full_name: 'Admin VRM (CISO)',
    is_active: true,
    roles: ['admin']
  },
  {
    id: 'u-2',
    email: 'analista@vrm.local',
    full_name: 'Analista VRM (SecOps)',
    is_active: true,
    roles: ['risk_analyst']
  },
  {
    id: 'u-3',
    email: 'auditor@vrm.local',
    full_name: 'Auditor VRM (Compliance)',
    is_active: true,
    roles: ['auditor']
  }
];

export const INITIAL_QUESTIONNAIRES: Questionnaire[] = [
  {
    id: 'q-1',
    name: 'Cuestionario de seguridad estándar (ISO 27001 / SOC 2)',
    version: 1,
    is_active: true,
    sections: [
      {
        id: 'sec-1',
        title: 'Gobernanza y Políticas de Seguridad',
        questions: [
          { id: 'q1-1', text: '¿Cuenta la organización con una certificación SOC 2 Tipo II o ISO 27001 vigente?', weight: 25 },
          { id: 'q1-2', text: '¿Se realizan revisiones periódicas de políticas de seguridad al menos anualmente?', weight: 15 }
        ]
      },
      {
        id: 'sec-2',
        title: 'Cifrado y Gestión de Accesos',
        questions: [
          { id: 'q2-1', text: '¿Se exige Autenticación Multifactor (MFA) obligatoria en todos los accesos administrativos?', weight: 25 },
          { id: 'q2-2', text: '¿Los datos en tránsito están cifrados con TLS 1.2+ y en reposo con AES-256?', weight: 20 },
          { id: 'q2-3', text: '¿Existe rotación de credenciales y secretos de API automatizada?', weight: 15 }
        ]
      }
    ]
  }
];

export const INITIAL_VENDORS: Vendor[] = [
  {
    id: 'v-github',
    legal_name: 'GitHub, Inc.',
    website: 'https://github.com',
    status: 'approved',
    criticality: 4,
    current_risk: 'low',
    current_score: 82.5,
    next_evaluation: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // due 1 day ago
    primary_contact: {
      name: 'GitHub Security Team',
      email: 'security@github.example',
      role: 'Product Security'
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'v-cloudflare',
    legal_name: 'Cloudflare, Inc.',
    website: 'https://www.cloudflare.com',
    status: 'monitoring',
    criticality: 5,
    current_risk: 'medium',
    current_score: 64.0,
    next_evaluation: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    primary_contact: {
      name: 'Cloudflare Trust & Safety',
      email: 'security@cloudflare.example',
      role: 'Director of Compliance'
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'v-example',
    legal_name: 'Example Corp',
    website: 'https://example.com',
    status: 'conditional',
    criticality: 2,
    current_risk: 'high',
    current_score: 38.0,
    next_evaluation: null,
    primary_contact: {
      name: 'IT Admin',
      email: 'admin@example.com',
      role: 'Infrastructure Lead'
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'v-datadog',
    legal_name: 'Datadog Observability',
    website: 'https://www.datadoghq.com',
    status: 'approved',
    criticality: 4,
    current_risk: 'minimal',
    current_score: 95.0,
    next_evaluation: new Date(Date.now() + 1000 * 60 * 60 * 24 * 75).toISOString(),
    primary_contact: {
      name: 'Datadog Security',
      email: 'sec-vendor@datadoghq.example',
      role: 'Vendor Risk'
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 200).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'v-stripe',
    legal_name: 'Stripe Payments',
    website: 'https://stripe.com',
    status: 'approved',
    criticality: 5,
    current_risk: 'low',
    current_score: 89.0,
    next_evaluation: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString(),
    primary_contact: {
      name: 'Stripe Compliance',
      email: 'compliance@stripe.example',
      role: 'Security Assurance'
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 300).toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const INITIAL_TECHNOLOGIES: VendorTechnology[] = [
  {
    id: 'vt-1',
    vendor_id: 'v-cloudflare',
    product_name: 'nginx',
    cpe_match: 'cpe:2.3:a:nginx:nginx:*:*:*:*:*:*:*:*',
    is_active: true
  },
  {
    id: 'vt-2',
    vendor_id: 'v-github',
    product_name: 'OpenSSL',
    cpe_match: 'cpe:2.3:a:openssl:openssl:*:*:*:*:*:*:*:*',
    is_active: true
  },
  {
    id: 'vt-3',
    vendor_id: 'v-example',
    product_name: 'Apache HTTP Server',
    cpe_match: 'cpe:2.3:a:apache:http_server:2.4.49:*:*:*:*:*:*:*',
    is_active: true
  },
  {
    id: 'vt-4',
    vendor_id: 'v-datadog',
    product_name: 'Go',
    cpe_match: 'cpe:2.3:a:golang:go:1.22.*:*:*:*:*:*:*:*',
    is_active: true
  }
];

export const INITIAL_FINDINGS: VendorFinding[] = [
  {
    id: 'f-1',
    vendor_id: 'v-cloudflare',
    source: 'nvd',
    source_ref: 'CVE-2023-44487',
    title: 'HTTP/2 Rapid Reset Attack (DoS)',
    description: 'The HTTP/2 protocol allows a denial of service (server resource consumption) because request cancellation can reset many streams quickly, as exploited in the wild in August through October 2023.',
    severity: 'high',
    status: 'open',
    evidence: {
      cve: 'CVE-2023-44487',
      cvss: 7.5,
      cpe: 'cpe:2.3:a:nginx:nginx:*:*:*:*:*:*:*:*',
      vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H'
    },
    detected_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 12).toISOString(),
    closed_at: null
  },
  {
    id: 'f-2',
    vendor_id: 'v-cloudflare',
    source: 'ct_log',
    source_ref: 'ct:admin-vpn.cloudflare.example:cert_98124',
    title: 'Exposición de subdominio sensible detectado en Certificate Transparency',
    description: 'Nuevo certificado emitido en crt.sh para host clasificado como administrativo/sensible: admin-vpn.cloudflare.example',
    severity: 'medium',
    status: 'open',
    evidence: {
      domain: 'admin-vpn.cloudflare.example',
      issuer: "Let's Encrypt Authority X3",
      serial_number: '04a298fbb12c849103',
      not_before: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString()
    },
    detected_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    closed_at: null
  },
  {
    id: 'f-3',
    vendor_id: 'v-example',
    source: 'tls_expiry',
    source_ref: 'tls:example.com:expires_in_6d',
    title: 'Certificado TLS caduca en menos de 7 días',
    description: 'El certificado X.509 de producción para example.com expira en 6 días y no se ha detectado renovación automática.',
    severity: 'critical',
    status: 'open',
    evidence: {
      host: 'example.com',
      port: 443,
      days_remaining: 6,
      valid_to: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString(),
      issuer: 'DigiCert Global Root CA'
    },
    detected_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
    closed_at: null
  },
  {
    id: 'f-4',
    vendor_id: 'v-example',
    source: 'shodan',
    source_ref: 'shodan:93.184.216.34:3389',
    title: 'Puerto RDP (3389) expuesto a Internet público',
    description: 'Shodan detectó el puerto de Remote Desktop Protocol (RDP) abierto con autenticación NTLM en IP asociada al proveedor.',
    severity: 'critical',
    status: 'in_progress',
    evidence: {
      ip: '93.184.216.34',
      port: 3389,
      protocol: 'ms-wbt-server',
      service: 'Microsoft Remote Desktop',
      banner: 'Target_Name: EXAMPLE-DC'
    },
    detected_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    closed_at: null
  },
  {
    id: 'f-5',
    vendor_id: 'v-github',
    source: 'nvd',
    source_ref: 'CVE-2023-0286',
    title: 'OpenSSL X.400 address type confusion vulnerability',
    description: 'There is a type confusion vulnerability relating to X.400 address processing inside an X.509 GeneralName.',
    severity: 'medium',
    status: 'closed',
    evidence: {
      cve: 'CVE-2023-0286',
      cvss: 5.5,
      resolved_version: 'OpenSSL 3.0.8'
    },
    resolution: 'Actualizado a versión mitigada 3.0.8',
    detected_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    due_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    closed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 28).toISOString()
  }
];

export const INITIAL_ASSESSMENTS: Assessment[] = [
  {
    id: 'asm-1',
    vendor_id: 'v-github',
    questionnaire_id: 'q-1',
    status: 'completed',
    started_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
    completed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 85).toISOString(),
    score: 88,
    portal_token: 'eyJhbGciOiJIUzI1NiJ9.eyJhaWQiOiJhc20tMSJ9.verified'
  },
  {
    id: 'asm-2',
    vendor_id: 'v-cloudflare',
    questionnaire_id: 'q-1',
    status: 'completed',
    started_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
    completed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 115).toISOString(),
    score: 92,
    portal_token: 'eyJhbGciOiJIUzI1NiJ9.eyJhaWQiOiJhc20tMiJ9.verified'
  }
];

export const INITIAL_MONITORING_JOBS: MonitoringJob[] = [
  {
    id: 1,
    vendor_id: null,
    job_type: 'nvd',
    last_run: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    next_run: new Date(Date.now() + 1000 * 60 * 285).toISOString(),
    status: 'healthy',
    result_meta: { items_checked: 4, findings_created: 1, elapsed_ms: 1420 }
  },
  {
    id: 2,
    vendor_id: null,
    job_type: 'ct_log',
    last_run: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    next_run: new Date(Date.now() + 1000 * 60 * 1260).toISOString(),
    status: 'healthy',
    result_meta: { certs_parsed: 28, subdomains_flagged: 1 }
  },
  {
    id: 3,
    vendor_id: null,
    job_type: 'tls_expiry',
    last_run: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    next_run: new Date(Date.now() + 1000 * 60 * 1200).toISOString(),
    status: 'healthy',
    result_meta: { endpoints_scanned: 5, expiring_soon: 1, expired: 0 }
  },
  {
    id: 4,
    vendor_id: null,
    job_type: 'shodan',
    last_run: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    next_run: new Date(Date.now() + 1000 * 60 * 1140).toISOString(),
    status: 'healthy',
    result_meta: { ips_resolved: 5, dangerous_ports_found: 1 }
  },
  {
    id: 5,
    vendor_id: null,
    job_type: 'scorecard_refresh_all',
    last_run: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    next_run: new Date(Date.now() + 1000 * 60 * 35).toISOString(),
    status: 'healthy',
    result_meta: { vendors_refreshed: 5, scores_adjusted: 2 }
  },
  {
    id: 6,
    vendor_id: null,
    job_type: 'health_check',
    last_run: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    next_run: new Date(Date.now() + 1000 * 60 * 25).toISOString(),
    status: 'healthy',
    result_meta: { backend_ping_ms: 18, overdue_jobs: 0 }
  },
  {
    id: 7,
    vendor_id: null,
    job_type: 'cleanup_archive',
    last_run: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    next_run: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
    status: 'healthy',
    result_meta: { stale_findings_closed: 0, audit_rows_archived: 14 }
  }
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 101,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    actor: 'n8n:wf-01-nvd-cve',
    action: 'insert_finding',
    entity: 'vendor_findings',
    entity_id: 'f-1',
    details: { cve: 'CVE-2023-44487', vendor: 'Cloudflare, Inc.', severity: 'high' }
  },
  {
    id: 102,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    actor: 'n8n:wf-03-tls-expiry',
    action: 'insert_finding',
    entity: 'vendor_findings',
    entity_id: 'f-3',
    details: { host: 'example.com', days_remaining: 6, severity: 'critical' }
  },
  {
    id: 103,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    actor: 'admin@vrm.local',
    action: 'update_status',
    entity: 'vendor_findings',
    entity_id: 'f-4',
    details: { from: 'open', to: 'in_progress', comment: 'Ticket JIRA-SEC-412 asignado' }
  }
];

export const INITIAL_SCORE_HISTORY: ScoreHistoryEntry[] = [
  { id: 1, vendor_id: 'v-github', score: 85.0, risk: 'low', calculated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString() },
  { id: 2, vendor_id: 'v-github', score: 82.5, risk: 'low', calculated_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
  { id: 3, vendor_id: 'v-cloudflare', score: 78.0, risk: 'medium', calculated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString() },
  { id: 4, vendor_id: 'v-cloudflare', score: 64.0, risk: 'medium', calculated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
  { id: 5, vendor_id: 'v-example', score: 55.0, risk: 'medium', calculated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString() },
  { id: 6, vendor_id: 'v-example', score: 38.0, risk: 'high', calculated_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() }
];

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
