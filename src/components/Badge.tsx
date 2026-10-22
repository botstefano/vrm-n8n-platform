import React from 'react';
import { RiskLevel, FindingSeverity, VendorStatus } from '../types';

export const RiskBadge: React.FC<{ risk: RiskLevel }> = ({ risk }) => {
  const styles: Record<RiskLevel, string> = {
    critical: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    high: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    medium: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    minimal: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
  };

  const labels: Record<RiskLevel, string> = {
    critical: 'Crítico',
    high: 'Alto',
    medium: 'Medio',
    low: 'Bajo',
    minimal: 'Mínimo'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[risk]}`}>
      {labels[risk]}
    </span>
  );
};

export const SeverityBadge: React.FC<{ severity: FindingSeverity }> = ({ severity }) => {
  const styles: Record<FindingSeverity, string> = {
    critical: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    high: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    low: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    info: 'bg-slate-500/20 text-slate-300 border-slate-500/40'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${styles[severity]}`}>
      {severity}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: VendorStatus }> = ({ status }) => {
  const styles: Record<VendorStatus, string> = {
    onboarding: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    conditional: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    monitoring: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    incident: 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse',
    reevaluation: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    suspended: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    offboarded: 'bg-gray-500/20 text-gray-500 border-gray-500/30'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize border ${styles[status]}`}>
      {status}
    </span>
  );
};
