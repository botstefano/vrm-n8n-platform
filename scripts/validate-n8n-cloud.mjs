import fs from 'node:fs';
import path from 'node:path';

const workflowDir = 'automation/n8n/workflows';
const files = fs.readdirSync(workflowDir).filter((file) => file.endsWith('.json')).sort();
if (files.length !== 11) throw new Error(`Expected 11 workflows; found ${files.length}`);

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const requiredBackendCredential = 'VRM Backend Callback Auth';
const requiredAlertsCredential = 'VRM Alerts Webhook Auth';

for (const file of files) {
  const workflow = JSON.parse(fs.readFileSync(path.join(workflowDir, file), 'utf8'));
  const code = file.match(/^(wf-\d{2})-/)?.[1];
  const nodes = workflow.nodes || [];
  const nodeNames = new Set(nodes.map((node) => node.name));
  const serialized = JSON.stringify(workflow);

  if (serialized.includes('$env.')) throw new Error(`${file}: n8n Cloud workflow must use $vars or Credentials, not $env.`);
  if (/\\$vars\\.(?:N8N_WEBHOOK_SECRET|ALERTS_WEBHOOK_TOKEN|PORTAL_TOKEN_SECRET|SLACK_WEBHOOK_URL|SHODAN_API_KEY)/.test(serialized)) {
    throw new Error(`${file}: secret material must not be stored in n8n custom Variables.`);
  }

  for (const [source, outputs] of Object.entries(workflow.connections || {})) {
    if (!nodeNames.has(source)) throw new Error(`${file}: missing connection source ${source}`);
    for (const target of Object.values(outputs || {}).flat(2)) {
      if (!nodeNames.has(target.node)) throw new Error(`${file}: missing connection target ${target.node}`);
    }
  }

  for (const node of nodes) {
    if (node.type === 'n8n-nodes-base.code') {
      const codeText = node.parameters?.jsCode || '';
      if (/\\brequire\\s*\\(/.test(codeText)) throw new Error(`${file} / ${node.name}: Cloud Code node cannot import Node/npm modules.`);
      new AsyncFunction(codeText);
    }
    if (node.type === 'n8n-nodes-base.httpRequest') {
      const url = String(node.parameters?.url || '');
      if (url.includes('/api/v1/webhooks/n8n/')) {
        if (node.credentials?.httpHeaderAuth?.name !== requiredBackendCredential) {
          throw new Error(`${file} / ${node.name}: backend webhooks must use ${requiredBackendCredential}.`);
        }
      }
    }
  }

  if (code !== 'wf-00') {
    const manual = nodes.find((node) => node.name === 'Manual Trigger');
    if (!manual || manual.parameters?.path !== `vrm-manual/${code}` ||
        manual.parameters?.authentication !== 'headerAuth' ||
        manual.credentials?.httpHeaderAuth?.name !== requiredAlertsCredential) {
      throw new Error(`${file}: manual webhook must use VRM Alerts Webhook Auth.`);
    }
    const completion = nodes.find((node) => node.name === 'Report Manual Completion');
    if (!completion || completion.credentials?.httpHeaderAuth?.name !== requiredBackendCredential) {
      throw new Error(`${file}: missing authenticated completion callback.`);
    }
  }
}

const byFile = (name) => JSON.parse(fs.readFileSync(path.join(workflowDir, name), 'utf8'));
const tls = byFile('wf-03-tls-expiry.json');
if (tls.nodes.find((node) => node.name === 'Probe TLS')?.type !== 'n8n-nodes-base.httpRequest' ||
    !String(tls.nodes.find((node) => node.name === 'Probe TLS')?.parameters?.url || '').includes('/tls-scan')) {
  throw new Error('WF-03 must delegate TLS probing to the Render API.');
}
if (!tls.nodes.some((node) => node.name === 'Expand TLS Results')) throw new Error('WF-03 must expand backend scan findings.');

const attack = byFile('wf-04-attack-surface.json');
if (!String(attack.nodes.find((node) => node.name === 'Resolve IP')?.parameters?.url || '').includes('/resolve-host')) {
  throw new Error('WF-04 must use the backend public-DNS resolver.');
}
if (attack.nodes.some((node) => node.type === 'n8n-nodes-base.code' && /\\brequire\\s*\\(/.test(node.parameters?.jsCode || ''))) {
  throw new Error('WF-04 cannot import Node modules in n8n Cloud.');
}

const reevaluation = byFile('wf-05-reevaluation.json');
if (!String(reevaluation.nodes.find((node) => node.name === 'Sign Portal Link')?.parameters?.url || '').includes('/assessment-link')) {
  throw new Error('WF-05 must delegate HMAC signing to the Render API.');
}

const alerts = byFile('wf-06-alerts.json');
if (alerts.nodes.some((node) => node.type === 'n8n-nodes-base.redis')) throw new Error('WF-06 must use PostgreSQL-backed deduplication, not Redis.');
if (!String(alerts.nodes.find((node) => node.name === 'Slack')?.parameters?.url || '').includes('/slack-delivery')) {
  throw new Error('WF-06 must send Slack messages through the private Render relay.');
}
const callbackBuilders = alerts.nodes.filter((node) => node.name.startsWith('Build Alert Callback'));
if (callbackBuilders.length !== 3) throw new Error('WF-06 must report sent, Slack-failed, and email-failed delivery states.');

for (const name of ['wf-01-nvd-cve.json','wf-02-ct-logs.json','wf-04-attack-surface.json']) {
  const wf = byFile(name);
  if (wf.nodes.some((node) => node.name === 'Send Alert')) throw new Error(`${name}: scanner alerts must be dispatched through findings-created.`);
}

console.log(`Validated ${files.length} n8n Cloud workflows and all Code nodes.`);
