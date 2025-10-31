const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Use built CJS library
let store;
try {
  store = require('../dist/cjs');
} catch (e) {
  console.error('Please build the library first: npm run build:cjs');
  process.exit(1);
}

const hasProxyHelpers =
  typeof store.configureDefaultProxy === 'function' &&
  typeof store.configureCountryProxies === 'function' &&
  typeof store.getCountryProxyMap === 'function' &&
  typeof store.setProxyUsageListener === 'function';

const configureDefaultProxy = hasProxyHelpers ? store.configureDefaultProxy : () => {};
const configureCountryProxies = hasProxyHelpers ? store.configureCountryProxies : () => {};
const getCountryProxyMap = hasProxyHelpers ? store.getCountryProxyMap : () => ({});
const setProxyUsageListener = hasProxyHelpers ? store.setProxyUsageListener : () => {};

const PUBLIC_DIR = path.join(__dirname, 'public');

const envProxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';

let proxyState = {
  proxies: [],
};

function normalizeCountryCode(value) {
  if (!value) return '';
  return String(value).trim().toUpperCase();
}

function maskProxyUrl(raw) {
  if (!raw) return '';
  const candidate = raw.includes('://') ? raw : `http://${raw}`;
  try {
    const parsed = new URL(candidate);
    const auth = parsed.username || parsed.password ? '***@' : '';
    const hostPort = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    return `${parsed.protocol}//${auth}${hostPort}`;
  } catch {
    return raw;
  }
}

function coerceProxyEntry(entry) {
  if (!entry || typeof entry !== 'object') return { error: 'Invalid proxy entry' };
  const country = normalizeCountryCode(entry.country);
  if (!country) return { error: 'Country code required' };
  const proxyUrl = typeof entry.proxyUrl === 'string' ? entry.proxyUrl.trim() : '';
  if (!proxyUrl) return { error: `Proxy URL required for ${country}` };
  const candidate = proxyUrl.includes('://') ? proxyUrl : `http://${proxyUrl}`;
  try {
    const parsed = new URL(candidate);
    const protocol = parsed.protocol.replace(':', '').toLowerCase();
    if (protocol !== 'http' && protocol !== 'https') {
      return { error: `Proxy for ${country} must start with http:// or https://` };
    }
  } catch {
    return { error: `Invalid proxy URL for ${country}` };
  }
  return {
    country,
    proxyUrl: candidate,
    allowInvalidCerts: !!entry.allowInvalidCerts,
  };
}

function applyProxyState(nextProxies) {
  proxyState = {
    proxies: nextProxies.slice(),
  };
  if (!hasProxyHelpers) return;
  configureDefaultProxy(false);
  if (!proxyState.proxies.length) {
    configureCountryProxies(undefined);
    return;
  }
  const map = proxyState.proxies.reduce((acc, entry) => {
    if (!entry.country || !entry.proxyUrl) return acc;
    acc[entry.country] = entry.allowInvalidCerts
      ? { url: entry.proxyUrl, rejectUnauthorized: false }
      : entry.proxyUrl;
    return acc;
  }, {});
  configureCountryProxies(map);
}

function runtimeProxyEntries() {
  if (!hasProxyHelpers) return [];
  const map = getCountryProxyMap() || {};
  return Object.entries(map).map(([country, config]) => ({
    country,
    proxyUrl: config.url,
    displayUrl: config.displayUrl,
    allowInvalidCerts: config.rejectUnauthorized === false,
    hasCredentials: !!config.hasCredentials,
  }));
}

function hydrateProxyStateFromRuntime() {
  if (!hasProxyHelpers) return;
  const existing = runtimeProxyEntries();
  if (!existing.length) return;
  applyProxyState(existing.map((entry) => ({
    country: entry.country,
    proxyUrl: entry.proxyUrl,
    allowInvalidCerts: entry.allowInvalidCerts,
  })));
}

function buildProxyResponse() {
  const runtime = runtimeProxyEntries();
  return {
    proxies: proxyState.proxies,
    activeProxies: runtime,
    envProxy: envProxyUrl,
    envMasked: maskProxyUrl(envProxyUrl),
    controlsEnabled: hasProxyHelpers,
    usingProxy: runtime.length > 0,
  };
}

function logProxyEvent(event) {
  const ts = new Date().toISOString();
  const countryTag = event.country ? `${String(event.country).toUpperCase()} ` : '';
  if (event.viaProxy && event.proxy) {
    const insecure = event.proxy.rejectUnauthorized === false ? ' ⚠ allow-invalid-cert' : '';
    const note = event.reason && event.reason !== 'proxy' ? ` (${event.reason})` : '';
    console.log(
      `[proxy] ${ts} ${countryTag}proxy[${event.proxy.displayUrl}]${insecure} -> ${event.targetUrl}${note}`,
    );
  } else {
    const note = event.reason && event.reason !== 'direct' ? ` (${event.reason})` : '';
    const fallbackLabel = event.proxy?.displayUrl ? `proxy[${event.proxy.displayUrl}]` : 'direct';
    console.log(`[proxy] ${ts} ${countryTag}${fallbackLabel}${note} -> ${event.targetUrl}`);
  }
  if (event.error && event.reason !== 'proxy') {
    console.warn('[proxy] warning:', event.error);
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

if (hasProxyHelpers) {
  hydrateProxyStateFromRuntime();
  if (!proxyState.proxies.length) applyProxyState([]);
  setProxyUsageListener(logProxyEvent);
} else {
  console.warn('Proxy helper APIs unavailable—update the build to enable proxy controls and logging.');
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data, null, 2));
}

function sendError(res, err) {
  const status = err?.statusCode || err?.response?.statusCode || 500;
  sendJson(res, status, { error: err?.message || 'Unknown error', status });
}

function toBool(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

function toNum(v) {
  if (v === undefined) return v;
  return /^-?\d+$/.test(v) ? Number(v) : v;
}

function normalize(opts) {
  const out = {};
  for (const [k, v] of Object.entries(opts)) {
    if (v === '') continue;
    if (['num', 'page', 'id', 'devId', 'primaryGenreId'].includes(k)) out[k] = toNum(v);
    else if (['fullDetail', 'idsOnly', 'ratings'].includes(k)) out[k] = toBool(v);
    else out[k] = v;
  }
  return out;
}

function serveStatic(urlPath, res) {
  let file = 'index.html';
  if (urlPath !== '/' && !urlPath.startsWith('/api/')) file = urlPath.slice(1);
  const filePath = path.join(PUBLIC_DIR, file);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    const type = ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'text/html';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

async function handleApi(pathname, searchParams, res) {
  const method = pathname.replace(/^\/api\//, '');
  const opts = normalize(Object.fromEntries(searchParams.entries()));

  try {
    switch (method) {
      case 'app': return sendJson(res, 200, await store.app(opts));
      case 'list': return sendJson(res, 200, await store.list(opts));
      case 'search': return sendJson(res, 200, await store.search(opts));
      case 'developer': return sendJson(res, 200, await store.developer(opts));
      case 'suggest': return sendJson(res, 200, await store.suggest(opts));
      case 'similar': return sendJson(res, 200, await store.similar(opts));
      case 'reviews': return sendJson(res, 200, await store.reviews(opts));
      case 'ratings': return sendJson(res, 200, await store.ratings(opts));
      case 'privacy': return sendJson(res, 200, await store.privacy(opts));
      case 'versionHistory': return sendJson(res, 200, await store.versionHistory(opts));
      default: return sendJson(res, 404, { error: 'Unknown API method' });
    }
  } catch (err) {
    return sendError(res, err);
  }
}

async function handleProxyConfig(req, res) {
  if (req.method === 'GET') {
    return sendJson(res, 200, buildProxyResponse());
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json', 'Allow': 'GET, POST' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  if (!hasProxyHelpers) {
    return sendJson(res, 501, { error: 'Proxy controls unavailable in this build' });
  }
  try {
    const payload = await readJsonBody(req);
    const rawEntries = Array.isArray(payload?.proxies) ? payload.proxies : [];
    const errors = [];
    const normalized = [];
    rawEntries.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') return;
      const country = normalizeCountryCode(entry.country);
      const proxyUrl = typeof entry.proxyUrl === 'string' ? entry.proxyUrl.trim() : '';
      if (!country && !proxyUrl) return; // ignore blank rows
      const coerced = coerceProxyEntry(entry);
      if (coerced.error) {
        errors.push(coerced.error + ` (row ${index + 1})`);
        return;
      }
      normalized.push(coerced);
    });
    if (errors.length) return sendJson(res, 400, { error: errors[0] });
    applyProxyState(normalized);
    return sendJson(res, 200, buildProxyResponse());
  } catch (err) {
    return sendJson(res, 400, { error: err?.message || 'Invalid proxy payload' });
  }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/api/system/proxy') {
    return handleProxyConfig(req, res);
  }
  if (u.pathname.startsWith('/api/')) {
    return handleApi(u.pathname, u.searchParams, res);
  }
  return serveStatic(u.pathname, res);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`UI Test server running at http://localhost:${PORT}`);
});
