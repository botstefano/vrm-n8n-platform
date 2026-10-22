import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Plus,
  CheckCircle,
  Clock,
  Check,
  AlertOctagon,
  FileCode,
  ArrowRight,
  X,
  Radio,
  Globe2,
  Lock,
  KeyRound,
  ExternalLink
} from 'lucide-react';
import { VendorFinding, Vendor, FindingSource, FindingSeverity, FindingStatus } from '../types';
import { SeverityBadge } from './Badge';
import { store } from '../services/store';

interface FindingsViewProps {
  findings: VendorFinding[];
  vendors: Vendor[];
  onSelectVendor: (vendorId: string) => void;
}

export const FindingsView: React.FC<FindingsViewProps> = ({ findings, vendors, onSelectVendor }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedFinding, setSelectedFinding] = useState<VendorFinding | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [closingFindingId, setClosingFindingId] = useState<string | null>(null);

  // New Finding state
  const [newVendorId, setNewVendorId] = useState(vendors[0]?.id || '');
  const [newSource, setNewSource] = useState<FindingSource>('nvd');
  const [newSourceRef, setNewSourceRef] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSeverity, setNewSeverity] = useState<FindingSeverity>('high');
  const [newEvidenceRaw, setNewEvidenceRaw] = useState('{"cvss": 7.5}');

  const filteredFindings = findings.filter((f) => {
    const matchesSearch =
      f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.source_ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = sourceFilter === 'all' || f.source === sourceFilter;
    const matchesSeverity = severityFilter === 'all' || f.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
    return matchesSearch && matchesSource && matchesSeverity && matchesStatus;
  });

  const getSourceIcon = (source: FindingSource) => {
    switch (source) {
      case 'nvd':
        return <Radio className="w-3.5 h-3.5 text-rose-400" />;
      case 'ct_log':
        return <Globe2 className="w-3.5 h-3.5 text-cyan-400" />;
      case 'tls_expiry':
        return <Lock className="w-3.5 h-3.5 text-amber-400" />;
      case 'shodan':
        return <KeyRound className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const handleCreateFinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorId || !newTitle.trim()) return;

    let parsedEvidence = {};
    try {
      parsedEvidence = JSON.parse(newEvidenceRaw);
    } catch {
      parsedEvidence = { raw: newEvidenceRaw };
    }

    const created = store.addFinding({
      vendor_id: newVendorId,
      source: newSource,
      source_ref: newSourceRef.trim() || `ref-${Date.now().toString(36)}`,
      title: newTitle.trim(),
      description: newDescription.trim(),
      severity: newSeverity,
      status: 'open',
      evidence: parsedEvidence,
      due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
      closed_at: null
    });

    if (!created) {
      alert('Ya existe un hallazgo idéntico (misma fuente y referencia) para este proveedor (regla de idempotencia).');
    }

    setShowAddModal(false);
    setNewTitle('');
    setNewDescription('');
    setNewSourceRef('');
  };

  const handleConfirmClose = () => {
    if (closingFindingId) {
      store.updateFindingStatus(closingFindingId, 'closed', resolutionNote || 'Resuelto y mitigado');
      setClosingFindingId(null);
      setResolutionNote('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            Gestión de Hallazgos & Superficie de Ataque
          </h2>
          <p className="text-xs text-slate-400">
            Vulnerabilidades continuas ingeridas desde NVD (CVEs), Certificate Transparency (crt.sh), TLS y Shodan
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Hallazgo Manual</span>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título, CVE o referencia..."
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Source */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Todas las Fuentes</option>
            <option value="nvd">NVD (CVEs)</option>
            <option value="ct_log">CT Logs (crt.sh)</option>
            <option value="tls_expiry">TLS Expiry</option>
            <option value="shodan">Shodan Attack Surface</option>
          </select>

          {/* Severity */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Todas las Severidades</option>
            <option value="critical">Crítico</option>
            <option value="high">Alto</option>
            <option value="medium">Medio</option>
            <option value="low">Bajo</option>
            <option value="info">Info</option>
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Todos los Estados</option>
            <option value="open">Abierto (Open)</option>
            <option value="in_progress">En Progreso (In Progress)</option>
            <option value="accepted">Riesgo Aceptado (Accepted)</option>
            <option value="closed">Cerrado (Closed)</option>
          </select>
        </div>
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {filteredFindings.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-slate-800 bg-slate-900/30 text-slate-500 text-xs">
            No hay hallazgos que coincidan con los filtros seleccionados.
          </div>
        ) : (
          filteredFindings.map((finding) => {
            const vendor = vendors.find((v) => v.id === finding.vendor_id);
            const isDueOverdue = finding.due_date && new Date(finding.due_date) < new Date() && finding.status !== 'closed';

            return (
              <div
                key={finding.id}
                className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/70 hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={finding.severity} />
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {getSourceIcon(finding.source)}
                        <span>{finding.source.toUpperCase()}</span>
                      </span>
                      <span className="font-mono text-[11px] text-cyan-400 font-semibold">
                        {finding.source_ref}
                      </span>
                      <span className="text-slate-500 text-xs">·</span>
                      <button
                        onClick={() => onSelectVendor(finding.vendor_id)}
                        className="text-xs font-semibold text-slate-200 hover:text-cyan-300 underline underline-offset-2"
                      >
                        {vendor?.legal_name || 'Proveedor Desconocido'}
                      </button>
                    </div>

                    <h3 className="text-sm font-bold text-white">{finding.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{finding.description}</p>

                    {/* Evidence Snippet */}
                    {finding.evidence && Object.keys(finding.evidence).length > 0 && (
                      <div className="mt-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] font-mono text-slate-400">
                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1">
                          <FileCode className="w-3 h-3 text-cyan-400" />
                          Evidencia Técnica Ingerida
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {Object.entries(finding.evidence).map(([k, v]) => (
                            <span key={k}>
                              <span className="text-slate-500">{k}:</span>{' '}
                              <span className="text-cyan-300">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {finding.resolution && (
                      <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                        <CheckCircle className="w-3 h-3" />
                        <span>Resolución: {finding.resolution}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Actions & Status */}
                  <div className="flex flex-col md:items-end justify-between gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
                          finding.status === 'open'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : finding.status === 'in_progress'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : finding.status === 'accepted'
                            ? 'bg-blue-950 text-blue-400 border border-blue-800'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}
                      >
                        {finding.status}
                      </span>
                    </div>

                    {finding.due_date && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>SLA: {new Date(finding.due_date).toLocaleDateString()}</span>
                        {isDueOverdue && (
                          <span className="text-[10px] font-bold text-rose-400 ml-1">Vencido</span>
                        )}
                      </div>
                    )}

                    {/* Transition buttons */}
                    <div className="flex items-center gap-1.5 pt-1">
                      {finding.status === 'open' && (
                        <button
                          onClick={() => store.updateFindingStatus(finding.id, 'in_progress')}
                          className="px-2 py-1 text-[11px] font-semibold rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        >
                          En Progreso
                        </button>
                      )}

                      {finding.status !== 'accepted' && finding.status !== 'closed' && (
                        <button
                          onClick={() => store.updateFindingStatus(finding.id, 'accepted', 'Riesgo aceptado por CISO')}
                          className="px-2 py-1 text-[11px] font-semibold rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        >
                          Aceptar Riesgo
                        </button>
                      )}

                      {finding.status !== 'closed' && (
                        <button
                          onClick={() => setClosingFindingId(finding.id)}
                          className="px-2 py-1 text-[11px] font-semibold rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Cerrar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Close Finding Modal with Resolution Note */}
      {closingFindingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Cerrar Hallazgo de Seguridad
            </h3>
            <p className="text-xs text-slate-400">
              Indique la justificación técnica de resolución (ej. parche aplicado, regla de firewall, falso positivo verificado).
            </p>

            <div>
              <label className="block text-slate-300 font-semibold text-xs mb-1">Nota de Resolución</label>
              <textarea
                rows={3}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="ej. Se aplicó actualización de seguridad a versión recomendada y se verificó cierre de puerto."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClosingFindingId(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
              >
                Confirmar Cierre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Finding Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                Registrar Hallazgo de Seguridad
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFinding} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Proveedor Asociado *</label>
                <select
                  value={newVendorId}
                  onChange={(e) => setNewVendorId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.legal_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Fuente</label>
                  <select
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value as FindingSource)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="nvd">NVD (NIST CVE)</option>
                    <option value="ct_log">CT Log (crt.sh)</option>
                    <option value="tls_expiry">TLS Expiry</option>
                    <option value="shodan">Shodan Attack Surface</option>
                    <option value="manual">Manual Assessment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Severidad</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as FindingSeverity)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="critical">Crítico</option>
                    <option value="high">Alto</option>
                    <option value="medium">Medio</option>
                    <option value="low">Bajo</option>
                    <option value="info">Info</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Referencia Fuente (Idempotente) *</label>
                <input
                  type="text"
                  placeholder="ej. CVE-2024-12345 o shodan:192.0.2.1:3389"
                  value={newSourceRef}
                  onChange={(e) => setNewSourceRef(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Título del Hallazgo *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Puerto de base de datos expuesto sin autenticación"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Descripción & Impacto</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Detalles del riesgo identificado..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Evidencia (JSON)</label>
                <input
                  type="text"
                  value={newEvidenceRaw}
                  onChange={(e) => setNewEvidenceRaw(e.target.value)}
                  placeholder='{"port": 6379, "service": "Redis"}'
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                >
                  Crear Hallazgo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
