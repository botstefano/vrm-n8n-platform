import React, { useState } from 'react';
import {
  History,
  Archive,
  Trash2,
  Play,
  Search,
  CheckCircle2,
  Clock,
  Download,
  Upload,
  FileCode,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { AuditLogEntry } from '../types';
import { store } from '../services/store';

interface AuditViewProps {
  auditLog: AuditLogEntry[];
  auditArchive: AuditLogEntry[];
}

export const AuditView: React.FC<AuditViewProps> = ({ auditLog, auditArchive }) => {
  const [activeTab, setActiveTab] = useState<'live' | 'archive'>('live');
  const [searchTerm, setSearchTerm] = useState('');
  const [cleanupResult, setCleanupResult] = useState<{
    closedFindings: number;
    archivedAudit: number;
    purgedScores: number;
  } | null>(null);

  const displayedList = activeTab === 'live' ? auditLog : auditArchive;
  const filteredList = displayedList.filter((entry) => {
    const term = searchTerm.toLowerCase();
    return (
      entry.action.toLowerCase().includes(term) ||
      entry.actor.toLowerCase().includes(term) ||
      entry.entity.toLowerCase().includes(term) ||
      entry.entity_id.toLowerCase().includes(term)
    );
  });

  const handleRunCleanup = () => {
    const res = store.runCleanupAndArchive(90, 1);
    setCleanupResult(res);
  };

  const handleExportJson = () => {
    const exportData = {
      vendors: store.getVendors(),
      technologies: store.getTechnologies(),
      findings: store.getFindings(),
      assessments: store.getAssessments(),
      auditLog: store.getAuditLog(),
      auditArchive: store.getAuditArchive(),
      scoreHistory: store.getScoreHistory(),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vrm-platform-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-400" />
            Pistas de Auditoría & Motor de Limpieza (WF-10)
          </h2>
          <p className="text-xs text-slate-400">
            Trazabilidad inmutable de acciones, resolución de hallazgos vencidos y archivado regulatorio SOC 2 / ISO
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar JSON</span>
          </button>

          <button
            onClick={handleRunCleanup}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-950 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Ejecutar WF-10 Limpieza</span>
          </button>
        </div>
      </div>

      {/* WF-10 Summary Banner if triggered */}
      {cleanupResult && (
        <div className="p-4 rounded-xl bg-cyan-950/60 border border-cyan-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">WF-10 Cleanup & Archive ejecutado exitosamente</div>
              <div className="text-[11px] text-cyan-300/80">
                {cleanupResult.closedFindings} hallazgos obsoletos cerrados con resolución <code className="font-mono">auto_closed_stale</code> · {cleanupResult.archivedAudit} registros movidos a <code className="font-mono">audit_log_archive</code>.
              </div>
            </div>
          </div>
          <button
            onClick={() => setCleanupResult(null)}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Tabs: Live Audit Log vs Archive */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'live'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>audit_log Activo ({auditLog.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('archive')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'archive'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>audit_log_archive ({auditArchive.length})</span>
          </button>
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar por acción o actor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Actor</th>
                <th className="py-3 px-4 font-semibold">Acción</th>
                <th className="py-3 px-4 font-semibold">Entidad</th>
                <th className="py-3 px-4 font-semibold">ID Entidad</th>
                <th className="py-3 px-4 font-semibold">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    No hay registros de auditoría en esta vista.
                  </td>
                </tr>
              ) : (
                filteredList.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 text-slate-400">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-cyan-300 font-bold">{entry.actor}</td>
                    <td className="py-2.5 px-4 text-white font-semibold">{entry.action}</td>
                    <td className="py-2.5 px-4 text-slate-400">{entry.entity}</td>
                    <td className="py-2.5 px-4 text-slate-500">{entry.entity_id}</td>
                    <td className="py-2.5 px-4 text-slate-400 truncate max-w-xs">
                      {JSON.stringify(entry.details)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
