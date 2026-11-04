import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ClipboardCheck, Loader2, ShieldCheck } from 'lucide-react';
import { publicApiRequest } from '../services/api';

interface AssessmentQuestion {
  id: string;
  text: string;
  weight: number;
}
interface AssessmentSection {
  id: string;
  title: string;
  questions: AssessmentQuestion[];
}
interface PortalPayload {
  vendor: { id: string; legal_name: string };
  assessment: { id: string; status: string; token_expires_at: string };
  questionnaire: { id: string; name: string; version: number; sections: AssessmentSection[] };
}

interface AssessmentPortalViewProps {
  token: string;
}

export const AssessmentPortalView: React.FC<AssessmentPortalViewProps> = ({ token }) => {
  const [payload, setPayload] = useState<PortalPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    publicApiRequest<PortalPayload>(`/api/public/assessments/${encodeURIComponent(token)}`)
      .then((data) => { if (active) setPayload(data); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'No se pudo abrir la evaluación.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const questions = useMemo(
    () => (payload?.questionnaire.sections || []).flatMap((section) => section.questions || []),
    [payload]
  );
  const answeredCount = questions.filter((question) => typeof answers[question.id] === 'boolean').length;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!payload || answeredCount !== questions.length) {
      setError('Responde todas las preguntas antes de enviar el formulario.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await publicApiRequest<{ completed: boolean; score: number; message: string }>(
        `/api/public/assessments/${encodeURIComponent(token)}/complete`,
        { method: 'POST', body: { responses: answers } }
      );
      setScore(result.score);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la evaluación.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Portal de evaluación de proveedores</h1>
          <p className="mt-2 text-sm text-slate-400">VRM Automation Platform · Enlace seguro de un solo uso</p>
        </div>

        {loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-10 flex items-center justify-center gap-3 text-sm text-slate-300">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" /> Validando el enlace…
          </div>
        )}

        {!loading && error && !payload && (
          <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-6 text-sm text-rose-200 flex gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div><strong>No se pudo abrir la evaluación.</strong><p className="mt-1">{error}</p></div>
          </div>
        )}

        {payload && score === null && (
          <form onSubmit={submit} className="space-y-5">
            <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold uppercase tracking-wide">
                <ClipboardCheck className="w-4 h-4" /> Evaluación solicitada
              </div>
              <h2 className="mt-3 text-lg font-bold">{payload.questionnaire.name}</h2>
              <p className="mt-2 text-sm text-slate-300">Proveedor: <strong>{payload.vendor.legal_name}</strong></p>
              <p className="mt-1 text-xs text-slate-500">Versión {payload.questionnaire.version} · {questions.length} preguntas · Respuestas: {answeredCount}/{questions.length}</p>
              <p className="mt-3 text-xs text-amber-300">Este enlace es privado, tiene vencimiento y solo puede utilizarse una vez.</p>
            </section>

            {payload.questionnaire.sections.map((section, sectionIndex) => (
              <section key={section.id || sectionIndex} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                <h3 className="text-sm font-bold text-white">{section.title}</h3>
                {section.questions.map((question, questionIndex) => (
                  <div key={question.id} className="border-t border-slate-800 pt-4 first:border-0 first:pt-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <p className="text-sm text-slate-200 flex-1">{questionIndex + 1}. {question.text}</p>
                      <div className="flex items-center gap-4 shrink-0 text-xs">
                        <label className="inline-flex items-center gap-1.5 text-slate-300 cursor-pointer">
                          <input type="radio" name={question.id} checked={answers[question.id] === true}
                            onChange={() => setAnswers((current) => ({ ...current, [question.id]: true }))} />
                          Sí
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-slate-300 cursor-pointer">
                          <input type="radio" name={question.id} checked={answers[question.id] === false}
                            onChange={() => setAnswers((current) => ({ ...current, [question.id]: false }))} />
                          No
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            ))}

            {error && (
              <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-200 flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <button type="submit" disabled={submitting || answeredCount !== questions.length}
              className="w-full rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
              {submitting ? 'Enviando evaluación…' : 'Enviar evaluación'}
            </button>
          </form>
        )}

        {score !== null && (
          <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-8 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400" />
            <h2 className="mt-4 text-xl font-bold">Evaluación recibida</h2>
            <p className="mt-2 text-sm text-slate-300">Tu respuesta se guardó correctamente.</p>
            <div className="mt-5 text-4xl font-bold text-emerald-300">{score.toFixed(1)}<span className="text-base text-slate-400">/100</span></div>
            <p className="mt-3 text-xs text-slate-400">El enlace ha sido invalidado y no puede volver a utilizarse.</p>
          </div>
        )}

        <p className="mt-8 text-center text-[11px] text-slate-600">Si recibiste este enlace por error o expiró, contacta al equipo de gestión de proveedores.</p>
      </div>
    </main>
  );
};
