const $ = id => document.getElementById(id);
let state, pending, lastResponse = '', currentView = 'ask';
const text = (tag, value, className) => { const e = document.createElement(tag); e.textContent = value ?? ''; if (className) e.className = className; return e; };
function notice(message) { $('notice').textContent = message; $('notice').hidden = !message; }
async function api(path, body) {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Purpose-Request': 'dashboard' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || result.message || 'PURPOSE could not complete the request.');
  return result;
}
function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach(x => x.hidden = x.id !== name);
  document.querySelectorAll('.nav').forEach(x => x.classList.toggle('active', x.dataset.view === name));
  notice('');
}
function cost(n) { return '$' + Number(n || 0).toFixed(4); }
function renderResult(item) {
  const result = item.response || item;
  $('result-question').textContent = item.request || $('request').value;
  lastResponse = result.text || 'No text was returned. Your request may need more context.';
  $('result-text').textContent = lastResponse;
  $('result-usage').textContent = `${result.usage?.inputTokens ?? 0} input tokens · ${result.usage?.outputTokens ?? 0} output tokens · estimated ${cost(result.usage?.estimatedCostUsd)}`;
  $('result').hidden = false;
  showView('ask');
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function render() {
  $('connection-badge').textContent = state.hiveConfigured ? 'Hive key loaded · Ready' : 'Hive key not loaded';
  $('review').disabled = !state.hiveConfigured;
  $('today-runs').textContent = state.usage.today.requests;
  $('today-cost').textContent = cost(state.usage.today.costUsd);
  $('history-count').textContent = state.history.length;
  $('history-list').replaceChildren();
  if (!state.history.length) $('history-list').append(text('div', 'Your first completed analysis will appear here.', 'empty'));
  state.history.forEach(item => {
    const b = text('button', '', 'panel history-item'); b.append(text('div', new Date(item.at).toLocaleString(), 'eyebrow'), text('h3', item.request), text('p', 'Open saved response →', 'muted')); b.onclick = () => renderResult(item); $('history-list').append(b);
  });
  $('connection-list').replaceChildren();
  Object.entries(state.integrations).forEach(([key,item]) => {
    const card = text('article', '', 'panel connection-card');
    card.append(text('span', item.status, 'pill'), text('h2', item.provider || key.replace(/([A-Z])/g,' $1').replace(/^./,x=>x.toUpperCase())));
    for (const field of ['websiteStatus','deliveryStatus','autoresponseStatus','purposeAccess','activation']) if (item[field]) card.append(text('p', item[field], field === 'purposeAccess' || field === 'activation' ? 'detail' : ''));
    if (item.url) { const a = text('a', 'Open ' + (item.provider || 'service') + ' ↗'); a.href = item.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; card.append(a); }
    $('connection-list').append(card);
  });
  const inv = state.inventory; $('inventory-overview').replaceChildren();
  for (const [label,n] of [['Pages',inv.pages.pages.length],['Products',inv.products.products.length],['Assets',inv.assets.assets.length],['Audit events',state.audit.count]]) { const e = text('div',''); e.append(text('strong',n),text('span',label)); $('inventory-overview').append(e); }
  $('brand-fields').replaceChildren();
  Object.entries(state.brand.fields).forEach(([key,item]) => { const card = text('article','','panel brand-card'); card.append(text('h3',key.replace(/([A-Z])/g,' $1').replace(/[_-]/g,' ')),text('span',item.approved ? 'Owner approved' : 'Needs owner review','pill subtle'),text('p',typeof item.value === 'object' ? JSON.stringify(item.value,null,2) : item.value ?? 'Not yet recorded')); if(item.note) card.append(text('p',item.note,'muted small')); $('brand-fields').append(card); });
}
async function refresh() { state = await api('/dashboard/state'); render(); }
async function start() {
  $('lock').hidden = false;
  try {
    const secret = location.hash.slice(1);
    history.replaceState(null, '', location.pathname);
    if (secret) await api('/session',{token:secret});
    await refresh(); $('lock').hidden = true; $('workspace').hidden = false;
  } catch(error) { $('lock-message').textContent = error.message; }
}
document.querySelectorAll('.nav').forEach(b => b.onclick = () => showView(b.dataset.view));
document.querySelectorAll('.prompt').forEach(b => b.onclick = () => { $('request').value = b.dataset.prompt; $('request').focus(); });
$('instruction-form').onsubmit = async e => {
  e.preventDefault(); notice(''); $('review').disabled = true;
  try { pending = await api('/dashboard/prepare',{ request:$('request').value, context:$('context').value }); $('approval-request').textContent = pending.directive.request; $('approval').showModal(); }
  catch(error) { notice(error.message); }
  finally { $('review').disabled = !state?.hiveConfigured; }
};
async function cancel() {
  $('approval').close();
  if (pending) { const id = pending.approval.id; pending = null; try { await api('/dashboard/reject',{approvalId:id}); } catch(error) { notice(error.message); } }
}
$('cancel').onclick = cancel;
$('approval').addEventListener('cancel', e => { e.preventDefault(); cancel(); });
$('run').onclick = async () => {
  if (!pending) return;
  const request = pending.directive.request, id = pending.approval.id; pending = null;
  $('approval').close(); $('review').disabled = true; $('review').textContent = 'PURPOSE is thinking…'; $('stop').disabled = true; notice('Your approved request is running. This can take a moment.');
  try { const response = await api('/dashboard/run',{approvalId:id,confirm:true}); await refresh(); renderResult({request,response}); }
  catch(error) { notice(error.message + ' Review a fresh request to try again.'); }
  finally { $('review').textContent = 'Review request →'; $('review').disabled = !state?.hiveConfigured; $('stop').disabled = false; }
};
$('copy').onclick = async () => { try { await navigator.clipboard.writeText(lastResponse); $('copy').textContent = 'Copied'; setTimeout(() => $('copy').textContent = 'Copy response',1500); } catch { notice('Select the response text and copy it using Ctrl+C.'); } };
$('stop').onclick = async () => { try { await api('/dashboard/stop',{}); $('workspace').hidden = true; $('lock').hidden = false; $('lock-message').textContent = 'PURPOSE is closed. Use your desktop shortcut whenever you are ready.'; } catch(error) { notice(error.message); } };
start();
