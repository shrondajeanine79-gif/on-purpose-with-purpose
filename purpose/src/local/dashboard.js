import { createServer } from 'node:http';
import { randomBytes, generateKeyPairSync, sign, timingSafeEqual } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { LocalD1 } from '../d1.js';
import { createLocalApp } from './server.js';
import { loadGovernance, loadBrandStandard, loadInventory, DATA_DIR } from '../config.js';
import { startOfUtcDay, startOfUtcMonth } from '../budget.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ASSETS = join(ROOT, 'dashboard');
const OWNER = 'shronda@purpose-local.invalid';

function equal(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
function openBrowser(url) {
  const cmd = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => {});
  child.unref();
}
export function loadSavedHiveKey() {
  const path = join(homedir(), 'HiveAI', '.env');
  if (existsSync(path)) {
    // Read only this saved environment file; never return its contents to the browser.
    const { parseEnv } = process.getBuiltinModule('node:util');
    const saved = parseEnv(readFileSync(path, 'utf8'));
    for (const name of ['HIVE_API_KEY', 'HIVE_BASE_URL', 'HIVE_MODEL']) {
      if (!process.env[name] && saved[name]) process.env[name] = saved[name];
    }
  }
}

export async function startDashboard({ port = 8788, db, env = process.env, fetchImpl, open = false } = {}) {
  const ownsDb = !db;
  if (!db) {
    mkdirSync(DATA_DIR, { recursive: true });
    db = new LocalD1(join(DATA_DIR, 'dashboard.db'));
    db.applyMigration();
  }
  db.exec('CREATE TABLE IF NOT EXISTS dashboard_results (id TEXT PRIMARY KEY, at TEXT NOT NULL, request TEXT NOT NULL, response TEXT NOT NULL)');
  const boot = randomBytes(32).toString('hex');
  const session = randomBytes(32).toString('hex');
  const cookieName = 'purpose_local_session';
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = randomBytes(12).toString('hex');
  const jwks = { keys: [{ ...pair.publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' }] };
  const localEnv = { ...env, PURPOSE_AUTH_MODE: 'access', PURPOSE_ACCESS_TEAM_DOMAIN: 'purpose-local.invalid', PURPOSE_ACCESS_AUD: 'purpose-local-dashboard', PURPOSE_OWNER_EMAIL: OWNER, PURPOSE_ENABLE_HIVE: '1' };
  function token() {
    const at = Math.floor(Date.now() / 1000);
    const parts = [{ alg: 'RS256', typ: 'JWT', kid }, { iss: 'https://purpose-local.invalid', aud: 'purpose-local-dashboard', email: OWNER, sub: 'local-owner', iat: at, exp: at + 120 }].map(x => Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
    return parts + '.' + sign('RSA-SHA256', Buffer.from(parts), pair.privateKey).toString('base64url');
  }
  const { route, stores } = createLocalApp({ db, env: localEnv, jwks, fetchImpl: fetchImpl ?? ((url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(90000) })) });
  let origin;
  let activeRun = false;
  let closed = false;
  const headers = {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self' data:; connect-src 'self'; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  };
  const json = (res, body, status = 200, extra = {}) => {
    res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8', ...extra });
    res.end(JSON.stringify(body));
  };
  const invoke = async (path, method = 'GET', body) => {
    const request = new Request(origin + path, { method, headers: { 'cf-access-jwt-assertion': token(), 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const response = await route(request);
    return { status: response.status, body: await response.json() };
  };
  const server = createServer(async (req, res) => {
    Object.entries(headers).forEach(([k,v]) => res.setHeader(k,v));
    try {
      if (req.headers.host !== new URL(origin).host) return json(res, { error: 'Invalid host.' }, 403);
      const url = new URL(req.url, origin);
      const path = url.pathname;
      if (!['GET', 'POST'].includes(req.method)) return json(res, { error: 'Method not allowed.' }, 405);
      const mutating = req.method === 'POST';
      if (mutating && (req.headers.origin !== origin || req.headers['x-purpose-request'] !== 'dashboard')) return json(res, { error: 'Request origin refused.' }, 403);
      let body;
      if (mutating) {
        const parts = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 48000) { json(res, { error: 'Request too large.' }, 413); return; } parts.push(chunk); }
        try { body = JSON.parse(Buffer.concat(parts).toString() || '{}'); } catch { return json(res, { error: 'Invalid JSON.' }, 400); }
      }
      if (path === '/session' && mutating) {
        if (!equal(body.token, boot)) return json(res, { error: 'Open PURPOSE using its desktop shortcut.' }, 401);
        return json(res, { ok: true }, 200, { 'Set-Cookie': `${cookieName}=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200` });
      }
      const assets = { '/': ['index.html','text/html'], '/app.js': ['app.js','text/javascript'], '/style.css': ['style.css','text/css'], '/icon.svg': ['icon.svg','image/svg+xml'] };
      if (req.method === 'GET' && assets[path]) {
        const [file, type] = assets[path]; res.writeHead(200, { ...headers, 'Content-Type': type + '; charset=utf-8' }); return res.end(readFileSync(join(ASSETS, file)));
      }
      const cookies = Object.fromEntries((req.headers.cookie ?? '').split(';').map(x => x.trim().split('=')));
      if (!equal(cookies[cookieName], session)) return json(res, { error: 'Session locked. Open PURPOSE with its desktop shortcut.' }, 401);
      if (req.method === 'GET' && path === '/dashboard/state') {
        const gov = loadGovernance();
        return json(res, { owner: gov.owner.displayName, hiveConfigured: Boolean(localEnv.HIVE_API_KEY), integrations: gov.integrations, inventory: loadInventory(), brand: loadBrandStandard(), history: db.prepare('SELECT * FROM dashboard_results ORDER BY at DESC LIMIT 30').all().results.map(x => ({ ...x, response: JSON.parse(x.response) })), usage: { today: await stores.usage.totals(startOfUtcDay()), month: await stores.usage.totals(startOfUtcMonth()) }, audit: await stores.audit.verify() });
      }
      if (mutating && path === '/dashboard/prepare') {
        if (activeRun) return json(res, { error: 'An analysis is already running.' }, 409);
        if (typeof body.request !== 'string' || !body.request.trim() || body.request.length > 10000) return json(res, { error: 'Enter an instruction of up to 10,000 characters.' }, 422);
        if (typeof body.context !== 'string' || body.context.length > 14000) return json(res, { error: 'Context must be text, up to 14,000 characters.' }, 422);
        const gov = loadGovernance();
        const facts = JSON.stringify({ integrations: gov.integrations, brand: loadBrandStandard(), inventory: loadInventory() });
        const directive = { request: body.request.trim(), workflow: 'brand-audit', action: 'research', scope: 'Owner-requested read-only analysis of supplied text and recorded inventory only', audience: 'owner', actor: OWNER, notes: 'No web browsing or external tools are available. Inventory is a dated snapshot, not a fresh website audit. Unapproved brand fields are observations, not policy. Do not claim live checks. Owner-supplied context:\n' + body.context + '\nRecorded project context:\n' + facts };
        const result = await invoke('/api/approvals', 'POST', directive);
        return json(res, result.body, result.status);
      }
      if (mutating && path === '/dashboard/run') {
        if (activeRun) return json(res, { error: 'An analysis is already running.' }, 409);
        if (body.confirm !== true) return json(res, { error: 'Explicit confirmation is required.' }, 422);
        activeRun = true;
        try {
          const approval = await stores.approvals.get(body.approvalId);
          if (!approval || approval.status !== 'pending') return json(res, { error: 'This request is missing or already used. Review a fresh request.' }, 409);
          const directive = await stores.directives.get(approval.directiveId);
          if (!directive) return json(res, { error: 'Instruction not found.' }, 404);
          const approved = await invoke(`/api/approvals/${approval.id}/approve`, 'POST', { note: 'Owner clicked Approve & run in the local dashboard.' });
          if (approved.status !== 200) return json(res, approved.body, approved.status);
          const result = await invoke('/api/ai/analyze', 'POST', { ...directive, directiveId: directive.id, approvalId: approval.id });
          if (result.status === 200) db.prepare('INSERT INTO dashboard_results (id, at, request, response) VALUES (?, ?, ?, ?)').bind(directive.id, new Date().toISOString(), directive.request, JSON.stringify(result.body)).run();
          return json(res, result.body, result.status);
        } finally { activeRun = false; }
      }
      if (mutating && path === '/dashboard/reject') {
        const result = await invoke(`/api/approvals/${encodeURIComponent(body.approvalId)}/reject`, 'POST', { note: 'Cancelled by owner in local dashboard.' });
        return json(res, result.body, result.status);
      }
      if (mutating && path === '/dashboard/stop') {
        if (activeRun) return json(res, { error: 'Wait for the current analysis to finish.' }, 409);
        json(res, { ok: true }); setTimeout(() => close(), 100); return;
      }
      return json(res, { error: 'Not found.' }, 404);
    } catch { return json(res, { error: 'PURPOSE could not complete this request. No secret details were returned.' }, 500); }
  });
  function close() { if (closed) return; closed = true; server.close(() => { if (ownsDb) db.close(); }); server.closeIdleConnections(); }
  await new Promise((resolveReady, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolveReady); });
  origin = `http://127.0.0.1:${server.address().port}`;
  const launchUrl = origin + '/#' + boot;
  if (open) openBrowser(launchUrl);
  return { server, origin, launchUrl, close, db };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    loadSavedHiveKey();
    const app = await startDashboard({ open: process.argv.includes('--open'), port: Number(process.env.PURPOSE_DASHBOARD_PORT || 8788) });
    if (!process.argv.includes('--open')) console.log('Open this private session link on this computer:\n' + app.launchUrl);
    process.on('SIGINT', () => app.close());
    process.on('SIGTERM', () => app.close());
  } catch (error) {
    if (error.code === 'EADDRINUSE' && process.argv.includes('--open')) openBrowser('http://127.0.0.1:8788/');
    else { console.error('PURPOSE could not start. Use Node.js 22.13 or newer, or check whether port 8788 is already in use.'); process.exitCode = 1; }
  }
}
