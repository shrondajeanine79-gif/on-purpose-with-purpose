import test from 'node:test';
import assert from 'node:assert/strict';
import { startDashboard } from '../src/local/dashboard.js';
import { createMemoryD1 } from '../src/d1.js';

const fakeResponse = { choices: [{ message: { content: 'A read-only recommendation.' } }], usage: { prompt_tokens: 25, completion_tokens: 12 } };

async function fixture(t) {
  const db = createMemoryD1(); let calls = 0;
  const app = await startDashboard({ port: 0, db, env: { HIVE_API_KEY: 'placeholder-test-only' }, fetchImpl: async () => { calls++; return new Response(JSON.stringify(fakeResponse)); } });
  t.after(async () => { await new Promise(resolve => { app.server.close(resolve); app.server.closeAllConnections(); }); db.close(); });
  const post = (path, body, cookie, origin = app.origin) => fetch(app.origin + path, { method: 'POST', headers: { Origin: origin, 'X-Purpose-Request': 'dashboard', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
  const auth = await post('/session', { token: app.launchUrl.split('#')[1] });
  const cookie = auth.headers.get('set-cookie').split(';')[0];
  return { app, post, cookie, calls: () => calls };
}

test('dashboard refuses unauthenticated API access and hostile origins', async t => {
  const {app,post,cookie,calls} = await fixture(t);
  assert.equal((await fetch(app.origin + '/dashboard/state')).status,401);
  assert.equal((await post('/dashboard/prepare',{request:'test',context:''},cookie,'https://other.invalid')).status,403);
  assert.equal((await post('/session',{token:'wrong'})).status,401);
  const data = await (await fetch(app.origin+'/dashboard/state',{headers:{Cookie:cookie}})).text();
  assert.ok(!data.includes('placeholder-test-only'));
  assert.equal(calls(),0);
  assert.equal((await fetch(app.origin+'/api/send',{headers:{Cookie:cookie}})).status,404);
});

test('review makes no model call; explicit approval runs once and saves the result', async t => {
  const {app,post,cookie,calls} = await fixture(t);
  const prepared = await (await post('/dashboard/prepare',{request:'Review supplied facts only.',context:'Contact form is active.'},cookie)).json();
  assert.equal(prepared.approval.status,'pending'); assert.equal(calls(),0);
  assert.equal((await post('/dashboard/run',{approvalId:prepared.approval.id},cookie)).status,422);
  assert.equal(calls(),0);
  const result = await post('/dashboard/run',{approvalId:prepared.approval.id,confirm:true},cookie);
  assert.equal(result.status,200); assert.equal((await result.json()).executed,false); assert.equal(calls(),1);
  assert.equal((await post('/dashboard/run',{approvalId:prepared.approval.id,confirm:true},cookie)).status,409);
  const state = await (await fetch(app.origin+'/dashboard/state',{headers:{Cookie:cookie}})).json();
  assert.equal(state.history.length,1); assert.equal(state.audit.ok,true); assert.equal(state.usage.today.requests,1);
});

test('cancelled approval cannot make a model call', async t => {
  const {post,cookie,calls} = await fixture(t);
  const prepared = await (await post('/dashboard/prepare',{request:'Review this.',context:''},cookie)).json();
  assert.equal((await post('/dashboard/reject',{approvalId:prepared.approval.id},cookie)).status,200);
  assert.equal((await post('/dashboard/run',{approvalId:prepared.approval.id,confirm:true},cookie)).status,409);
  assert.equal(calls(),0);
});
