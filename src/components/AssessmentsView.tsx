import React, { useState } from 'react';
import {
  FileCheck2,
  Calendar,
  ExternalLink,
  Play,
  Copy,
  Check
} from 'lucide-react';
import { Assessment, Vendor, Questionnaire } from '../types';

interface AssessmentsViewProps {
  assessments: Assessment[];
  vendors: Vendor[];
  questionnaires: Questionnaire[];
  onSelectVendor: (vendorId: string) => void;
  onExecuteWorkflow: (workflowId: string) => Promise<void>;
  canWrite: boolean;
}

export const AssessmentsView: React.FC<AssessmentsViewProps> = ({
  assessments,
  vendors,
  questionnaires,
  onSelectVendor,
  onExecuteWorkflow,
  canWrite
}) => {
  const [copiedPortalId, setCopiedPortalId] = useState<string | null>(null);

  const dueVendors = vendors.filter((v) => {
    const active = ['approved', 'conditional', 'monitoring', 'reevaluation'].includes(v.status);
    const hasExpiredAssessment = assessments.some((assessment) => assessment.vendor_id === v.id && assessment.status === 'expired');
    const isDue = v.status === 'reevaluation' && hasExpiredAssessment || !v.next_evaluation || new Date(v.next_evaluation) <= new Date();
    const hasPending = assessments.some(
      (a) => a.vendor_id === v.id && (a.status === 'pending' || a.status === 'in_progress')
    );
    return active && isDue && !hasPending;
  });

  const handleTriggerReevaluations = async () => {
    try {
      await onExecuteWorkflow('wf-05');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo solicitar el workflow WF-05.');
    }
  };

  const handleCopyPortalLink = async (assessment: Assessment) => {
    if (!assessment.portal_link) return;
    try {
      await navigator.clipboard.writeText(assessment.portal_link);
      setCopiedPortalId(assessment.id);
      window.setTimeout(() => setCopiedPortalId(null), 2000);
    } catch {
      alert('No se pudo copiar el enlace. Ábrelo y copia la URL desde el navegador.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-cyan-400" />
            Evaluaciones de Seguridad de Proveedores (WF-05)
          </h2>
          <p className="text-xs text-slate-400">
            Reevaluaciones persistidas en Supabase según criticidad del proveedor
          </p>
        </div>

        {canWrite && (
          <button
            onClick={handleTriggerReevaluations}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Disparar Reevaluación (WF-05)</span>
          </button>
        )}
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

          {canWrite && (
            <button
              onClick={handleTriggerReevaluations}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
            >
              Crear reevaluaciones
            </button>
          )}
        </div>
      )}

      {/* Assessments List Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Registro Histórico de Evaluaciones ({assessments.length})
          </h3>
          <span className="text-xs text-slate-400">Persistencia centralizada en Supabase</span>
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
                <th className="py-3 px-4 font-semibold text-right">Acciones</th>
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
                          {canWrite && asm.portal_link && asm.status !== 'completed' ? (
                            <>
                              <a
                                href={asm.portal_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Abrir portal</span>
                              </a>
                              <button
                                onClick={() => handleCopyPortalLink(asm)}
                                title="Copiar enlace seguro"
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                              >
                                {copiedPortalId === asm.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </>
                          ) : asm.status === 'expired' ? (
                            <span className="text-[10px] text-amber-400">Enlace caducado</span>
                          ) : asm.status !== 'completed' ? (
                            <span className="text-[10px] text-slate-500">Enlace pendiente</span>
                          ) : (
                            <span className="text-[10px] text-emerald-400">Completada</span>
                          )}
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


    </div>
  );
};
