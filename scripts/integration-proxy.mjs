import http from 'node:http';
import { URL } from 'node:url';
import dns from 'node:dns/promises';
import net from 'node:net';

const HOST = process.env.THREATCADDY_INTEGRATION_PROXY_HOST || '127.0.0.1';
const PORT = Number(process.env.THREATCADDY_INTEGRATION_PROXY_PORT || '8767');
const MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_ALLOWED_HOSTS = new Set([
  'www.virustotal.com',
  'api.abuseipdb.com',
  'api.shodan.io',
  'urlhaus-api.abuse.ch',
  'threatfox-api.abuse.ch',
  'mb-api.abuse.ch',
  'api.greynoise.io',
]);

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    return (
      address === '127.0.0.1' ||
      address === '0.0.0.0' ||
      address.startsWith('10.') ||
      address.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(address) ||
      /^169\.254\./.test(address)
    );
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
  }
  return true;
}

async function assertSafeUrl(urlString, requiredDomains = []) {
  const parsed = new URL(urlString);
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error(`Blocked URL scheme: ${parsed.protocol}`);
  }
  const requestedDomains = Array.isArray(requiredDomains)
    ? requiredDomains.map((domain) => String(domain).trim().toLowerCase()).filter(Boolean)
    : [];
  const allowedByTemplate = requestedDomains.length > 0
    ? requestedDomains.some((domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`))
    : false;
  if (!allowedByTemplate && !DEFAULT_ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Blocked host: ${parsed.hostname}`);
  }
  const answers = await dns.lookup(parsed.hostname, { all: true });
  if (answers.some((answer) => isPrivateIp(answer.address))) {
    throw new Error(`Blocked private address for host: ${parsed.hostname}`);
  }
  return parsed;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true, service: 'threatcaddy-integration-proxy' });
    return;
  }
  if (req.method !== 'POST' || req.url !== '/api/proxy-fetch') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  try {
    const body = await readJson(req);
    const targetUrl = String(body.url || '');
    const method = String(body.method || 'GET').toUpperCase();
    const headers = body.headers && typeof body.headers === 'object' ? body.headers : {};
    const requestBody = typeof body.body === 'string' ? body.body : null;
    const parsed = await assertSafeUrl(targetUrl, body.requiredDomains);

    const upstream = await fetch(parsed, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : requestBody,
    });
    const contentType = upstream.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await upstream.json().catch(() => null)
      : await upstream.text();
    const responseHeaders = {};
    upstream.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    sendJson(res, 200, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
      data,
    });
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ThreatCaddy integration proxy listening on http://${HOST}:${PORT}`);
});
