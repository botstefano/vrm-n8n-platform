import React, { useState } from 'react';
import {
  Bell,
  Send,
  MessageSquare,
  Mail,
  ShieldAlert,
  Radio,
  Repeat,
  CheckCircle2,
  Clock,
  Layers,
  ExternalLink,
  Users
} from 'lucide-react';
import { AlertNotification, Vendor, FindingSeverity } from '../types';
import { SeverityBadge } from './Badge';
import { store } from '../services/store';

interface AlertsViewProps {
  alerts: AlertNotification[];
  vendors: Vendor[];
}

export const AlertsView: React.FC<AlertsViewProps> = ({ alerts, vendors }) => {
  const [selectedAlert, setSelectedAlert] = useState<AlertNotification | null>(alerts[0] || null);

  // Manual Trigger Form
  const [severity, setSeverity] = useState<FindingSeverity>('critical');
  const [vendorId, setVendorId] = useState<string>(vendors[0]?.id || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('manual_trigger');

  const handleSendTestAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newAlert = store.dispatchAlert({
      severity,
      title: title.trim(),
      vendor_id: vendorId || undefined,
      source,
      source_ref: `ref-${Date.now().toString(36)}`,
      description: description.trim() || undefined
    });

    setSelectedAlert(newAlert);
    setTitle('');
    setDescription('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-rose-400" />
            Centro de Despacho de Alertas Multicanal (WF-06)
          </h2>
          <p className="text-xs text-slate-400">
            Deduplicación en Redis (ventana de 1h), enrutamiento por severidad hacia Slack (#secops) y SMTP a usuarios RBAC
          </p>
        </div>
      </div>

      {/* Grid: Left Column (Trigger & Feed) | Right Column (Interactive Slack / Email preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Trigger form + Feed */}
        <div className="lg:col-span-5 space-y-4">
          {/* Test Trigger Card */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-cyan-400" />
                Simular Webhook <code className="font-mono text-cyan-300">POST /webhook/vrm-alerts</code>
              </h3>
            </div>

            <form onSubmit={handleSendTestAlert} className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Severidad</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as FindingSeverity)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="critical">Critical (Slack + Email)</option>
                    <option value="high">High (Slack + Email)</option>
                    <option value="medium">Medium (Solo Slack)</option>
                    <option value="low">Low (Solo Slack)</option>
                    <option value="info">Info (Solo Slack)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Proveedor</label>
                  <select
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.legal_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Título de la Alerta *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Inminente expiración de certificado TLS (<7d)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Descripción</label>
                <textarea
                  rows={2}
                  placeholder="Detalles complementarios del incidente..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded text-xs transition-colors shadow-sm"
              >
                Disparar Alerta a WF-06
              </button>
            </form>
          </div>

          {/* Alerts Feed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="font-bold uppercase tracking-wider">Historial de Notificaciones ({alerts.length})</span>
              <span className="text-[11px] text-cyan-400">Redis TTL: 3600s</span>
            </div>

            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {alerts.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-900/30 border border-slate-800 text-slate-500 text-xs">
                  Sin alertas recientes.
                </div>
              ) : (
                alerts.map((al) => {
                  const isSelected = selectedAlert?.id === al.id;
                  return (
                    <div
                      key={al.id}
                      onClick={() => setSelectedAlert(al)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-900 border-rose-500/80 shadow-md shadow-rose-950/20'
                          : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <SeverityBadge severity={al.severity} />
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                              al.status === 'deduped'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}
                          >
                            {al.status}
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(al.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-slate-200 mt-1 line-clamp-1">{al.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center justify-between">
                        <span>Ruta: <code className="font-mono text-cyan-300">{al.route}</code></span>
                        <span>{al.vendor_name || 'Global'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right: Channel Previews (Slack & Email) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedAlert ? (
            <div className="space-y-4">
              {/* Slack Card Preview */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-[#4A154B] flex items-center justify-center font-bold text-[10px] text-white">
                      #
                    </div>
                    <span className="text-xs font-bold text-white">Canal de Slack: #secops-alerts</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">Incoming Webhook</span>
                </div>

                {/* Slack Message Layout */}
                <div className="p-4 rounded-lg bg-[#1A1D21] border border-[#2c3136] space-y-2 text-xs font-sans text-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-rose-400 text-sm">VRM SecOps Bot</span>
                    <span className="text-[10px] bg-slate-700 text-slate-300 px-1 rounded uppercase font-semibold">APP</span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(selectedAlert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="border-l-4 border-rose-500 pl-3 py-1 space-y-1">
                    <div className="font-bold text-slate-100 flex items-center gap-1.5">
                      <span>🚨 [{selectedAlert.severity.toUpperCase()}]</span>
                      <span>{selectedAlert.title}</span>
                    </div>

                    {selectedAlert.vendor_name && (
                      <div className="text-[11px] text-slate-300">
                        Proveedor: <code className="bg-slate-800 px-1 rounded text-cyan-300 font-mono">{selectedAlert.vendor_name}</code>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-400">
                      Fuente: <span className="font-mono text-slate-300">{selectedAlert.source || 'n/a'}</span>
                      {selectedAlert.source_ref && ` · ${selectedAlert.source_ref}`}
                    </div>

                    {selectedAlert.description && (
                      <p className="text-[11px] text-slate-300 pt-1 leading-relaxed">
                        {selectedAlert.description}
                      </p>
                    )}

                    <div className="pt-2">
                      <span className="text-cyan-400 font-semibold hover:underline cursor-pointer flex items-center gap-1">
                        Ver en Plataforma VRM <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Email SMTP Layout Preview (if route is slack+email) */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white">Plantilla de Correo SMTP (HTML)</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Destinatarios: RBAC (Admin, Analista, Auditor)
                  </span>
                </div>

                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-3">
                  <div className="border-b border-slate-800 pb-2 space-y-1 text-[11px]">
                    <div><span className="text-slate-500">De:</span> alerts@vrm-platform.internal</div>
                    <div><span className="text-slate-500">Asunto:</span> <span className="font-bold text-white">{selectedAlert.email_subject || selectedAlert.title}</span></div>
                    <div><span className="text-slate-500">Para:</span> admin@vrm.local, analista@vrm.local</div>
                  </div>

                  <div
                    className="prose prose-invert prose-xs max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedAlert.email_html || '<p>Contenido no formateado</p>' }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs">
              Seleccione una alerta del historial para visualizar la previsualización en tiempo real de Slack y Correo Electrónico.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
