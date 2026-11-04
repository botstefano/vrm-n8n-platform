import React, { useState } from 'react';
import { ShieldAlert, LockKeyhole, Mail, Loader2, AlertCircle } from 'lucide-react';

interface LoginViewProps {
  configured: boolean;
  loading: boolean;
  error: string | null;
  onSubmit: (email: string, password: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ configured, loading, error, onSubmit }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit(email.trim(), password);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <ShieldAlert className="w-7 h-7 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">VRM Platform</h1>
          <p className="mt-2 text-sm text-slate-400">Automatización Continua de Riesgo de Proveedores</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">Iniciar sesión</h2>
            <p className="text-xs text-slate-400 mt-1">Accede con tu cuenta de Supabase Auth.</p>
          </div>

          {!configured && (
            <div className="rounded-lg border border-amber-700/60 bg-amber-950/30 p-3 text-xs text-amber-200">
              Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en las variables del frontend de Render.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-200 flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Correo electrónico</span>
            <span className="relative block">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@empresa.com"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-cyan-500"
              />
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Contraseña</span>
            <span className="relative block">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contraseña"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-cyan-500"
              />
            </span>
          </label>

          <button
            type="submit"
            disabled={!configured || loading || !email.trim() || !password}
            className="w-full rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LockKeyhole className="w-4 h-4" />}
            {loading ? 'Verificando…' : 'Entrar'}
          </button>
        </form>
        <p className="mt-5 text-center text-[11px] text-slate-600">Acceso protegido mediante Supabase Auth y permisos VRM.</p>
      </div>
    </main>
  );
};
