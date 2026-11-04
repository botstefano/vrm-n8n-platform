import React, { useState } from 'react';
import {
  Cpu,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  Code,
  Layers,
  ChevronRight,
  ExternalLink,
  Radio,
  Globe2,
  Lock,
  KeyRound,
  FileCheck2,
  Bell,
  TrendingUp,
  Activity,
  Calendar,
  Trash2,
  Terminal,
  Check,
  Copy
} from 'lucide-react';
import { WORKFLOWS_REGISTRY } from '../data/seedData';
import { WorkflowSummary, MonitoringJob } from '../types';
import { store, WorkflowRunLog } from '../services/store';

interface WorkflowsViewProps {
  jobs: MonitoringJob[];
  logs: WorkflowRunLog[];
  onExecuteWorkflow: (wfId: string) => Promise<void>;
  isExecuting: boolean;
  executingWfId: string | null;
  canWrite: boolean;
  isAdmin: boolean;
}

export const WorkflowsView: React.FC<WorkflowsViewProps> = ({
  jobs,
  logs,
  onExecuteWorkflow,
  isExecuting,
  executingWfId,
  canWrite,
  isAdmin
}) => {
  const [selectedWfId, setSelectedWfId] = useState<string>('wf-01');
  const [activeTab, setActiveTab] = useState<'pipeline' | 'logs' | 'n8n_json'>('pipeline');
  const [copiedJson, setCopiedJson] = useState(false);

  const selectedWf = WORKFLOWS_REGISTRY.find((w) => w.id === selectedWfId) || WORKFLOWS_REGISTRY[0];
  const associatedJob = selectedWf.jobType ? jobs.find((j) => j.job_type === selectedWf.jobType) : undefined;
  const recentLogs = logs.filter((l) => l.workflowId === selectedWfId);

  // Workflow pipeline visual node definitions
  const getPipelineNodes = (wfId: string) => {
    switch (wfId) {
      case 'wf-00':
        return [
          { name: 'Error Trigger', type: 'Trigger', desc: 'Captura fallos de cualquier workflow' },
          { name: 'Build Payload', type: 'Code JS', desc: 'Extrae workflow, ejecución, nodo y mensaje de error' },
          { name: 'WF-06 Alert Webhook', type: 'HTTP Webhook', desc: 'Reenvía el incidente a Slack/Email' },
          { name: 'Report Backend', type: 'HTTP', desc: 'Registra el evento en la auditoría de la API' }
        ];
      case 'wf-01':
        return [
          { name: 'Cron 6h', type: 'Schedule', desc: '0 */6 * * *' },
          { name: 'Get Window', type: 'Postgres', desc: 'Ventana desde última ejecución' },
          { name: 'Get Technologies', type: 'Postgres', desc: 'CPEs activos (cpe:2.3:a:...)' },
          { name: 'Query NVD 2.0 API', type: 'HTTP Request', desc: 'Paginación por startIndex, 2.000 CVE por página' },
          { name: 'Upsert Findings', type: 'Postgres', desc: 'Deduplica por proveedor/CVE y actualiza si escala la severidad' },
          { name: 'Notify Severe', type: 'Condition / Alert', desc: 'Dispara WF-06 si CVSS >= 7' }
        ];
      case 'wf-02':
        return [
          { name: 'Cron 24h', type: 'Schedule', desc: 'Cada 24 horas desde la activación' },
          { name: 'Get Domains', type: 'Postgres', desc: 'Dominios de proveedores' },
          { name: 'Query crt.sh API', type: 'HTTP Request', desc: 'Certificate Transparency logs' },
          { name: 'Filter Subdomains', type: 'Code JS', desc: 'Clasifica dev|staging|admin|vpn' },
          { name: 'Insert CT Findings', type: 'Postgres', desc: 'Inserta hallazgos con evidencia' },
          { name: 'Log Run', type: 'Postgres', desc: 'Actualiza monitoring_jobs' }
        ];
      case 'wf-03':
        return [
          { name: 'Cron 24h', type: 'Schedule', desc: 'Cada 24 horas desde la activación' },
          { name: 'Get Active Endpoints', type: 'Postgres', desc: 'Hosts HTTPS de proveedores activos' },
          { name: 'TLS Certificate Probe', type: 'Code (tls)', desc: 'Inspecciona certificado X.509 y fecha de expiración; no evalúa cifrados débiles' },
          { name: 'Check Thresholds', type: 'IF Node', desc: '<60 días, <30 días, <7 días, vencido' },
          { name: 'Upsert Finding', type: 'Postgres', desc: 'Alerta solo si escala de severidad' }
        ];
      case 'wf-04':
        return [
          { name: 'Cron 24h', type: 'Schedule', desc: 'Cada 24 horas desde la activación' },
          { name: 'Resolve Hostnames', type: 'Code (dns)', desc: 'Resuelve IP pública y bloquea direcciones privadas o reservadas' },
          { name: 'Query Shodan Host API', type: 'HTTP Request', desc: 'Consulta puertos y banners' },
          { name: 'Flag Dangerous Ports', type: 'Code JS', desc: 'RDP 3389, SMB 445, Redis 6379...' },
          { name: 'Insert Shodan Finding', type: 'Postgres', desc: 'Guarda banner y CVEs' }
        ];
      case 'wf-05':
        return [
          { name: 'Cron 6h', type: 'Schedule', desc: '0 */6 * * *' },
          { name: 'Find Due Vendors', type: 'Postgres', desc: 'Vencidos a 90/180/365 días' },
          { name: 'Create Assessment', type: 'Postgres', desc: 'Estado = reevaluation' },
          { name: 'Sign HMAC Portal Link', type: 'Code (crypto)', desc: 'HMAC-SHA256 con PORTAL_TOKEN_SECRET' },
          { name: 'Notify Backend', type: 'HTTP Webhook', desc: 'Envía invitación al contacto' }
        ];
      case 'wf-06':
        return [
          { name: 'Webhook POST', type: 'Webhook', desc: '/webhook/vrm-alerts (X-Alert-Token)' },
          { name: 'Normalize Alert', type: 'Code JS', desc: 'Ruta slack+email si critical/high' },
          { name: 'Redis Dedupe (1h)', type: 'Redis', desc: 'Evita tormentas de alertas' },
          { name: 'Send Slack Block Kit', type: 'Slack HTTP', desc: 'Canal #secops-alerts' },
          { name: 'Send SMTP Email', type: 'SMTP Node', desc: 'Destinatarios según roles RBAC' }
        ];
      case 'wf-07':
        return [
          { name: 'Cron 1h', type: 'Schedule', desc: 'Cada hora en punto' },
          { name: 'Get Active Vendors', type: 'Postgres', desc: 'Proveedores en monitoreo' },
          { name: 'Call Recalc API', type: 'HTTP Request', desc: 'POST /api/v1/scorecard/recalc/{id}; el backend registra score_history' }
        ];
      case 'wf-08':
        return [
          { name: 'Cron 30m', type: 'Schedule', desc: 'Cada 30 minutos' },
          { name: 'Check Stalled Jobs', type: 'Postgres', desc: 'Jobs sin correr según umbral' },
          { name: 'Ping Backend /health', type: 'HTTP Request', desc: 'Verifica uptime del servidor' },
          { name: 'Deadman Alert', type: 'IF / Alert', desc: 'Dispara WF-06 si hay degradación' }
        ];
      case 'wf-09':
        return [
          { name: 'Cron Weekly', type: 'Schedule', desc: 'Lunes 08:00 America/Lima' },
          { name: 'Query Risk & Findings', type: 'Postgres', desc: 'Riesgo, hallazgos abiertos/vencidos, nuevos/cerrados y top 10 proveedores' },
          { name: 'Render HTML Digest', type: 'Code JS', desc: 'Plantilla ejecutiva formateada' },
          { name: 'Send BCC Email', type: 'SMTP Node', desc: 'Envío único a partes interesadas' }
        ];
      case 'wf-10':
        return [
          { name: 'Cron Daily 03:00', type: 'Schedule', desc: 'Mantenimiento nocturno' },
          { name: 'Close Stale Findings', type: 'Postgres', desc: "auto_closed_stale (>STALE_FINDING_DAYS)" },
          { name: 'Archive Audit Logs', type: 'Postgres', desc: 'Archiva según AUDIT_RETENTION_YEARS (5 años por defecto)' },
          { name: 'Purge Old Scores', type: 'Postgres', desc: 'Purga según SCORE_RETENTION_YEARS (2 años por defecto)' },
          { name: 'Log Run', type: 'Postgres', desc: 'Registra el resultado en monitoring_jobs' }
        ];
      default:
        return [];
    }
  };

  const getWorkflowJsonSnippet = (wf: WorkflowSummary) => {
    return JSON.stringify(
      {
        name: wf.name,
        code: wf.code,
        trigger: wf.trigger,
        schedule: wf.scheduleDescription,
        description: wf.description,
        job_type: wf.jobType || null,
        nodes_pipeline: getPipelineNodes(wf.id),
        environment_dependencies: [
          'POSTGRES_DB',
          'REDIS_VRM',
          'N8N_WEBHOOK_SECRET',
          'PORTAL_TOKEN_SECRET',
          'VRM_BACKEND_URL',
          'NVD_MIN_CVSS'
        ]
      },
      null,
      2
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            Centro de Automatización n8n (11 Workflows)
          </h2>
          <p className="text-xs text-slate-400">
            Arquitectura desacoplada basada en cron schedules, triggers de eventos y webhooks en n8n v2.x
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!canWrite ? (
            <span className="px-3 py-2 text-xs text-slate-400 rounded-lg border border-slate-700">Solo lectura</span>
          ) : selectedWfId === 'wf-10' && !isAdmin ? (
            <span className="px-3 py-2 text-xs text-slate-400 rounded-lg border border-slate-700">WF-10 reservado para administradores</span>
          ) : selectedWfId === 'wf-00' ? (
            <span className="px-3 py-2 text-xs text-slate-400 rounded-lg border border-slate-700">
              WF-00 se ejecuta automáticamente al producirse un error
            </span>
          ) : (
            <button
              onClick={() => onExecuteWorkflow(selectedWfId)}
              disabled={isExecuting}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white shadow-lg shadow-cyan-950 transition-all"
            >
              <Play className={`w-3.5 h-3.5 ${isExecuting && executingWfId === selectedWfId ? 'animate-spin' : ''}`} />
              <span>
                {isExecuting && executingWfId === selectedWfId
                  ? 'Ejecutando Pipeline...'
                  : `Ejecutar ${selectedWf.code}`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Left List (11 WFs) | Right Detail & Execution Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Workflows List (4 cols) */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
            Catálogo de Workflows Registrados
          </div>

          <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
            {WORKFLOWS_REGISTRY.map((wf) => {
              const isSelected = selectedWfId === wf.id;
              const isRunningThis = isExecuting && executingWfId === wf.id;
              const job = wf.jobType ? jobs.find((j) => j.job_type === wf.jobType) : undefined;

              return (
                <div
                  key={wf.id}
                  onClick={() => setSelectedWfId(wf.id)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-500/80 shadow-md shadow-cyan-950/40'
                      : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-400">{wf.code}</span>
                      <span className="text-xs font-semibold text-slate-200 line-clamp-1">{wf.name}</span>
                    </div>
                    {isRunningThis ? (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    ) : (
                      <span className={`w-2 h-2 rounded-full ${
                        job?.status === 'healthy' ? 'bg-emerald-400'
                        : job?.status === 'failed' ? 'bg-rose-400'
                        : job?.status === 'overdue' ? 'bg-amber-400'
                        : 'bg-slate-500'
                      }`} />
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {wf.trigger}
                    </span>
                    {job?.last_run && (
                      <span className="text-[10px] text-slate-500">
                        {new Date(job.last_run).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Workflow Detail & Interactive Canvas (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
            {/* Header of selected workflow */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {selectedWf.code}
                  </span>
                  <h3 className="text-base font-bold text-white">{selectedWf.name}</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">{selectedWf.description}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded">
                  {selectedWf.scheduleDescription}
                </span>
              </div>
            </div>

            {/* Sub Tabs: Visual Pipeline / Live Execution Logs / n8n JSON */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setActiveTab('pipeline')}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === 'pipeline'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Diagrama de Pipeline ({getPipelineNodes(selectedWf.id).length} nodos)
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === 'logs'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Historial de Ejecuciones ({recentLogs.length})
              </button>

              <button
                onClick={() => setActiveTab('n8n_json')}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === 'n8n_json'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Esquema n8n JSON
              </button>
            </div>

            {/* Tab 1: Visual Pipeline Nodes */}
            {activeTab === 'pipeline' && (
              <div className="space-y-4 pt-2">
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Secuencia resumida de nodos definida en el repositorio:</span>
                  <span className="font-mono text-cyan-400">Error Workflow: WF-00</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  “Definido” confirma que el paso está descrito en el JSON; no significa que el workflow esté importado,
                  activo o conectado a credenciales reales. El punto de estado de cada workflow refleja la última ejecución registrada.
                </p>

                <div className="relative space-y-3">
                  {getPipelineNodes(selectedWf.id).map((node, idx, arr) => (
                    <div key={idx} className="relative">
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center font-mono text-xs font-bold text-cyan-400">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                              <span>{node.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                {node.type}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{node.desc}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                            Definido
                          </span>
                        </div>
                      </div>

                      {/* Connection arrow between nodes */}
                      {idx < arr.length - 1 && (
                        <div className="w-0.5 h-3 bg-cyan-600/40 mx-auto my-0.5" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Job metadata if available */}
                {associatedJob && (
                  <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
                    <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-cyan-400" />
                      Estado en Tabla <code className="font-mono text-cyan-300">monitoring_jobs</code>:
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-400 pt-1">
                      <div>Status: <span className="text-emerald-400 font-bold">{associatedJob.status}</span></div>
                      <div>Last run: <span className="text-slate-200">{associatedJob.last_run ? new Date(associatedJob.last_run).toLocaleTimeString() : 'N/A'}</span></div>
                      <div className="col-span-2">Meta: <span className="text-slate-300">{JSON.stringify(associatedJob.result_meta)}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Live Execution Logs */}
            {activeTab === 'logs' && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    Registro de Ejecuciones Locales
                  </span>
                  <button
                    onClick={() => onExecuteWorkflow(selectedWfId)}
                    disabled={isExecuting}
                    className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold"
                  >
                    + Disparar Ejecución Ahora
                  </button>
                </div>

                {recentLogs.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-slate-950 border border-slate-800 text-slate-500 text-xs">
                    No se han registrado ejecuciones recientes para este workflow. Haga clic en "Ejecutar" para probar la automatización.
                  </div>
                ) : (
                  recentLogs.map((log) => (
                    <div key={log.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {log.status === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : log.status === 'failed' ? (
                            <AlertCircle className="w-4 h-4 text-rose-400" />
                          ) : log.status === 'partial' ? (
                            <AlertCircle className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Clock className="w-4 h-4 text-cyan-400" />
                          )}
                          <span className="font-mono font-bold text-slate-200">{log.id}</span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-400">
                            {new Date(log.startedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-bold ${
                            log.status === 'success' ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : log.status === 'failed' ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : log.status === 'partial' ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : 'bg-cyan-950 text-cyan-300 border-cyan-800'
                          }`}>
                          {log.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 font-medium">{log.summary}</div>

                      {/* Step by step breakdown */}
                      <div className="space-y-1 pt-1 border-t border-slate-850">
                        {log.steps.map((st, i) => (
                          <div
                            key={i}
                            className="text-[11px] font-mono text-slate-400 flex items-center justify-between"
                          >
                            <span className="text-cyan-300">
                              ✓ {st.nodeName} <span className="text-slate-500 font-sans">({st.outputPreview})</span>
                            </span>
                            <span className="text-slate-500">{st.durationMs}ms</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 3: Raw n8n JSON schema */}
            {activeTab === 'n8n_json' && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Definición JSON compatible con n8n import API (/automation/n8n/workflows/):
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(getWorkflowJsonSnippet(selectedWf));
                      setCopiedJson(true);
                      setTimeout(() => setCopiedJson(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                  >
                    {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedJson ? 'Copiado' : 'Copiar JSON'}</span>
                  </button>
                </div>

                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-[380px] scrollbar-none">
                  {getWorkflowJsonSnippet(selectedWf)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
