import React, { useState, useEffect } from 'react';
import { store, WorkflowRunLog } from './services/store';
import {
  Vendor,
  VendorTechnology,
  Questionnaire,
  Assessment,
  VendorFinding,
  MonitoringJob,
  User,
  AuditLogEntry,
  ScoreHistoryEntry,
  AlertNotification
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
import { ShieldAlert, CheckCircle2, AlertOctagon } from 'lucide-react';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [activeRole, setActiveRole] = useState<string>('admin');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  // Reactive store state
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

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingWfId, setExecutingWfId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string; type: 'success' | 'alert' } | null>(null);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setVendors([...store.getVendors()]);
      setTechnologies([...store.getTechnologies()]);
      setQuestionnaires([...store.getQuestionnaires()]);
      setAssessments([...store.getAssessments()]);
      setFindings([...store.getFindings()]);
      setJobs([...store.getMonitoringJobs()]);
      setUsers([...store.getUsers()]);
      setAuditLog([...store.getAuditLog()]);
      setAuditArchive([...store.getAuditArchive()]);
      setScoreHistory([...store.getScoreHistory()]);
      setAlerts([...store.getAlerts()]);
      setWorkflowLogs([...store.getWorkflowLogs()]);
    });
    return unsubscribe;
  }, []);

  const showToast = (title: string, desc: string, type: 'success' | 'alert' = 'success') => {
    setToastMessage({ title, desc, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleExecuteWorkflow = async (wfId: string) => {
    setIsExecuting(true);
    setExecutingWfId(wfId);
    try {
      const runLog = await store.executeWorkflow(wfId);
      showToast(runLog.workflowName, runLog.summary, 'success');
    } catch (e: any) {
      showToast('Error en Ejecución', e.message || 'Fallo inesperado', 'alert');
    } finally {
      setIsExecuting(false);
      setExecutingWfId(null);
    }
  };

  const handleQuickRun = async () => {
    setIsExecuting(true);
    try {
      await store.executeWorkflow('wf-01');
      await store.executeWorkflow('wf-03');
      await store.executeWorkflow('wf-07');
      showToast('Escaneo Completo', 'Se ejecutaron WF-01 (NVD), WF-03 (TLS) y WF-07 (Scorecards).', 'success');
    } finally {
      setIsExecuting(false);
    }
  };

  const openFindingsCount = findings.filter((f) => f.status === 'open' || f.status === 'in_progress').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Navigation Bar */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        openCount={openFindingsCount}
        alertsCount={alerts.length}
        activeRole={activeRole}
        onSelectRole={setActiveRole}
        onQuickRun={handleQuickRun}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm p-4 rounded-xl shadow-2xl border backdrop-blur-md transition-all animate-bounce-short bg-slate-900/95 border-cyan-500/60">
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'dashboard' && (
          <DashboardView
            vendors={vendors}
            findings={findings}
            jobs={jobs}
            alerts={alerts}
            onSelectTab={setCurrentTab}
            onExecuteWorkflow={handleExecuteWorkflow}
            onSelectVendor={(vId) => {
              setSelectedVendorId(vId);
              setCurrentTab('vendors');
            }}
          />
        )}

        {currentTab === 'vendors' && (
          <VendorsView
            vendors={vendors}
            technologies={technologies}
            findings={findings}
            assessments={assessments}
            scoreHistory={scoreHistory}
            selectedVendorId={selectedVendorId}
            onSelectVendor={setSelectedVendorId}
            onOpenFindingTab={() => setCurrentTab('findings')}
          />
        )}

        {currentTab === 'findings' && (
          <FindingsView
            findings={findings}
            vendors={vendors}
            onSelectVendor={(vId) => {
              setSelectedVendorId(vId);
              setCurrentTab('vendors');
            }}
          />
        )}

        {currentTab === 'workflows' && (
          <WorkflowsView
            jobs={jobs}
            logs={workflowLogs}
            onExecuteWorkflow={handleExecuteWorkflow}
            isExecuting={isExecuting}
            executingWfId={executingWfId}
          />
        )}

        {currentTab === 'assessments' && (
          <AssessmentsView
            assessments={assessments}
            vendors={vendors}
            questionnaires={questionnaires}
            onSelectVendor={(vId) => {
              setSelectedVendorId(vId);
              setCurrentTab('vendors');
            }}
          />
        )}

        {currentTab === 'alerts' && <AlertsView alerts={alerts} vendors={vendors} />}

        {currentTab === 'health' && (
          <HealthView
            jobs={jobs}
            onExecuteWorkflow={handleExecuteWorkflow}
            isExecuting={isExecuting}
          />
        )}

        {currentTab === 'audit' && (
          <AuditView auditLog={auditLog} auditArchive={auditArchive} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">VRM Automation Platform</span>
            <span>·</span>
            <span>n8n Workflows 00–10</span>
            <span>·</span>
            <span>PostgreSQL Schema + Seed</span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span>NVD 2.0 API</span>
            <span>·</span>
            <span>crt.sh Logs</span>
            <span>·</span>
            <span>TLS X.509</span>
            <span>·</span>
            <span>Shodan Recon</span>
            <span>·</span>
            <span>HMAC Portal</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default App;
