import React, { useState } from 'react';
import {
  Building2,
  Search,
  Plus,
  Filter,
  ExternalLink,
  ShieldAlert,
  Cpu,
  FileCheck2,
  TrendingUp,
  X,
  Trash2,
  Check,
  AlertTriangle,
  Mail,
  Copy,
  Calendar,
  Layers
} from 'lucide-react';
import {
  Vendor,
  VendorTechnology,
  VendorFinding,
  Assessment,
  ScoreHistoryEntry,
  VendorStatus,
  RiskLevel
} from '../types';
import { RiskBadge, SeverityBadge, StatusBadge } from './Badge';
import { store } from '../services/store';

interface VendorsViewProps {
  vendors: Vendor[];
  technologies: VendorTechnology[];
  findings: VendorFinding[];
  assessments: Assessment[];
  scoreHistory: ScoreHistoryEntry[];
  selectedVendorId: string | null;
  onSelectVendor: (id: string | null) => void;
  onOpenFindingTab: () => void;
}

export const VendorsView: React.FC<VendorsViewProps> = ({
  vendors,
  technologies,
  findings,
  assessments,
  scoreHistory,
  selectedVendorId,
  onSelectVendor,
  onOpenFindingTab
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Vendor Form State
  const [newName, setNewName] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [newCriticality, setNewCriticality] = useState<number>(3);
  const [newStatus, setNewStatus] = useState<VendorStatus>('approved');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactName, setNewContactName] = useState('');

  // Add Tech Form State inside detail drawer
  const [newTechProduct, setNewTechProduct] = useState('');
  const [newTechCpe, setNewTechCpe] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId) || null;

  // Filtered vendors
  const filteredVendors = vendors.filter((v) => {
    const matchesSearch =
      v.legal_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.website.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    const matchesRisk = riskFilter === 'all' || v.current_risk === riskFilter;
    return matchesSearch && matchesStatus && matchesRisk;
  });

  const handleCreateVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newContactEmail.trim()) return;

    store.addVendor({
      legal_name: newName.trim(),
      website: newWebsite.trim(),
      status: newStatus,
      criticality: Number(newCriticality),
      current_risk: 'low',
      current_score: 90.0,
      next_evaluation: new Date(Date.now() + 180 * 86400000).toISOString(),
      primary_contact: {
        name: newContactName.trim() || undefined,
        email: newContactEmail.trim(),
        role: 'Vendor Security Lead'
      }
    });

    setShowAddModal(false);
    setNewName('');
    setNewWebsite('');
    setNewContactEmail('');
    setNewContactName('');
  };

  const handleAddTechnology = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor || !newTechProduct.trim() || !newTechCpe.trim()) return;

    store.addTechnology({
      vendor_id: selectedVendor.id,
      product_name: newTechProduct.trim(),
      cpe_match: newTechCpe.trim(),
      is_active: true
    });

    setNewTechProduct('');
    setNewTechCpe('');
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-400" />
            Directorio de Proveedores & Tecnologías
          </h2>
          <p className="text-xs text-slate-400">
            Inventario de terceros, niveles de riesgo, tecnologías CPE asociadas y control de evaluaciones
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Proveedor</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por razón social o dominio web..."
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Todos los Estados</option>
            <option value="approved">Approved</option>
            <option value="conditional">Conditional</option>
            <option value="monitoring">Monitoring</option>
            <option value="incident">Incident</option>
            <option value="reevaluation">Reevaluation</option>
            <option value="onboarding">Onboarding</option>
            <option value="suspended">Suspended</option>
          </select>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Todos los Riesgos</option>
            <option value="critical">Crítico</option>
            <option value="high">Alto</option>
            <option value="medium">Medio</option>
            <option value="low">Bajo</option>
            <option value="minimal">Mínimo</option>
          </select>
        </div>
      </div>

      {/* Vendors Table / Grid */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                <th className="py-3 px-4 font-semibold">Proveedor</th>
                <th className="py-3 px-4 font-semibold">Estado</th>
                <th className="py-3 px-4 font-semibold">Criticidad</th>
                <th className="py-3 px-4 font-semibold">Riesgo Actual</th>
                <th className="py-3 px-4 font-semibold">Scorecard</th>
                <th className="py-3 px-4 font-semibold">Tecnologías</th>
                <th className="py-3 px-4 font-semibold">Próx. Evaluación</th>
                <th className="py-3 px-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No se encontraron proveedores que coincidan con los criterios.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor) => {
                  const vendorTechs = technologies.filter((t) => t.vendor_id === vendor.id);
                  const vendorFindingsCount = findings.filter(
                    (f) => f.vendor_id === vendor.id && (f.status === 'open' || f.status === 'in_progress')
                  ).length;

                  return (
                    <tr
                      key={vendor.id}
                      onClick={() => onSelectVendor(vendor.id)}
                      className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                        selectedVendorId === vendor.id ? 'bg-cyan-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                          {vendor.legal_name}
                          {vendor.website && (
                            <a
                              href={vendor.website}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-slate-500 hover:text-cyan-400"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{vendor.primary_contact?.email || 'Sin contacto'}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <StatusBadge status={vendor.status} />
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <div
                              key={star}
                              className={`w-2 h-2 rounded-full ${
                                star <= vendor.criticality
                                  ? vendor.criticality >= 4
                                    ? 'bg-rose-500'
                                    : 'bg-amber-400'
                                  : 'bg-slate-700'
                              }`}
                            />
                          ))}
                          <span className="text-[11px] text-slate-400 ml-1 font-mono font-medium">
                            {vendor.criticality}/5
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <RiskBadge risk={vendor.current_risk} />
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-white">
                            {vendor.current_score?.toFixed(1) || '0.0'}
                          </span>
                          <span className="text-[10px] text-slate-500">/100</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                          <Layers className="w-3 h-3 text-cyan-400" />
                          {vendorTechs.length}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {vendor.next_evaluation ? (
                          <div className="flex items-center gap-1 text-[11px] text-slate-300">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>{new Date(vendor.next_evaluation).toLocaleDateString()}</span>
                            {new Date(vendor.next_evaluation) <= new Date() && (
                              <span className="text-[10px] text-rose-400 font-bold ml-1">Vencido</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">No programado</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectVendor(vendor.id);
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 border border-slate-700 transition-colors"
                        >
                          Ver Detalles
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Vendor Detail Drawer / Modal */}
      {selectedVendor && (
        <div className="p-6 rounded-xl border border-cyan-800/60 bg-slate-900/90 shadow-2xl relative space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-white">{selectedVendor.legal_name}</h3>
                <StatusBadge status={selectedVendor.status} />
                <RiskBadge risk={selectedVendor.current_risk} />
              </div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                <span>ID: <code className="font-mono text-cyan-300">{selectedVendor.id}</code></span>
                <span>·</span>
                <span>Criticidad: <strong>{selectedVendor.criticality}/5</strong></span>
                <span>·</span>
                <span>Contacto: <strong>{selectedVendor.primary_contact?.email}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const res = store.recalculateScorecard(selectedVendor.id);
                  alert(`Scorecard recalculado (WF-07): ${res.score} puntos · Nivel de Riesgo: ${res.risk.toUpperCase()}`);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Recalcular Score</span>
              </button>

              <button
                onClick={() => {
                  if (confirm(`¿Eliminar proveedor ${selectedVendor.legal_name}? Esta acción purgará también sus hallazgos y tecnologías asociadas.`)) {
                    store.deleteVendor(selectedVendor.id);
                    onSelectVendor(null);
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                title="Eliminar Proveedor"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => onSelectVendor(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Key Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[11px] text-slate-400">Puntaje Scorecard</span>
              <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
                {selectedVendor.current_score?.toFixed(1) || '0.0'}
                <span className="text-xs text-slate-500 ml-1">/100</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Calculado por motor WF-07</p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[11px] text-slate-400">Hallazgos Abiertos</span>
              <div className="text-2xl font-bold text-amber-300 mt-1">
                {findings.filter((f) => f.vendor_id === selectedVendor.id && f.status !== 'closed').length}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Vulnerabilidades activas</p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[11px] text-slate-400">Tecnologías CPE</span>
              <div className="text-2xl font-bold text-white mt-1">
                {technologies.filter((t) => t.vendor_id === selectedVendor.id).length}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">Para escaneo NVD (WF-01)</p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[11px] text-slate-400">Próx. Reevaluación</span>
              <div className="text-sm font-semibold text-slate-200 mt-1">
                {selectedVendor.next_evaluation
                  ? new Date(selectedVendor.next_evaluation).toLocaleDateString()
                  : 'No programada'}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Cadencia: {selectedVendor.criticality >= 4 ? '90 días' : selectedVendor.criticality === 3 ? '180 días' : '365 días'}
              </p>
            </div>
          </div>

          {/* Section: Technologies & CPE inventory (Required for WF-01) */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  Inventario de Tecnologías & CPE 2.3 (para WF-01 NVD)
                </h4>
                <p className="text-[11px] text-slate-400">
                  WF-01 consulta el API 2.0 de NIST buscando CVEs para estos identificadores de producto
                </p>
              </div>
            </div>

            {/* List */}
            <div className="space-y-2">
              {technologies.filter((t) => t.vendor_id === selectedVendor.id).length === 0 ? (
                <div className="text-xs text-slate-500 py-3 italic">
                  Sin tecnologías registradas. Añada un producto con su CPE 2.3 para que el escáner NVD pueda detectar CVEs.
                </div>
              ) : (
                technologies
                  .filter((t) => t.vendor_id === selectedVendor.id)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2.5 rounded bg-slate-900 border border-slate-800 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-200">{t.product_name}</span>
                        <div className="font-mono text-[11px] text-cyan-400 mt-0.5">{t.cpe_match}</div>
                      </div>
                      <button
                        onClick={() => store.deleteTechnology(t.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Eliminar Tecnología"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
              )}
            </div>

            {/* Add Tech Form */}
            <form onSubmit={handleAddTechnology} className="pt-2 flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Nombre del Producto (ej. nginx, OpenSSL)"
                value={newTechProduct}
                onChange={(e) => setNewTechProduct(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 flex-1 min-w-[160px]"
              />
              <input
                type="text"
                placeholder="CPE 2.3 (ej. cpe:2.3:a:nginx:nginx:*:*:*:*:*:*:*:*)"
                value={newTechCpe}
                onChange={(e) => setNewTechCpe(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 flex-1 min-w-[220px]"
              />
              <button
                type="submit"
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
              >
                + Añadir CPE
              </button>
            </form>
          </div>

          {/* Section: Linked Findings */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                Hallazgos de Seguridad Asociados
              </h4>
              <button
                onClick={onOpenFindingTab}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
              >
                Abrir en Gestor de Hallazgos →
              </button>
            </div>

            <div className="space-y-2">
              {findings.filter((f) => f.vendor_id === selectedVendor.id).length === 0 ? (
                <div className="text-xs text-slate-500 py-2">
                  No hay vulnerabilidades abiertas registradas para este proveedor.
                </div>
              ) : (
                findings
                  .filter((f) => f.vendor_id === selectedVendor.id)
                  .map((f) => (
                    <div
                      key={f.id}
                      className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <SeverityBadge severity={f.severity} />
                          <span className="font-mono text-cyan-400 font-bold">{f.source.toUpperCase()}</span>
                          <span className="font-semibold text-slate-100">{f.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{f.description}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {f.status}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Section: Score History */}
          <div className="space-y-2 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Historial de Scorecards (Snapshot)
            </h4>
            <div className="flex items-center gap-3 overflow-x-auto py-2">
              {scoreHistory.filter((sh) => sh.vendor_id === selectedVendor.id).length === 0 ? (
                <span className="text-xs text-slate-500">Sin historial registrado</span>
              ) : (
                scoreHistory
                  .filter((sh) => sh.vendor_id === selectedVendor.id)
                  .map((sh) => (
                    <div
                      key={sh.id}
                      className="px-3 py-2 rounded bg-slate-900 border border-slate-800 shrink-0 text-center"
                    >
                      <div className="text-sm font-bold font-mono text-white">{sh.score.toFixed(1)}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(sh.calculated_at).toLocaleDateString()}
                      </div>
                      <div className="mt-1">
                        <RiskBadge risk={sh.risk} />
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Vendor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                Registrar Nuevo Proveedor
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVendor} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Razón Social *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Okta, Inc."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Sitio Web / Dominio</label>
                <input
                  type="url"
                  placeholder="https://okta.com"
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Criticidad del Proveedor (1-5)</label>
                  <select
                    value={newCriticality}
                    onChange={(e) => setNewCriticality(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value={1}>1 - Muy Baja</option>
                    <option value={2}>2 - Baja</option>
                    <option value={3}>3 - Media</option>
                    <option value={4}>4 - Alta</option>
                    <option value={5}>5 - Crítica (Tier 1)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Estado Operativo</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as VendorStatus)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="approved">Approved</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="conditional">Conditional</option>
                    <option value="onboarding">Onboarding</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Contacto Primario (Email) *</label>
                  <input
                    type="email"
                    required
                    placeholder="security@vendor.com"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Nombre del Contacto</label>
                  <input
                    type="text"
                    placeholder="Juan Pérez (CISO)"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                >
                  Guardar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
