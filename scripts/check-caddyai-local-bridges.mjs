#!/usr/bin/env node

const LLM_BASE = process.env.CADDYAI_LLM_BASE || 'http://127.0.0.1:11434';
const LLM_TOKEN = process.env.CADDYAI_LLM_TOKEN || 'codex-local-dev';
const CTI_BASE = process.env.CADDYAI_CTI_BASE || 'http://127.0.0.1:8766';

async function getJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // Keep raw body for diagnostics.
    }
    return { ok: response.ok, status: response.status, text, json };
  } catch (error) {
    return { ok: false, status: 0, text: error.message, json: null };
  } finally {
    clearTimeout(timer);
  }
}

function printCheck(name, result, detail = '') {
  const mark = result ? 'OK ' : 'ERR';
  console.log(`${mark} ${name}${detail ? ` - ${detail}` : ''}`);
}

const llmHealth = await getJson(`${LLM_BASE}/health`);
const llmLooksRight = llmHealth.ok && !!llmHealth.json?.served_model_name;
printCheck(
  `Local LLM health ${LLM_BASE}/health`,
  llmLooksRight,
  llmHealth.ok
    ? `served_model_name=${llmHealth.json?.served_model_name ?? 'missing'}`
    : `${llmHealth.status || 'network'} ${llmHealth.text.slice(0, 120)}`,
);

if (llmHealth.json?.service === 'cti-caddyai-bridge') {
  console.log('ERR Local LLM endpoint is pointing at the CTI Agent Host. Use the CTI URL only in Settings > AI > Agent Hosts.');
}

const models = await getJson(`${LLM_BASE}/v1/models`, {
  headers: { Authorization: `Bearer ${LLM_TOKEN}` },
});
printCheck(
  `Local LLM models ${LLM_BASE}/v1/models`,
  models.ok && Array.isArray(models.json?.data),
  models.ok
    ? `models=${(models.json.data || []).map((m) => m.id).join(', ') || 'none'}`
    : `${models.status || 'network'} ${models.text.slice(0, 120)}`,
);

const ctiHealth = await getJson(`${CTI_BASE}/health`);
const ctiLooksRight = ctiHealth.ok && ctiHealth.json?.service === 'cti-caddyai-bridge';
printCheck(
  `CTI Agent Host health ${CTI_BASE}/health`,
  ctiLooksRight,
  ctiHealth.ok
    ? `service=${ctiHealth.json?.service ?? 'missing'}`
    : `${ctiHealth.status || 'network'} ${ctiHealth.text.slice(0, 120)}`,
);

if (ctiHealth.json?.served_model_name) {
  console.log('ERR CTI Agent Host URL is pointing at the Local LLM bridge. Use the LLM URL only in Settings > AI/LLM.');
}

const skills = await getJson(`${CTI_BASE}/skills`);
printCheck(
  `CTI Agent Host skills ${CTI_BASE}/skills`,
  skills.ok && Array.isArray(skills.json),
  skills.ok
    ? `skills=${Array.isArray(skills.json) ? skills.json.length : 0}`
    : `${skills.status || 'network'} ${skills.text.slice(0, 120)}`,
);

console.log('');
console.log('Expected ThreatCaddy settings:');
console.log(`- Settings > AI/LLM > Local LLM endpoint: ${LLM_BASE}/v1`);
console.log('- Settings > AI/LLM > Local LLM API Key: token configured on the local bridge');
console.log(`- Settings > AI > Agent Hosts > CTI Agent Host URL: ${CTI_BASE}`);

process.exit(llmLooksRight && models.ok && ctiLooksRight && skills.ok ? 0 : 1);
