import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { store, WorkflowRunLog } from './services/store';
import {
  Vendor, VendorTechnology, Questionnaire, Assessment, VendorFinding,
  MonitoringJob, User, AuditLogEntry, ScoreHistoryEntry, AlertNotification
} from './types';
import { Navigation, NavTab } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { VendorsView } from './components/VendorsView';
import { FindingsView } from './components/FindingsView';
import { WorkflowsView } from './components/WorkflowsView';
import { AssessmentsView } from './components/AssessmentsView';
import { AlertsView } from './components/AlertsView';
import { HealthView } from './components/HealthView';
import { AuditView } from './components/AuditView';
import { LoginView } from './components/LoginView';
import { AssessmentPortalView } from './components/AssessmentPortalView';
import { setApiAccessToken, isApiConfigured } from './services/api';
import { isSupabaseConfigured, supabase } from './services/supabase';
import { CheckCircle2, AlertOctagon, Loader2 } from 'lucide-react';

function getPublicAssessmentToken(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/portal\/assessment\/([^/]+)\/?$/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

export function App() {
  const publicAssessmentToken = getPublicAssessmentToken();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [activeRole, setActiveRole] = useState<string>('sin rol');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [vendors, setVendors] = useState<Vendor[]>(store.getVendors());
  const [technologies, setTechnologies] = useState<VendorTechnology[]>(store.getTechnologies());
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>(store.getQuestionnaires());
  const [assessments, setAssessments] = useState<Assessment[]>(store.getAssessments());
  const [findings, setFindings] = useState<VendorFinding[]>(store.getFindings());
  const [jobs, setJobs] = useState<MonitoringJob[]>(store.getMonitoringJobs());
  const [users, setUsers] = useState<User[]>(store.getUsers());
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(store.getAuditLog());
  const [auditArchive, setAuditArchive] = useState<AuditLogEntry[]>(store.getAuditArchive());
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryEntry[]>(store.getScoreHistory());
  const [alerts, setAlerts] = useState<AlertNotification[]>(store.getAlerts());
  const [workflowLogs, setWorkflowLogs] = useState<WorkflowRunLog[]>(store.getWorkflowLogs());

  const [isExecuting, setIsExecuting] = useState(false);
  const [executingWfId, setExecutingWfId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string; type: 'success' | 'alert' } | null>(null);

  const refreshFromStore = () => {
    setVendors([...store.getVendors()]);
    setTechnologies([...store.getTechnologies()]);
    setAssessments([...store.getAssessments()]);
    setQuestionnaires([...store.getQuestionnaires()]);
    setFindings([...store.getFindings()]);
    setJobs([...store.getMonitoringJobs()]);
    setUsers([...store.getUsers()]);
    setAuditLog([...store.getAuditLog()]);
    setAuditArchive([...store.getAuditArchive()]);
    setScoreHistory([...store.getScoreHistory()]);
    setAlerts([...store.getAlerts()]);
    setWorkflowLogs([...store.getWorkflowLogs()]);
  };

  const showToast = (title: string, desc: string, type: 'success' | 'alert' = 'success') => {
    setToastMessage({ title, desc, type });
    window.setTimeout(() => setToastMessage(null), 5000);
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setLoginError(error.message);
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoginError(null);
    });
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (publicAssessmentToken) return;
    if (!session?.access_token) {
      setApiAccessToken(null);
      setCurrentUser(null);
      return;
    }

    let active = true;
    setApiAccessToken(session.access_token);
    setDataLoading(true);
    const unsubscribe = store.subscribe(refreshFromStore);
    store.hydrateFromApi()
      .then(() => {
        if (!active) return;
        const matched = store.getUsers().find((user) => user.email?.toLowerCase() === session.user.email?.toLowerCase()) || null;
        setCurrentUser(matched);
        setActiveRole(matched?.roles?.[0] || 'sin rol');
      })
      .catch((error) => {
        if (!active) return;
        showToast('No se pudo cargar VRM', error instanceof Error ? error.message : 'Error al consultar la API.', 'alert');
      })
      .finally(() => {
        if (active) setDataLoading(false);
      });

    const onApiError = (event: Event) => {
      const message = (event as CustomEvent<string>).detail || 'Error de sincronización.';
      showToast('Error al guardar cambios', message, 'alert');
    };
    window.addEventListener('vrm-api-error', onApiError);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('vrm-api-error', onApiError);
      setApiAccessToken(null);
    };
  }, [session?.access_token, publicAssessmentToken]);

  const handleLogin = async (email: string, password: string) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setApiAccessToken(null);
    setSession(null);
  };

  const handleExecuteWorkflow = async (wfId: string) => {
    setIsExecuting(true);
    setExecutingWfId(wfId);
    try {
      const runLog = await store.executeWorkflow(wfId);
      showToast(runLog.workflowName, runLog.summary, 'success');
    } catch (error) {
      showToast('No se pudo ejecutar el workflow', error instanceof Error ? error.message : 'Error inesperado.', 'alert');
    } finally {
      setIsExecuting(false);
      setExecutingWfId(null);
    }
  };

  const handleQuickRun = async () => {
    setIsExecuting(true);
    try {
      for (const workflowId of ['wf-01', 'wf-03', 'wf-07']) {
        await store.executeWorkflow(workflowId);
      }
      showToast('Solicitudes enviadas', 'n8n aceptó las solicitudes de los workflows configurados.', 'success');
    } catch (error) {
      showToast('No se completó el escaneo', error instanceof Error ? error.message : 'Revisa la configuración de n8n.', 'alert');
    } finally {
      setIsExecuting(false);
    }
  };

  if (publicAssessmentToken) {
    return <AssessmentPortalView token={publicAssessmentToken} />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
        <span className="text-sm">Comprobando sesión…</span>
      </div>
    );
  }

  if (!isSupabaseConfigured || !isApiConfigured() || !session) {
    return (
      <LoginView
        configured={isSupabaseConfigured}
        apiConfigured={isApiConfigured()}
        loading={loginLoading}
        error={loginError}
        onSubmit={handleLogin}
      />
    );
  }

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
        <span className="text-sm">Conectando con Supabase…</span>
      </div>
    );
  }

  const openFindingsCount = findings.filter((finding) => finding.status === 'open' || finding.status === 'in_progress').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        openCount={openFindingsCount}
        alertsCount={alerts.length}
        activeRole={activeRole}
        onQuickRun={handleQuickRun}
        userEmail={currentUser?.email || session.user.email || ''}
        onSignOut={handleSignOut}
      />

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm p-4 rounded-xl shadow-2xl border backdrop-blur-md bg-slate-900/95 border-cyan-500/60">
          <div className="flex items-start gap-3">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            ) : (
              <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-bold text-white">{toastMessage.title}</div>
              <div className="text-[11px] text-slate-300 mt-0.5">{toastMessage.desc}</div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'dashboard' && (
          <DashboardView
            vendors={vendors} findings={findings} jobs={jobs} alerts={alerts}
            onSelectTab={setCurrentTab}
            onExecuteWorkflow={handleExecuteWorkflow}
            onSelectVendor={(vendorId) => { setSelectedVendorId(vendorId); setCurrentTab('vendors'); }}
          />
        )}
        {currentTab === 'vendors' && (
          <VendorsView
            vendors={vendors} technologies={technologies} findings={findings}
            assessments={assessments} scoreHistory={scoreHistory}
            selectedVendorId={selectedVendorId}
            onSelectVendor={setSelectedVendorId}
            onOpenFindingTab={() => setCurrentTab('findings')}
          />
        )}
        {currentTab === 'findings' && (
          <FindingsView findings={findings} vendors={vendors}
            onSelectVendor={(vendorId) => { setSelectedVendorId(vendorId); setCurrentTab('vendors'); }}
          />
        )}
        {currentTab === 'workflows' && (
          <WorkflowsView jobs={jobs} logs={workflowLogs}
            onExecuteWorkflow={handleExecuteWorkflow}
            isExecuting={isExecuting} executingWfId={executingWfId}
          />
        )}
        {currentTab === 'assessments' && (
          <AssessmentsView assessments={assessments} vendors={vendors} questionnaires={questionnaires}
            onSelectVendor={(vendorId) => { setSelectedVendorId(vendorId); setCurrentTab('vendors'); }}
            onExecuteWorkflow={handleExecuteWorkflow}
          />
        )}
        {currentTab === 'alerts' && <AlertsView alerts={alerts} vendors={vendors} />}
        {currentTab === 'health' && (
          <HealthView jobs={jobs} onExecuteWorkflow={handleExecuteWorkflow} isExecuting={isExecuting} />
        )}
        {currentTab === 'audit' && <AuditView auditLog={auditLog} auditArchive={auditArchive} onExecuteWorkflow={handleExecuteWorkflow} />}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">VRM Automation Platform</span>
            <span>·</span><span>n8n Workflows 00–10</span><span>·</span><span>Supabase PostgreSQL</span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span>NVD 2.0 API</span><span>·</span><span>crt.sh Logs</span><span>·</span>
            <span>TLS X.509</span><span>·</span><span>Shodan Recon</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
