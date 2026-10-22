import React from 'react';
import {
  LayoutDashboard,
  Building2,
  ShieldAlert,
  Cpu,
  FileCheck2,
  Bell,
  Activity,
  History,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { store } from '../services/store';

export type NavTab =
  | 'dashboard'
  | 'vendors'
  | 'findings'
  | 'workflows'
  | 'assessments'
  | 'alerts'
  | 'health'
  | 'audit';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  openCount: number;
  alertsCount: number;
  activeRole: string;
  onSelectRole: (role: string) => void;
  onQuickRun: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  openCount,
  alertsCount,
  activeRole,
  onSelectRole,
  onQuickRun
}) => {
  const tabs: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Resumen Ejecutivo', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'vendors', label: 'Proveedores', icon: <Building2 className="w-4 h-4" /> },
    { id: 'findings', label: 'Hallazgos & CVEs', icon: <ShieldAlert className="w-4 h-4" />, badge: openCount },
    { id: 'workflows', label: 'Automatización n8n (11)', icon: <Cpu className="w-4 h-4" /> },
    { id: 'assessments', label: 'Evaluaciones & Portal', icon: <FileCheck2 className="w-4 h-4" /> },
    { id: 'alerts', label: 'Centro de Alertas', icon: <Bell className="w-4 h-4" />, badge: alertsCount },
    { id: 'health', label: 'Salud de Jobs', icon: <Activity className="w-4 h-4" /> },
    { id: 'audit', label: 'Auditoría & Limpieza', icon: <History className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">VRM Platform</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/80">
                  n8n engine v2.x
                </span>
              </div>
              <p className="text-xs text-slate-400">Automatización Continua de Riesgo de Proveedores</p>
            </div>
          </div>

          {/* Quick Actions & Role Switcher */}
          <div className="flex items-center gap-3">
            {/* Quick Run All Workflows */}
            <button
              onClick={onQuickRun}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all hover:scale-[1.02]"
              title="Disparar escaneo completo y recálculo de scorecards"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" />
              <span>Ejecutar Escaneos</span>
            </button>

            {/* Role Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700 text-xs text-slate-300">
              <span className="text-slate-500 text-[11px]">Rol:</span>
              <select
                value={activeRole}
                onChange={(e) => onSelectRole(e.target.value)}
                aria-label="Rol activo de usuario"
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="admin" className="bg-slate-900 text-slate-100">Admin (CISO)</option>
                <option value="risk_analyst" className="bg-slate-900 text-slate-100">Analista de Riesgo</option>
                <option value="auditor" className="bg-slate-900 text-slate-100">Auditor</option>
              </select>
            </div>

            {/* Reset Store Button */}
            <button
              onClick={() => {
                if (window.confirm('¿Reiniciar todos los datos a la configuración inicial del seed?')) {
                  store.resetToDefaults();
                }
              }}
              title="Restablecer datos originales de 02-seed.sql"
              className="px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            >
              Reset Seed
            </button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <nav className="flex space-x-1 overflow-x-auto pb-1 scrollbar-none" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-800/40'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      tab.id === 'alerts'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
