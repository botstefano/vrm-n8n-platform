import React from 'react';
import {
  Building2,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  Radio,
  FileCheck2,
  Lock,
  Globe2,
  KeyRound
} from 'lucide-react';
import { Vendor, VendorFinding, MonitoringJob, AlertNotification } from '../types';
import { RiskBadge, SeverityBadge, StatusBadge } from './Badge';
import { NavTab } from './Navigation';

interface DashboardViewProps {
  vendors: Vendor[];
  findings: VendorFinding[];
  jobs: MonitoringJob[];
  alerts: AlertNotification[];
  onSelectTab: (tab: NavTab) => void;
  onExecuteWorkflow: (wfId: string) => void;
  onSelectVendor: (vendorId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  vendors,
  findings,
  jobs,
  alerts,
  onSelectTab,
  onExecuteWorkflow,
  onSelectVendor
}) => {
  const activeVendors = vendors.filter((v) =>
    ['approved', 'conditional', 'monitoring', 'incident', 'reevaluation'].includes(v.status)
  );

  const highCriticalRiskVendors = vendors.filter((v) => v.current_risk === 'critical' || v.current_risk === 'high');
  const openFindings = findings.filter((f) => f.status === 'open' || f.status === 'in_progress');
  const criticalFindings = openFindings.filter((f) => f.severity === 'critical');
  const highFindings = openFindings.filter((f) => f.severity === 'high');

  const avgScore =
    activeVendors.length > 0
      ? (activeVendors.reduce((acc, v) => acc + (v.current_score || 0), 0) / activeVendors.length).toFixed(1)
      : '0.0';

  // Overdue evaluations
  const dueEvaluations = vendors.filter(
    (v) => v.next_evaluation && new Date(v.next_evaluation) <= new Date()
  );

  return (
    <div className="space-y-6">
      {/* Top Banner if there are Critical Findings */}
      {criticalFindings.length > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/80 via-rose-900/40 to-slate-900 border border-rose-500/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-rose-200">
                Atención Inmediata: {criticalFindings.length} Hallazgo(s) Crítico(s) Detectados
              </h2>
              <p className="text-xs text-rose-300/80">
                Puertos peligrosos expuestos a Internet o certificados TLS expirando en menos de 7 días.
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectTab('findings')}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500 hover:bg-rose-400 text-white shadow-md shadow-rose-950 transition-colors"
          >
            Revisar Hallazgos
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Vendors */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Proveedores Activos</span>
            <Building2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{activeVendors.length}</span>
            <span className="text-xs text-slate-500">de {vendors.length} totales</span>
          </div>
          <div className="mt-2 text-[11px] text-cyan-400/90 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>Monitoreo continuo activo</span>
          </div>
        </div>

        {/* High/Critical Risk */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Riesgo Alto / Crítico</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-400">{highCriticalRiskVendors.length}</span>
            <span className="text-xs text-slate-500">requieren mitigación</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {vendors.filter((v) => v.current_risk === 'critical').length} Críticos · {vendors.filter((v) => v.current_risk === 'high').length} Altos
          </div>
        </div>

        {/* Open Security Findings */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Hallazgos Abiertos</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-300">{openFindings.length}</span>
            <span className="text-xs text-slate-500">vulnerabilidades</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            <span className="text-rose-400 font-semibold">{criticalFindings.length} Críticos</span> · <span className="text-orange-400 font-semibold">{highFindings.length} Altos</span>
          </div>
        </div>

        {/* Average Score */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Scorecard Promedio</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{avgScore}</span>
            <span className="text-xs text-slate-500">/ 100.0</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Recálculo por WF-07 cada hora</span>
          </div>
        </div>
      </div>

      {/* Quick Automated Scanners Grid */}
      <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Disparadores Rápidos de Automatización (n8n Workflows)
            </h3>
            <p className="text-xs text-slate-400">
              Ejecute manualmente los workflows periódicos de escaneo y auditoría
            </p>
          </div>
          <button
            onClick={() => onSelectTab('workflows')}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
          >
            Ver 11 Workflows <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* WF-01 */}
          <button
            onClick={() => onExecuteWorkflow('wf-01')}
            className="p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/50 text-left transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-cyan-400 font-bold">WF-01</span>
              <Radio className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400" />
            </div>
            <div className="mt-1 font-semibold text-xs text-slate-200">NVD CVE Scan</div>
            <div className="text-[11px] text-slate-400 mt-0.5">API 2.0 por CPE</div>
          </button>

          {/* WF-02 */}
          <button
            onClick={() => onExecuteWorkflow('wf-02')}
            className="p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/50 text-left transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-cyan-400 font-bold">WF-02</span>
              <Globe2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400" />
            </div>
            <div className="mt-1 font-semibold text-xs text-slate-200">CT Logs (crt.sh)</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Cert Transparency</div>
          </button>

          {/* WF-03 */}
          <button
            onClick={() => onExecuteWorkflow('wf-03')}
            className="p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/50 text-left transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-cyan-400 font-bold">WF-03</span>
              <Lock className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400" />
            </div>
            <div className="mt-1 font-semibold text-xs text-slate-200">TLS Expiry Scan</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Vencimiento & Cifrado</div>
          </button>

          {/* WF-04 */}
          <button
            onClick={() => onExecuteWorkflow('wf-04')}
            className="p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/50 text-left transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-cyan-400 font-bold">WF-04</span>
              <KeyRound className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400" />
            </div>
            <div className="mt-1 font-semibold text-xs text-slate-200">Shodan Surface</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Puertos 3389, 6379...</div>
          </button>

          {/* WF-07 */}
          <button
            onClick={() => onExecuteWorkflow('wf-07')}
            className="p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/50 text-left transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-cyan-400 font-bold">WF-07</span>
              <TrendingUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400" />
            </div>
            <div className="mt-1 font-semibold text-xs text-slate-200">Scorecard Refresh</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Recalcular todos</div>
          </button>
        </div>
      </div>

      {/* Two Columns: Vendors Snapshot & Recent Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Vendors by Risk */}
        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-400" />
                Matriz de Proveedores Monitoreados
              </h3>
              <p className="text-xs text-slate-400">Criticidad vs Nivel de Riesgo Actual</p>
            </div>
            <button
              onClick={() => onSelectTab('vendors')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
            >
              Directorio Completo <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-800/80">
            {vendors.slice(0, 5).map((v) => (
              <div
                key={v.id}
                onClick={() => {
                  onSelectVendor(v.id);
                  onSelectTab('vendors');
                }}
                className="py-3 flex items-center justify-between hover:bg-slate-800/40 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-200">{v.legal_name}</span>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>Criticidad {v.criticality}/5</span>
                    <span>·</span>
                    <span>{v.website || 'Sin web'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-mono text-xs font-bold text-white">{v.current_score?.toFixed(1) || '0.0'}</div>
                    <div className="text-[10px] text-slate-500">Scorecard</div>
                  </div>
                  <RiskBadge risk={v.current_risk} />
                </div>
              </div>
            ))}
          </div>

          {dueEvaluations.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs text-amber-300">
                  {dueEvaluations.length} proveedor(es) tienen reevaluación vencida o pendiente (WF-05).
                </span>
              </div>
              <button
                onClick={() => onExecuteWorkflow('wf-05')}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline"
              >
                Disparar Reevaluación
              </button>
            </div>
          )}
        </div>

        {/* Right: Security Findings Stream */}
        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Flujo de Hallazgos Recientes
              </h3>
              <p className="text-xs text-slate-400">Automatizaciones NVD, CT Logs, TLS y Shodan</p>
            </div>
            <button
              onClick={() => onSelectTab('findings')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
            >
              Ver Todos ({findings.length}) <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {findings.slice(0, 4).map((f) => {
              const vendor = vendors.find((v) => v.id === f.vendor_id);
              return (
                <div
                  key={f.id}
                  onClick={() => onSelectTab('findings')}
                  className="p-3 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/60 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={f.severity} />
                        <span className="font-mono text-[11px] text-slate-400 font-semibold">{f.source.toUpperCase()}</span>
                        <span className="text-slate-500 text-xs">·</span>
                        <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                          {vendor?.legal_name || 'Proveedor desconocido'}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-100 mt-1 line-clamp-1">{f.title}</div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{f.description}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          f.status === 'open'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : f.status === 'in_progress'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {f.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Alert Dispatched Preview */}
          {alerts.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                Última alerta: <span className="text-slate-200 font-medium">{alerts[0].title}</span>
              </span>
              <button
                onClick={() => onSelectTab('alerts')}
                className="text-cyan-400 hover:text-cyan-300 font-medium"
              >
                Canales Slack/Email →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
