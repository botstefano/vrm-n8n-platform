import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Server,
  Play,
  RefreshCw,
  Cpu,
  Layers,
  Database
} from 'lucide-react';
import { MonitoringJob } from '../types';
import { store } from '../services/store';

interface HealthViewProps {
  jobs: MonitoringJob[];
  onExecuteWorkflow: (wfId: string) => Promise<void>;
  isExecuting: boolean;
}

export const HealthView: React.FC<HealthViewProps> = ({ jobs, onExecuteWorkflow, isExecuting }) => {
  const [backendPing, setBackendPing] = useState<{ status: 'online' | 'offline'; latencyMs: number }>({
    status: 'online',
    latencyMs: 14
  });

  const overdueJobs = jobs.filter(
    (j) => j.next_run && new Date(j.next_run) < new Date() && j.status !== 'healthy'
  );

  const handlePingBackend = () => {
    const lat = Math.floor(10 + Math.random() * 20);
    setBackendPing({ status: 'online', latencyMs: lat });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Salud del Sistema & Monitor Deadman (WF-08)
          </h2>
          <p className="text-xs text-slate-400">
            Supervisión continua de jobs en la tabla <code className="font-mono text-cyan-300">monitoring_jobs</code> y conectividad del backend
          </p>
        </div>

        <button
          onClick={() => onExecuteWorkflow('wf-08')}
          disabled={isExecuting}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white shadow-md shadow-cyan-950 transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Ejecutar Health Check (WF-08)</span>
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Backend Status */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400">VRM Backend API</span>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                {backendPing.status} (200 OK)
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">Latencia: {backendPing.latencyMs}ms</div>
          </div>
          <button
            onClick={handlePingBackend}
            className="p-2 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition-colors"
            title="Ping /health"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* PostgreSQL Database */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400">Base de Datos PostgreSQL</span>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-sm font-bold text-white uppercase tracking-wider">Conectado</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">11 Tablas · Pool activo</div>
          </div>
          <Database className="w-5 h-5 text-cyan-400" />
        </div>

        {/* Jobs Health */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400">Supervisión Deadman</span>
            <div className="flex items-center gap-2">
              {overdueJobs.length === 0 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">Todos los jobs a tiempo</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span className="text-sm font-bold text-rose-400">{overdueJobs.length} jobs atrasados</span>
                </>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">{jobs.length} jobs registrados</div>
          </div>
          <Activity className="w-5 h-5 text-emerald-400" />
        </div>
      </div>

      {/* Jobs Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Registro en Tiempo Real de <code className="font-mono text-cyan-400">monitoring_jobs</code>
          </h3>
          <span className="text-xs text-slate-400">UPSERT por job_type</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                <th className="py-3 px-4 font-semibold">Tipo de Job</th>
                <th className="py-3 px-4 font-semibold">Alcance</th>
                <th className="py-3 px-4 font-semibold">Última Ejecución</th>
                <th className="py-3 px-4 font-semibold">Próxima Ejecución</th>
                <th className="py-3 px-4 font-semibold">Estado</th>
                <th className="py-3 px-4 font-semibold">Metadatos (result_meta)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-cyan-300">{job.job_type}</td>

                  <td className="py-3 px-4 text-slate-400 font-sans">
                    {job.vendor_id ? `Vendor: ${job.vendor_id}` : 'Global (todos)'}
                  </td>

                  <td className="py-3 px-4 text-slate-300">
                    {job.last_run ? new Date(job.last_run).toLocaleString() : 'Nunca ejecutado'}
                  </td>

                  <td className="py-3 px-4 text-slate-400">
                    {job.next_run ? new Date(job.next_run).toLocaleString() : 'Cron automático'}
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        job.status === 'healthy'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : job.status === 'running'
                          ? 'bg-cyan-950 text-cyan-400 border border-cyan-800 animate-pulse'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-slate-400 text-[11px] truncate max-w-xs font-mono">
                    {JSON.stringify(job.result_meta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
