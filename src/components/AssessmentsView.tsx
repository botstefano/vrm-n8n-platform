import React, { useState } from 'react';
import {
  FileCheck2,
  Calendar,
  KeyRound,
  ExternalLink,
  CheckCircle2,
  Clock,
  Play,
  ShieldCheck,
  Send,
  X,
  Copy,
  Check,
  Building2,
  HelpCircle
} from 'lucide-react';
import { Assessment, Vendor, Questionnaire } from '../types';
import { store } from '../services/store';

interface AssessmentsViewProps {
  assessments: Assessment[];
  vendors: Vendor[];
  questionnaires: Questionnaire[];
  onSelectVendor: (vendorId: string) => void;
}

export const AssessmentsView: React.FC<AssessmentsViewProps> = ({
  assessments,
  vendors,
  questionnaires,
  onSelectVendor
}) => {
  const [selectedAssessmentForPortal, setSelectedAssessmentForPortal] = useState<Assessment | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Portal form answers simulator
  const [qAnswers, setQAnswers] = useState<Record<string, boolean>>({
    'q1-1': true,
    'q1-2': true,
    'q2-1': true,
    'q2-2': true,
    'q2-3': false
  });

  const dueVendors = vendors.filter((v) => {
    const active = ['approved', 'conditional', 'monitoring'].includes(v.status);
    const isDue = !v.next_evaluation || new Date(v.next_evaluation) <= new Date();
    const hasPending = assessments.some(
      (a) => a.vendor_id === v.id && (a.status === 'pending' || a.status === 'in_progress')
    );
    return active && isDue && !hasPending;
  });

  const handleTriggerReevaluations = () => {
    const res = store.triggerReevaluationForDue();
    alert(`WF-05 ejecutado: Se generaron ${res.assessmentsCreated} evaluaciones con tokens firmados HMAC-SHA256.`);
  };

  const handleCopyLink = (token?: string) => {
    if (!token) return;
    const url = `${window.location.origin}/portal/assessment/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handlePortalSubmit = () => {
    if (!selectedAssessmentForPortal) return;
    // Calculate simulated score from answers
    let totalScore = 0;
    const q1 = qAnswers['q1-1'] ? 25 : 0;
    const q2 = qAnswers['q1-2'] ? 15 : 0;
    const q3 = qAnswers['q2-1'] ? 25 : 0;
    const q4 = qAnswers['q2-2'] ? 20 : 0;
    const q5 = qAnswers['q2-3'] ? 15 : 0;
    totalScore = q1 + q2 + q3 + q4 + q5;

    store.completeAssessment(selectedAssessmentForPortal.id, totalScore);
    alert(`Evaluación completada con éxito. Calificación del cuestionario: ${totalScore}/100. Proveedor actualizado.`);
    setSelectedAssessmentForPortal(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-cyan-400" />
            Evaluaciones de Seguridad & Portal de Proveedores (WF-05)
          </h2>
          <p className="text-xs text-slate-400">
            Cadencia automatizada de reevaluación (90/180/365 días) con enlaces firmados HMAC-SHA256
          </p>
        </div>

        <button
          onClick={handleTriggerReevaluations}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950 transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Disparar Reevaluación (WF-05)</span>
        </button>
      </div>

      {/* Due Vendors Alert Banner */}
      {dueVendors.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-amber-200">
                {dueVendors.length} Proveedor(es) con Reevaluación Periódica Vencida
              </div>
              <p className="text-[11px] text-amber-300/80">
                Cumplimiento normativo ISO 27001 / SOC 2 exige renovación periódica según criticidad.
              </p>
            </div>
          </div>

          <button
            onClick={handleTriggerReevaluations}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
          >
            Generar Enlaces Firmados
          </button>
        </div>
      )}

      {/* Assessments List Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Registro Histórico de Evaluaciones ({assessments.length})
          </h3>
          <span className="text-xs text-slate-400">Firmado con PORTAL_TOKEN_SECRET</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                <th className="py-3 px-4 font-semibold">ID / Proveedor</th>
                <th className="py-3 px-4 font-semibold">Cuestionario</th>
                <th className="py-3 px-4 font-semibold">Estado</th>
                <th className="py-3 px-4 font-semibold">Iniciado</th>
                <th className="py-3 px-4 font-semibold">Completado</th>
                <th className="py-3 px-4 font-semibold">Puntaje</th>
                <th className="py-3 px-4 font-semibold text-right">Portal Externo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {assessments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No hay evaluaciones registradas.
                  </td>
                </tr>
              ) : (
                assessments.map((asm) => {
                  const vendor = vendors.find((v) => v.id === asm.vendor_id);
                  const q = questionnaires.find((item) => item.id === asm.questionnaire_id);

                  return (
                    <tr key={asm.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                          <button
                            onClick={() => onSelectVendor(asm.vendor_id)}
                            className="hover:text-cyan-400 underline underline-offset-2"
                          >
                            {vendor?.legal_name || 'Proveedor'}
                          </button>
                        </div>
                        <div className="font-mono text-[10px] text-slate-500 mt-0.5">{asm.id}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-slate-300 line-clamp-1">{q?.name || 'Estándar'}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                            asm.status === 'completed'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : asm.status === 'in_progress'
                              ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {asm.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-400">
                        {asm.started_at ? new Date(asm.started_at).toLocaleDateString() : 'N/A'}
                      </td>

                      <td className="py-3 px-4 text-slate-400">
                        {asm.completed_at ? new Date(asm.completed_at).toLocaleDateString() : 'Pendiente'}
                      </td>

                      <td className="py-3 px-4">
                        {asm.score !== undefined && asm.score !== null ? (
                          <span className="font-mono font-bold text-white text-xs">
                            {asm.score} <span className="text-[10px] text-slate-500">/ 100</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {asm.portal_token && (
                            <button
                              onClick={() => handleCopyLink(asm.portal_token)}
                              className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded"
                              title="Copiar Link HMAC"
                            >
                              {copiedToken === asm.portal_token ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedAssessmentForPortal(asm)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Abrir Portal</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* External Vendor Assessment Portal Simulator Modal */}
      {selectedAssessmentForPortal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-cyan-700/80 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">
                    Vendor Portal (HMAC Verified)
                  </span>
                  <h3 className="text-base font-bold text-white">Cuestionario de Cumplimiento de Seguridad</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Simulación de la vista pública accesible mediante el token firmado:
                </p>
                <div className="font-mono text-[10px] text-cyan-300/80 bg-slate-950 p-1.5 rounded mt-1 truncate">
                  {selectedAssessmentForPortal.portal_token || 'Token no generado'}
                </div>
              </div>

              <button
                onClick={() => setSelectedAssessmentForPortal(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Questions Form */}
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  1. Certificaciones & Gobernanza
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={qAnswers['q1-1']}
                    onChange={(e) => setQAnswers({ ...qAnswers, 'q1-1': e.target.checked })}
                    className="mt-0.5 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                  />
                  <span>¿Cuenta la organización con una certificación SOC 2 Tipo II o ISO 27001 vigente? (+25 pts)</span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={qAnswers['q1-2']}
                    onChange={(e) => setQAnswers({ ...qAnswers, 'q1-2': e.target.checked })}
                    className="mt-0.5 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                  />
                  <span>¿Se realizan revisiones periódicas de políticas de seguridad al menos anualmente? (+15 pts)</span>
                </label>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  2. Cifrado y Control de Accesos
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={qAnswers['q2-1']}
                    onChange={(e) => setQAnswers({ ...qAnswers, 'q2-1': e.target.checked })}
                    className="mt-0.5 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                  />
                  <span>¿Se exige Autenticación Multifactor (MFA) obligatoria en todos los accesos administrativos? (+25 pts)</span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={qAnswers['q2-2']}
                    onChange={(e) => setQAnswers({ ...qAnswers, 'q2-2': e.target.checked })}
                    className="mt-0.5 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                  />
                  <span>¿Los datos en tránsito están cifrados con TLS 1.2+ y en reposo con AES-256? (+20 pts)</span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={qAnswers['q2-3']}
                    onChange={(e) => setQAnswers({ ...qAnswers, 'q2-3': e.target.checked })}
                    className="mt-0.5 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                  />
                  <span>¿Existe rotación de credenciales y secretos de API automatizada? (+15 pts)</span>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Al enviar, el backend verificará la firma HMAC y actualizará el scorecard.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAssessmentForPortal(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handlePortalSubmit}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Cuestionario</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
