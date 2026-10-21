const view = document.getElementById('view');
let settings = null;
let seg = null; // active segment {slug, name, unit, unitPlural, linkedinMax}
let currentTab = 'today';
let todayStep = ''; // Today tab step filter ('' = all, '0' = first touch, '1' = Follow-up 1, ...)
let todayFilter = ''; // Today tab channel filter, kept across re-renders
const BUILT_IN = ['college']; // the Colleges segment cannot be deleted
const OWNERS = { arjun: 'Arjun', sagar: 'Sagar' };
const lsGet = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
let todayOwner = lsGet('todayOwner'); // Today tab owner filter ('' = all, 'arjun', 'sagar', 'none')
const STARTUP_ROLES = ['Founder', 'Co-founder', 'CEO', 'CTO', 'COO', 'Head of HR', 'Head of Growth', 'Product Head'];
const ROLE_SUGGESTIONS = ['Dean', 'Head', 'Manager', 'Vice Chancellor', 'Principal', 'Director', 'HOD', 'Placement Officer'];

// ---------- helpers ----------
const ICON = {
  mail: '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>',
  linkedin: '<path d="M6 9v9M6 6v.01M10 18v-9m0 3c0-2 1.5-3 3-3s3 1 3 3v6"/>',
  school: '<path d="M3 10 12 5l9 5-9 5z"/><path d="M7 12.5V17c0 1 2.2 2 5 2s5-1 5-2v-4.5"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  clip: '<path d="m20 11-8 8a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  party: '<path d="m5 20 4-12 8 8z"/><path d="M14 4v2M19 9h2M18 4l1-1"/>',
  rocket: '<path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2"/><path d="M12 15 9 12c1-3 3-6 6-7.5 2.5-1 5-1 5-1s0 2.5-1 5C17.5 11 15 13 12 15z"/><circle cx="15.5" cy="8.5" r="1.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',
};
const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;


const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(method, url, body) {
  const r = await fetch('/api' + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(seg && { 'X-Segment': seg.slug }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

const ymd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const prettyDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const savedSender = () => { try { return localStorage.getItem('senderName') || ''; } catch { return ''; } };
// LinkedIn message still has the {demo_link} placeholder: make the link now and put it in the message (false = could not)
async function fillDemo(t) {
  if (!t.demoPending) return true;
  toast('Demo link ban raha hai... (pehli baar 1 min tak lag sakta hai)');
  try {
    const r = await api('POST', `/colleges/${t.collegeId}/demo`, {});
    t.message = t.message.replace(/\{demo[ _]?link\}|\[demo[ _]?link\]|\[Website Link With Botza\]/gi, () => r.url);
    t.demoPending = false;
    return true;
  } catch (e) { toast(`Demo link nahi ban paya: ${e.message}`); if (/nahi lag sakta|load nahi|khul nahi/.test(e.message)) render(); return false; }
}
const safeUrl =(u) => (/^https?:\/\//i.test(u) ? u : u ? 'https://' + u : '');

async function guard(fn) {
  try { await fn(); } catch (e) { toast(e.message); }
}

// ---------- tabs ----------
document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  currentTab = b.dataset.tab;
  render();
});

async function render() {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === currentTab));
  if (!settings || currentTab === 'settings') settings = await api('GET', '/settings'); // cached: only the Settings tab changes it
  refreshBadges();
  await ({ today: renderTodayTab, colleges: renderColleges, replied: renderReplied, finished: renderFinished, history: renderHistory, assign: renderAssign, add: renderAdd, settings: renderSettings }[currentTab])();
}

async function refreshBadges() {
  const [today, replied, colleges, finished] = await Promise.all([api('GET', '/today/counts'), api('GET', '/replied'), api('GET', '/colleges'), api('GET', '/finished')]);
  document.getElementById('todayCount').textContent = today.email + today.linkedin;
  document.getElementById('repliedCount').textContent = replied.length;
  const fb = document.getElementById('finishedCount');
  fb.textContent = finished.length;
  fb.classList.toggle('grey', !finished.length);
  const unassigned = colleges.filter((c) => !c.owner).length;
  const ab = document.getElementById('assignCount');
  ab.textContent = unassigned;
  ab.classList.toggle('grey', !unassigned);
}

// ---------- TODAY ----------
const ownerMatch = (i) => !todayOwner || (todayOwner === 'none' ? !i.owner : i.owner === todayOwner);
const stepMatch = (i) => todayStep === '' || String(i.stepIndex) === todayStep;

async function renderToday() {
  let items = await api('GET', '/today');
  const mine0 = items.filter((i) => ownerMatch(i) && stepMatch(i));
  const late = mine0.filter((i) => i.state === 'overdue').length;
  const collegeCount = new Set(mine0.map((i) => i.college)).size;
  view.innerHTML = `
    <div class="owner-tabs" id="ownerTabs"></div>
    <div class="stats">
      <div class="stat"><b id="stTotal">${mine0.length}</b><span>Aaj ke kaam</span></div>
      <div class="stat ${late ? 'bad' : ''}" id="stLateBox"><b id="stLate">${late}</b><span>Late ho chuke</span></div>
      <div class="stat"><b id="stColleges">${collegeCount}</b><span>${esc(seg.unitPlural)}</span></div>
      <div class="filter">Follow-up:
        <select id="fStep"></select>
      </div>
      <select id="fChannel" hidden><option value=""></option></select>
    </div>
    <div class="help"><b>Kaise use karein:</b> message bhejo → <b>✓ Bhej diya</b> dabao. Email ka agla follow-up apne aap 2 din baad yahin aa jayega. Card me <b>✓ Sab Bhej diya</b> dabake us ${esc(seg.unit.toLowerCase())} ke saare tasks ek saath mark karo. Kisi ka reply aaye toh <b>Reply aaya</b> dabao — uske baaki follow-ups ruk jayenge. Upar search me email dalo toh turant pata chal jayega wo kis ${esc(seg.unit.toLowerCase())} ka hai.</div>
    <div id="todayCards"></div>
    <div id="todayDone"></div>`;

  // steps already marked sent today, each with an undo button (guards against mis-clicks)
  const drawDone = async () => {
    const ch = document.getElementById('fChannel').value;
    const done = (await api('GET', '/today/done')).filter((d) => (!ch || d.channel === ch) && ownerMatch(d));
    const box = document.getElementById('todayDone');
    if (!done.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="card"><div class="tcard-head"><span class="tcard-title">${ic('check')}Aaj bheje hue <small class="muted">galti se dab gaya ho toh Undo</small></span></div><div class="tcard-body">
      ${done.map((d) => `<div class="task"><div class="task-main"><div class="task-title"><span class="chan ${d.channel}">${ic(d.channel === 'email' ? 'mail' : 'linkedin')}${esc(d.stepLabel)}</span> · <b>${esc(d.name || d.role || '—')}</b>
        <small class="muted">${esc(d.college.replace('[DEMO] ', ''))}</small></div></div>
        <button class="btn small" data-undo="${d.contactId}" data-ch="${d.channel}">${ic('undo')}Undo</button></div>`).join('')}</div></div>`;
    box.querySelectorAll('[data-undo]').forEach((b) => b.onclick = () => guard(async () => {
      await api('DELETE', `/contacts/${b.dataset.undo}/sent?channel=${b.dataset.ch}`);
      toast('Undo ho gaya'); render();
    }));
  };

  // Arjun / Sagar tabs: count = tasks due for that person's colleges
  const drawOwnerTabs = () => {
    const n = (o) => items.filter((i) => (o === 'none' ? !i.owner : i.owner === o)).length;
    const tabs = [['', 'Sab', items.length], ['arjun', 'Arjun', n('arjun')], ['sagar', 'Sagar', n('sagar')]];
    if (n('none')) tabs.push(['none', 'Unassigned', n('none')]);
    const box = document.getElementById('ownerTabs');
    box.innerHTML = tabs.map(([k, l, c]) => `<button class="${todayOwner === k ? 'active' : ''}" data-owner="${k}">${l} <span class="badge ${todayOwner === k ? '' : 'grey'}">${c}</span></button>`).join('');
    box.querySelectorAll('[data-owner]').forEach((b) => b.onclick = () => {
      todayOwner = todayOwner === b.dataset.owner ? '' : b.dataset.owner; lsSet('todayOwner', todayOwner);
      drawOwnerTabs(); draw(); drawDone(); updateStats();
    });
  };

  // college card 📋 button: build the prompt for one college
  const buildPrompt = async (college, senderName) => {
    try { localStorage.setItem('senderName', senderName); } catch {}
    return api('POST', '/prompt/emails', { senderName, college });
  };

  const updateStats = () => {
    const mine = items.filter((i) => ownerMatch(i) && stepMatch(i));
    const late = mine.filter((i) => i.state === 'overdue').length;
    document.getElementById('stTotal').textContent = mine.length;
    document.getElementById('stLate').textContent = late;
    document.getElementById('stLateBox').classList.toggle('bad', late > 0);
    document.getElementById('stColleges').textContent = new Set(mine.map((i) => i.college)).size;
  };

  // Update the page in place after "sent": no re-render, so cards never jump or re-flow.
  const afterSent = (sent) => {
    const keys = new Set(sent.map((t) => `${t.contactId}:${t.channel}`));
    items = items.filter((i) => !keys.has(`${i.contactId}:${i.channel}`));
    keys.forEach((k) => {
      const row = document.querySelector(`[data-task="${k}"]`);
      if (!row) return;
      const person = row.closest('.person'), card = row.closest('.tcard');
      row.classList.add('leaving');
      setTimeout(() => {
        row.remove();
        if (!person.querySelector('.task')) person.remove();
        const left = card.querySelectorAll('.task').length;
        const cnt = card.querySelector('.sentall .count');
        if (cnt) cnt.textContent = left;
        if (!left) {
          card.classList.add('finished');
          card.querySelector('.tcard-body').innerHTML = `<div class="card-done">${ic('check')}Is ${esc(seg.unit.toLowerCase())} ka kaam ho gaya</div>`;
          card.querySelectorAll('.tcard-head button, .tcard-head input').forEach((el) => { el.disabled = true; });
        }
      }, 220);
    });
    drawOwnerTabs(); updateStats();
    drawDone(); refreshBadges();
  };

  const draw = () => {
    const ch = document.getElementById('fChannel').value;
    const list = items.filter((i) => (!ch || i.channel === ch) && ownerMatch(i) && stepMatch(i));
    const colleges = new Map();
    list.forEach((t) => {
      if (!colleges.has(t.college)) colleges.set(t.college, new Map());
      const people = colleges.get(t.college);
      if (!people.has(t.contactId)) people.set(t.contactId, { info: t, tasks: [] });
      people.get(t.contactId).tasks.push(t);
    });
    const box = document.getElementById('todayCards');
    if (!colleges.size) { box.innerHTML = `<div class="card empty big">${ic('party')}<div>Aaj ka kaam khatam! Kuch pending nahi hai.</div></div>`; return; }

    box.innerHTML = `<div class="cards">${[...colleges].map(([name, people]) => `
      <div class="card tcard" data-card="${esc(name)}">
        <div class="tcard-head"><span class="tcard-title">${ic('school')}${esc(name.replace('[DEMO] ', ''))}</span>
          ${[...people.values()].some((p) => p.info.demoFailed) ? `<span class="tag overdue" title="${esc([...people.values()].map((p) => p.info.demoFailed).find(Boolean))}">✕ Demo nahi lag sakta</span>` : ''}
          <span class="card-prompt"><input data-sender placeholder="Sender naam" value="${esc(savedSender())}" style="width:110px">
            ${[...people.values()].some((p) => p.tasks.some((t) => t.channel === 'email'))
              ? `<button class="btn small" data-copycollege="${esc(name)}" title="Is ${esc(seg.unit.toLowerCase())} ke saare emails ka Claude prompt copy karo">${ic('copy')}Prompt</button>` : ''}</span>
          <button class="btn primary small sentall" data-sentall="${esc(name)}">${ic('check')}Sab Bhej diya <span class="count">${[...people.values()].reduce((n, p) => n + p.tasks.length, 0)}</span></button></div>
        <div class="tcard-body">
        ${[...people.values()].map((p) => `
          <div class="person" data-person="${p.info.contactId}">
            <div class="person-top">
              <div class="avatar">${esc((p.info.name || p.info.role || '?').trim()[0].toUpperCase())}</div>
              <div class="who2"><b>${esc(p.info.name || '—')}</b><small>${esc(p.info.role)}</small></div>
              <button class="link" data-reply="${p.info.contactId}" data-who="${esc(p.info.name || p.info.role)}">Reply aaya?</button>
            </div>
            ${p.tasks.map((t) => `
              <div class="task ${t.state}" data-task="${t.contactId}:${t.channel}">
                <div class="task-main">
                  <div class="task-title"><span class="chan ${t.channel}">${ic(t.channel === 'email' ? 'mail' : 'linkedin')}${t.channel === 'email' ? 'Email' : 'LinkedIn'}</span> <span class="step">${esc(t.stepLabel)}</span>
                    ${t.channel === 'linkedin' ? `<button class="link copyicon" data-msg="${t.contactId}" title="Is step ka message copy karo" aria-label="Message copy karo">${ic('copy')}</button>` : ''}
                    ${t.attachment ? `<span class="tag due" title="Claude sirf draft banayega, attachment tum lagaoge">${ic('clip')}${esc(t.attachment)}</span>` : ''}
                    ${t.state === 'overdue' ? `<span class="tag overdue">${t.daysLate} din late</span>` : `<span class="tag due">Aaj</span>`}</div>
                  <div class="task-reach">${t.channel === 'email'
                    ? (t.email ? `${esc(t.email)} <button class="link" data-copy="${esc(t.email)}">Copy</button>` : '<span class="muted">email nahi hai</span>')
                    : (t.linkedinUrl ? `<a href="${esc(safeUrl(t.linkedinUrl))}" target="_blank" rel="noopener">LinkedIn profile kholo ${ic('ext')}</a>` : '<span class="muted">link nahi hai</span>')}</div>
                </div>
                <button class="btn primary bigbtn" data-sent="${t.contactId}" data-ch="${t.channel}">${ic('check')}Bhej diya</button>
              </div>`).join('')}
          </div>`).join('')}
        </div>
      </div>`).join('')}</div>`;

    box.querySelectorAll('[data-sent]').forEach((b) => b.onclick = () => guard(async () => {
      b.disabled = true;
      try { await api('POST', `/contacts/${b.dataset.sent}/sent`, { channel: b.dataset.ch }); } catch (e) { b.disabled = false; throw e; }
      toast('Done'); afterSent([{ contactId: b.dataset.sent, channel: b.dataset.ch }]);
    }));
    box.querySelectorAll('[data-sentall]').forEach((b) => b.onclick = () => guard(async () => {
      const tasks = list.filter((t) => t.college === b.dataset.sentall);
      if (!confirm(`${tasks.length} tasks "Bhej diya" mark karun?`)) return;
      b.disabled = true;
      const ok = [];
      try { for (const t of tasks) { await api('POST', `/contacts/${t.contactId}/sent`, { channel: t.channel }); ok.push(t); } }
      finally { b.disabled = false; if (ok.length) afterSent(ok); }
      toast(`${ok.length} tasks done`);
    }));
    box.querySelectorAll('[data-reply]').forEach((b) => b.onclick = () => guard(async () => {
      const note = prompt(`${b.dataset.who} ka reply aaya. Note likho (optional):`, '');
      if (note === null) return;
      await api('POST', `/contacts/${b.dataset.reply}/status`, { status: 'handling_personally', note });
      toast('Follow-ups band'); render();
    }));
    box.querySelectorAll('[data-copycollege]').forEach((b) => b.onclick = () => guard(async () => {
      const senderName = b.parentElement.querySelector('[data-sender]').value.trim();
      if (!senderName) return toast('Pehle sender naam likho');
      const college = b.dataset.copycollege;
      const r = await buildPrompt(college, senderName);
      if (r.demoFailed && r.demoFailed.length) { toast(`${r.demoFailed.join(', ')}: is site par Botza demo nahi lag sakta`); render(); }
      if (!r.count) return toast(r.skipped[0] || `Is ${seg.unit.toLowerCase()} ka koi email ready nahi`);
      await navigator.clipboard.writeText(r.prompt);
      toast(`${college.replace('[DEMO] ', '')}: ${r.count} emails ka prompt copy ho gaya ✓`);
    }));
    box.querySelectorAll('[data-msg]').forEach((b) => b.onclick = () => guard(async () => {
      const t = items.find((x) => x.contactId === b.dataset.msg && x.channel === 'linkedin');
      if (!t || !t.message) return toast('Settings me is step ka LinkedIn draft nahi hai');
      if (!(await fillDemo(t))) return;
      const senderName = b.closest('.tcard').querySelector('[data-sender]').value.trim();
      if (!senderName && /\{sender_name\}/.test(t.message)) return toast('Pehle sender naam likho');
      try { localStorage.setItem('senderName', senderName); } catch {}
      navigator.clipboard.writeText(t.message.replace(/\{sender_name\}/g, () => senderName));
      toast(`${t.stepLabel} copied ✓`);
    }));
    box.querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => { navigator.clipboard.writeText(b.dataset.copy); toast('Copied'); });
  };
  const sel = document.getElementById('fChannel');
  todayFilter = ''; // Email and LinkedIn are separate sub-tabs, no channel filter
  sel.value = todayFilter;
  sel.onchange = () => { todayFilter = sel.value; draw(); drawDone(); };
  // step dropdown: Sab / Primary / Follow-up 1, 2, 3 ... (only steps that actually have tasks today)
  const stepSel = document.getElementById('fStep');
  const stepNums = [...new Set(items.map((i) => i.stepIndex))].sort((a, b) => a - b);
  if (todayStep !== '' && !stepNums.includes(Number(todayStep))) todayStep = '';
  stepSel.innerHTML = '<option value="">Sab</option>' + stepNums.map((n) => `<option value="${n}">${n === 0 ? 'Pehla message' : 'Follow-up ' + n}</option>`).join('');
  stepSel.value = todayStep;
  stepSel.onchange = () => { todayStep = stepSel.value; draw(); updateStats(); };
  drawOwnerTabs();
  draw();
  drawDone();
}

// ---------- LINKEDIN (startups): follow-ups, accept check, notes ----------
// Startups only: "Aaj ka kaam" has two separate sub-tabs, Email and LinkedIn
let todaySub = 'email';
let liData = null; // last LinkedIn payload, reused when only the owner tab changes
function drawSubTabs(counts) {
  const tabs = [['email', 'Email', counts.email], ['linkedin', 'LinkedIn', counts.linkedin]];
  view.insertAdjacentHTML('afterbegin', `<div class="owner-tabs" id="subTabs">${tabs.map(([k, l, c]) => `<button class="${todaySub === k ? 'active' : ''}" data-sub="${k}">${l} <span class="badge ${todaySub === k ? '' : 'grey'}">${c}</span></button>`).join('')}</div>`);
  view.querySelectorAll('[data-sub]').forEach((b) => b.onclick = () => guard(async () => { todaySub = b.dataset.sub; await renderTodayTab(); }));
}
// Left side-bar: just the people (Arjun / Sagar); Email / LinkedIn pills stay on top of the content on the right
function layoutSide() {
  const own = document.getElementById('ownerTabs');
  if (!own) return;
  const main = document.createElement('div');
  main.className = 'side-main';
  while (view.firstChild) main.appendChild(view.firstChild);
  const aside = document.createElement('aside');
  aside.className = 'side';
  const label = (t) => { const d = document.createElement('div'); d.className = 'side-label'; d.textContent = t; return d; };
  aside.append(label('Kiska kaam'), own);
  const wrap = document.createElement('div');
  wrap.className = 'side-layout';
  wrap.append(aside, main);
  view.appendChild(wrap);
}
async function renderTodayTab(reuse) {
  if (todaySub === 'linkedin') {
    if (!(reuse && liData)) liData = await api('GET', '/linkedin/today');
    renderLinkedin(liData);
    drawSubTabs({ email: liData.emailCount, linkedin: liData.notes.length + liData.followups.length });
    layoutSide();
  } else {
    const counts = api('GET', '/today/counts'); // fetched in parallel with the list
    await renderToday();
    drawSubTabs(await counts);
    layoutSide();
  }
}

function renderLinkedin(data) {
  const { notes, followups, pending, others } = data;
  const n = notes.filter(ownerMatch), f = followups.filter(ownerMatch);
  const pend = pending.filter(ownerMatch), oth = others.filter(ownerMatch); // Accept check also follows the Arjun / Sagar tab
  const reach = (u) => (u ? `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener">LinkedIn profile kholo ${ic('ext')}</a>` : '<span class="muted">link nahi hai</span>');
  const taskRow = (t) => `
    <div class="task ${t.state}">
      <div class="task-main">
        <div class="task-title"><b>${esc(t.name || '—')}</b> <small class="muted">${esc(t.role)} · ${esc(t.college.replace('[DEMO] ', ''))}</small>
          <span class="step">${esc(t.stepLabel)}</span>
          ${t.state === 'overdue' ? `<span class="tag overdue">${t.daysLate} din late</span>` : `<span class="tag due">Aaj</span>`}</div>
        <div class="task-reach">${reach(t.linkedinUrl)}</div>
      </div>
      <button class="btn small" data-copyopen="${t.contactId}" data-kind="${t.isFirst ? 'notes' : 'followups'}">${ic('copy')}Copy + Profile</button>
      <button class="btn primary bigbtn" data-sent="${t.contactId}">${ic('check')}Bhej diya</button>
    </div>`;
  const pendRow = (p, extra) => `
    <div class="task ${p.daysAgo >= 7 ? 'overdue' : ''}" ${extra ? 'hidden data-other' : ''} data-q="${esc((p.name + ' ' + p.role + ' ' + p.college).toLowerCase())}">
      <label class="task-main" style="display:flex;gap:8px;align-items:center;cursor:pointer">
        <input type="checkbox" data-conn="${p.contactId}">
        <div><div class="task-title"><b>${esc(p.name || '—')}</b> <small class="muted">${esc(p.role)} · ${esc(p.college.replace('[DEMO] ', ''))}</small>
          ${extra ? '<span class="tag due">note abhi mark nahi hua</span>' : `<span class="tag ${p.daysAgo >= 7 ? 'overdue' : 'due'}">${p.daysAgo} din pehle bheja</span>`}</div>
        <div class="task-reach">${reach(p.linkedinUrl)}</div></div>
      </label>
      ${extra ? '' : `<button class="link" data-giveup="${p.contactId}" data-who="${esc(p.name || p.role)}">Accept nahi hua, band karo</button>`}
    </div>`;
  const section = (num, title, desc, rows, count) => `<div class="card li-sec"><div class="li-head"><span class="li-num">${num}</span><div><h2>${title} <span class="badge ${count ? '' : 'grey'}">${count}</span></h2><p>${desc}</p></div></div><div class="li-body">${rows}</div></div>`;
  view.innerHTML = `
    <div class="owner-tabs" id="ownerTabs"></div>
    <div class="stats"><div class="filter">Aapka naam (message me lagega): <input id="liSender" placeholder="Sender naam" value="${esc(savedSender())}" style="width:130px"></div></div>
    ${section(1, 'Connection Note bhejo', 'Naye logo ko LinkedIn par connection request aur note bhejo. Bhej diya dabate hi wo Step 2 me chale jate hain.', n.length ? n.map(taskRow).join('') : '<div class="card-done">Koi naya note pending nahi</div>', n.length)}
    ${section(2, 'Kisne accept kiya? Connected tick karo', 'Jinko note bheja unme se jo accept kare, search karke ya tick karke Connected mark karo. Mark karte hi unka follow-up Step 3 me aa jayega.',
      `<div style="margin:6px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input id="pendSearch" type="search" placeholder="Naam ya ${esc(seg.unit.toLowerCase())} dhundo..." autocomplete="off" style="min-width:220px"><button class="btn primary small" id="bulkConn">${ic('check')}Selected ko Connected mark karo</button></div>
      ${pend.length ? pend.map((p) => pendRow(p)).join('') : '<div class="card-done" id="noPend">Koi pending connection nahi, upar search karke kisi ko bhi Connected mark kar sakte ho</div>'}
      ${oth.map((p) => pendRow(p, true)).join('')}`, pend.length)}
    ${section(3, 'Follow-up message bhejo', 'Sirf connected logo ke liye. Copy + Profile dabao, message paste karke bhejo, phir Bhej diya dabao.', f.length ? f.map(taskRow).join('') : '<div class="card-done">Koi follow-up pending nahi</div>', f.length)}`;

  const all = notes.concat(followups);
  const own = (o) => all.filter((i) => (o === 'none' ? !i.owner : i.owner === o)).length;
  const tabs = [['', 'Sab', all.length], ['arjun', 'Arjun', own('arjun')], ['sagar', 'Sagar', own('sagar')]];
  if (own('none')) tabs.push(['none', 'Unassigned', own('none')]);
  const box = document.getElementById('ownerTabs');
  box.innerHTML = tabs.map(([k, l, c]) => `<button class="${todayOwner === k ? 'active' : ''}" data-owner="${k}">${l} <span class="badge ${todayOwner === k ? '' : 'grey'}">${c}</span></button>`).join('');
  box.querySelectorAll('[data-owner]').forEach((b) => b.onclick = () => { todayOwner = todayOwner === b.dataset.owner ? '' : b.dataset.owner; lsSet('todayOwner', todayOwner); guard(() => renderTodayTab(true)); });

  view.querySelectorAll('[data-copyopen]').forEach((b) => b.onclick = () => guard(async () => {
    const t = (b.dataset.kind === 'notes' ? notes : followups).find((x) => x.contactId === b.dataset.copyopen);
    const senderName = document.getElementById('liSender').value.trim();
    if (!t) return;
    if (!t.message) { if (t.linkedinUrl) window.open(safeUrl(t.linkedinUrl), '_blank', 'noopener'); return toast('Is step ka draft nahi hai (Settings me likho), profile khol diya'); }
    if (!(await fillDemo(t))) return;
    if (!senderName && /\{sender_name\}/.test(t.message)) return toast('Pehle sender naam likho');
    lsSet('senderName', senderName);
    navigator.clipboard.writeText(t.message.replace(/\{sender_name\}/g, () => senderName));
    if (t.linkedinUrl) window.open(safeUrl(t.linkedinUrl), '_blank', 'noopener');
    toast(`${t.stepLabel} copied ✓`);
  }));
  view.querySelectorAll('[data-sent]').forEach((b) => b.onclick = () => guard(async () => {
    b.disabled = true;
    try { await api('POST', `/contacts/${b.dataset.sent}/sent`, { channel: 'linkedin' }); } catch (e) { b.disabled = false; throw e; }
    toast('Done'); render();
  }));
  const ps = document.getElementById('pendSearch');
  if (ps) ps.oninput = () => {
    const q = ps.value.trim().toLowerCase();
    view.querySelectorAll('[data-q]').forEach((r) => {
      const hit = !q || r.dataset.q.includes(q);
      r.hidden = r.hasAttribute('data-other') ? !q || !hit : !hit; // un-marked contacts show only while searching
    });
  };
  const bulk = document.getElementById('bulkConn');
  if (bulk) bulk.onclick = () => guard(async () => {
    const ids = [...view.querySelectorAll('[data-conn]:checked')].map((x) => x.dataset.conn);
    if (!ids.length) return toast('Pehle koi select karo');
    await api('POST', '/contacts/connected-bulk', { ids });
    toast(`${ids.length} connected ✓`); render();
  });
  view.querySelectorAll('[data-giveup]').forEach((b) => b.onclick = () => guard(async () => {
    if (!confirm(`${b.dataset.who} ke follow-ups band karun?`)) return;
    await api('POST', `/contacts/${b.dataset.giveup}/status`, { status: 'done' });
    toast('Band kar diya'); render();
  }));
}

// ---------- FINISHED: all steps sent, delete for good ----------
async function renderFinished() {
  const list = await api('GET', '/finished');
  const email = list.filter((x) => x.emailDone), li = list.filter((x) => x.liDone);
  const STATUS = { replied: 'Replied', handling_personally: 'Handling personally', done: 'Band' };
  const row = (x, ch) => {
    const mine = ch === 'email' ? { n: x.emailSent, t: x.emailTotal, last: x.emailLast } : { n: x.liSent, t: x.liTotal, last: x.liLast };
    const otherDone = ch === 'email' ? x.liDone : x.emailDone;
    const other = ch === 'email'
      ? (x.liDone ? 'LinkedIn bhi poora' : x.liTotal > 1 ? `LinkedIn ${x.liSent}/${x.liTotal} baaki` : '')
      : (x.emailDone ? 'Email bhi poora' : `Email ${x.emailSent}/${x.emailTotal} baaki`);
    return `
    <div class="task" data-q="${esc((x.name + ' ' + x.role + ' ' + x.college).toLowerCase())}">
      <label class="task-main" style="display:flex;gap:10px;align-items:center;cursor:pointer">
        <input type="checkbox" data-del="${x.contactId}">
        <div><div class="task-title"><b>${esc(x.name || '—')}</b> <small class="muted">${esc(x.role)} · ${esc(x.college.replace('[DEMO] ', ''))}${x.owner ? ' · ' + esc(OWNERS[x.owner] || x.owner) : ''}</small>
          <span class="tag due">${mine.n}/${mine.t} bheje${mine.last ? ', last ' + prettyDate(mine.last) : ''}</span>
          ${other ? `<span class="tag ${otherDone ? 'due' : 'overdue'}">${esc(other)}</span>` : ''}
          ${x.status !== 'active' ? `<span class="tag due">${esc(STATUS[x.status] || x.status)}</span>` : ''}</div></div>
      </label>
      <button class="btn danger small" data-delone="${x.contactId}" data-who="${esc(x.name || x.role)}">Delete</button>
    </div>`;
  };
  const section = (title, desc, rows, count, ch) => `<div class="card li-sec" data-ch="${ch}"><div class="li-head"><span class="li-num">${ic(ch === 'email' ? 'mail' : 'linkedin')}</span><div><h2>${title} <span class="badge ${count ? '' : 'grey'}">${count}</span></h2><p>${desc}</p></div></div>
    <div class="li-body">${count ? `<div style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><label style="display:inline-flex;gap:6px;align-items:center;cursor:pointer;font-weight:600"><input type="checkbox" data-selall="${ch}">Select all</label><button class="btn danger small" data-delsel="${ch}">Selected ko delete karo</button><button class="btn danger small" data-delall="${ch}">Sab ${count} delete karo</button></div>${rows}` : '<div class="card-done">Abhi koi nahi</div>'}</div></div>`;
  view.innerHTML = `
    <div class="help"><b>Kya hai ye:</b> jinke saare steps ho chuke hain wo yahan aate hain. Ab unse aage kuch nahi bhejna, to yahin se <b>Delete</b> karke list saaf kar do. Delete hamesha ke liye hota hai, wapas nahi aata.</div>
    ${section('Email poora ho gaya', `Primary email aur saare follow-ups bhej diye (${email[0] ? email[0].emailTotal : 'saare'} steps).`, email.map((x) => row(x, 'email')).join(''), email.length, 'email')}
    ${section('LinkedIn poora ho gaya', 'Connection note aur saare follow-ups bhej diye.', li.map((x) => row(x, 'linkedin')).join(''), li.length, 'linkedin')}`;

  const del = (ids, label, extra = '') => guard(async () => {
    if (!ids.length) return toast('Pehle koi select karo');
    if (!confirm(`${label} hamesha ke liye delete karun?${extra} Ye wapas nahi aayega.`)) return;
    const r = await api('POST', '/contacts/delete-bulk', { ids });
    toast(`${r.count} delete ho gaye${r.orgsRemoved ? `, ${r.orgsRemoved} khali ${r.orgsRemoved > 1 ? seg.unitPlural.toLowerCase() : seg.unit.toLowerCase()} bhi hata diye` : ''}`); render();
  });
  view.querySelectorAll('[data-delone]').forEach((b) => b.onclick = () => del([b.dataset.delone], `${b.dataset.who} ko`));
  view.querySelectorAll('[data-selall]').forEach((a) => {
    const boxes = () => [...a.closest('.li-sec').querySelectorAll('[data-del]')];
    a.onchange = () => boxes().forEach((x) => { x.checked = a.checked; });
    // keep "Select all" honest when single rows are ticked / unticked
    a.closest('.li-sec').addEventListener('change', (e) => {
      if (e.target.matches('[data-del]')) a.checked = boxes().every((x) => x.checked);
    });
  });
  view.querySelectorAll('[data-delall]').forEach((b) => b.onclick = () => {
    const ch = b.dataset.delall, arr = ch === 'email' ? email : li;
    // contacts whose OTHER channel is still running would be deleted too: say so in the confirm
    const risky = arr.filter((x) => (ch === 'email' ? x.liTotal > 1 && !x.liDone : !x.emailDone)).length;
    del(arr.map((x) => x.contactId), `Sab ${arr.length} contact ko`, risky ? `\n\n${risky} ka doosra channel (${ch === 'email' ? 'LinkedIn' : 'Email'}) abhi baaki hai, wo bhi chala jayega.` : '');
  });
  view.querySelectorAll('[data-delsel]').forEach((b) => b.onclick = () => {
    const ids = [...b.closest('.li-sec').querySelectorAll('[data-del]:checked')].map((x) => x.dataset.del);
    del(ids, `${ids.length} contact ko`);
  });
}

// ---------- HISTORY: every organisation reached out to, even after it is deleted from "Poora ho gaya" ----------
async function renderHistory() {
  const list = await api('GET', '/history');
  const plural = seg.unitPlural.toLowerCase();
  const gone = list.filter((x) => !x.live).length;
  const row = (x) => `
    <tr data-q="${esc((x.name + ' ' + x.city).toLowerCase())}">
      <td class="who"><b>${esc(x.name.replace('[DEMO] ', ''))}</b>${x.city ? ` <small>${esc(x.city)}</small>` : ''}</td>
      <td>${x.owner ? esc(OWNERS[x.owner] || x.owner) : '<span class="muted">—</span>'}</td>
      <td>${x.reached || x.removed ? `${x.reached}${x.removed ? ` <small class="muted">(${x.removed} hata diye)</small>` : ''}` : '<span class="muted">—</span>'}</td>
      <td>${x.first ? prettyDate(x.first) : '—'}</td>
      <td>${x.last ? prettyDate(x.last) : '—'}</td>
      <td>${x.demoUrl ? `<a href="${esc(safeUrl(x.demoUrl))}" target="_blank" rel="noopener">Demo link ↗</a> <button class="link" data-copy="${esc(x.demoUrl)}">Copy</button>` : x.demoFailed ? `<span class="tag overdue" title="${esc(x.demoFailed)}">✕ Nahi lag sakta</span>` : '<span class="muted">—</span>'}</td>
      <td>${x.live ? '<span class="tag due">Chal raha hai</span>' : '<span class="tag">Poora ho gaya, hata diya</span>'}</td>
    </tr>`;
  view.innerHTML = `
    <div class="li-sec card"><div class="li-head"><span class="li-num">${ic('school')}</span><div><h2>History <span class="badge ${list.length ? '' : 'grey'}">${list.length}</span></h2>
      <p>Jitne ${esc(plural)} ko aapne reach out kiya, wo sab yahan rehte hain. "Poora ho gaya" se delete karne par bhi yahan se nahi hatte. ${gone ? `<b>${gone}</b> ab app se hata diye gaye hain.` : ''}</p></div></div>
      <div class="li-body">
        <details style="margin:10px 0 4px"><summary style="cursor:pointer;font-weight:600">+ Pehle hata diye hue ${esc(plural)} history me jodo</summary>
          <div style="margin-top:8px"><textarea id="histAdd" rows="6" placeholder="Ek line me ek naam" style="width:100%;max-width:520px"></textarea>
            <div style="margin-top:6px"><button class="btn primary small" id="histAddBtn">History me jodo</button> <small class="muted">sirf naam judte hain, date aur contacts ka count khali rahega</small></div></div></details>
        ${list.length ? `<div style="margin:8px 0"><input id="histSearch" type="search" placeholder="${esc(seg.unit)} ka naam dhundo..." autocomplete="off" style="min-width:260px"></div>
        <div class="grid-wrap"><table class="grid">
          <thead><tr><th>${esc(seg.unit)}</th><th>Owner</th><th>Contacts reach kiye</th><th>Pehla message</th><th>Last message</th><th>Demo link</th><th>Status</th></tr></thead>
          <tbody>${list.map(row).join('')}</tbody>
        </table></div>` : '<div class="card-done">Abhi koi history nahi, jaise hi koi message bhejoge yahan dikhega</div>'}
      </div></div>`;
  document.getElementById('histAddBtn').onclick = () => guard(async () => {
    const names = document.getElementById('histAdd').value.split('\n').map((x) => x.trim()).filter(Boolean);
    if (!names.length) return toast('Pehle naam likho');
    const r = await api('POST', '/history', { names });
    toast(`${r.added} judh gaye${r.skipped ? `, ${r.skipped} pehle se app me hain` : ''}`); render();
  });
  view.querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => { navigator.clipboard.writeText(b.dataset.copy); toast('Copied'); });
  const hs = document.getElementById('histSearch');
  if (hs) hs.oninput = () => {
    const q = hs.value.trim().toLowerCase();
    view.querySelectorAll('tr[data-q]').forEach((r) => { r.hidden = !!q && !r.dataset.q.includes(q); });
  };
}

// ---------- COLLEGES grid ----------
// accept: LinkedIn Connection Note only ('yes' = connected, 'no' = note sent, not accepted yet)
function cellHtml(cell, channel, idx, contactId, label, accept) {
  const attr = `data-c="${contactId}" data-ch="${channel}" data-i="${idx}" data-s="${cell.state}" title="${esc(label)}"`;
  switch (cell.state) {
    case 'sent': {
      const note = accept === 'yes' ? ' — accept ho gaya' : accept === 'no' ? ' — abhi accept nahi hua' : '';
      return `<button class="cell sent${accept === 'no' ? ' noaccept' : ''}" ${attr} title="${esc(label)} — ${prettyDate(cell.date)}${note}">✓ ${prettyDate(cell.date)}</button>`;
    }
    case 'due': return `<button class="cell due" ${attr}>Aaj</button>`;
    case 'overdue': return `<button class="cell overdue" ${attr}>${cell.days}d late</button>`;
    case 'wait': return `<button class="cell wait" ${attr}>${cell.days}d baad</button>`;
    case 'stopped': return `<span class="cell stopped" title="Stopped">⏸</span>`;
    default: return `<span class="cell locked">–</span>`;
  }
}

async function renderColleges() {
  const colleges = await api('GET', '/colleges');
  if (!colleges.length) { view.innerHTML = `<div class="card empty">Abhi koi ${esc(seg.unit.toLowerCase())} nahi. "${esc(seg.unit)} add karo" me jaake add ya import karo.</div>`; return; }
  view.innerHTML = `
    <div class="legend">
      <span><b style="color:var(--green)">✓ date</b> bheja (LinkedIn note: accept ho gaya)</span><span><b style="color:var(--blue)">✓ date</b> LinkedIn note bheja, accept nahi hua</span><span><b style="color:var(--amber)">Aaj</b> aaj bhejna hai</span>
      <span><b style="color:var(--red)">Nd late</b> deri</span><span><b>Nd baad</b> abhi wait (click = jaldi bheja)</span>
      <span>⏸ reply aaya / ruka</span><span>Sent cell click = date badlo (last wale pe "x" = undo)</span>
    </div>
    ${colleges.map((col) => `
    <div class="card college">
      <h3><span>${esc(col.name)} <span class="muted">${esc(col.city || '')}</span>
          ${col.website ? `<small><a href="${esc(safeUrl(col.website))}" target="_blank" rel="noopener">${esc(col.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></small>` : ''}
          ${col.demoStatus === 'failed' ? `<small><span class="tag overdue" title="${esc(col.demoError || '')}">✕ Demo nahi lag sakta</span></small>` : col.demoUrl ? `<small><a href="${esc(safeUrl(col.demoUrl))}" target="_blank" rel="noopener">Demo link ↗</a></small>` : ''}</span>
        <span><button class="btn" data-website="${col._id}" data-cur="${esc(col.website || '')}">${col.website ? 'Website' : '+ Website'}</button>${col.website ? ` <button class="btn" data-demo="${col._id}">${col.demoUrl || col.demoStatus === 'failed' ? 'Demo link dobara' : 'Demo link'}</button>` : ''} <button class="btn" data-addc="${col._id}">+ Contact</button> <button class="btn danger" data-delcol="${col._id}">Delete</button></span></h3>
      <div class="grid-wrap"><table class="grid">
        <thead>
          <tr><th></th><th class="grp" colspan="${settings.emailSteps.length}">EMAIL</th><th class="grp" colspan="${settings.linkedinSteps.length}">LINKEDIN</th><th></th></tr>
          <tr><th>Banda</th>${settings.emailSteps.map((s) => `<th>${esc(s.label)}</th>`).join('')}${settings.linkedinSteps.map((s) => `<th>${esc(s.label)}</th>`).join('')}<th></th></tr>
        </thead>
        <tbody>${col.contacts.map((c) => `
          <tr class="${c.status !== 'active' ? 'inactive' : ''}">
            <td class="who"><b>${esc(c.role || '—')}</b> ${esc(c.name)}
              <small>${esc(c.email)} ${c.linkedinUrl ? `· <a href="${esc(safeUrl(c.linkedinUrl))}" target="_blank" rel="noopener">LinkedIn</a>` : ''}</small>
              ${c.status !== 'active' ? `<small><span class="tag due">${c.status === 'replied' ? 'Replied' : 'Handling personally'}</span></small>` : ''}</td>
            ${c.emailCells.map((cell, i) => `<td>${cellHtml(cell, 'email', i, c._id, settings.emailSteps[i].label)}</td>`).join('')}
            ${c.linkedinCells.map((cell, i) => `<td>${cellHtml(cell, 'linkedin', i, c._id, settings.linkedinSteps[i].label, i === 0 ? (c.linkedinConnectedAt ? 'yes' : 'no') : '')}</td>`).join('')}
            <td style="white-space:nowrap">
              ${c.status === 'active'
                ? `<button class="btn" data-reply="${c._id}">Replied</button>`
                : `<button class="btn" data-resume="${c._id}">Resume</button>`}
              <button class="btn danger" data-delc="${c._id}" title="Delete contact">✕</button>
            </td>
          </tr>`).join('')}</tbody>
      </table></div>
    </div>`).join('')}`;

  view.querySelectorAll('.cell[data-c]').forEach((b) => b.onclick = () => guard(async () => {
    const { c, ch, i, s } = b.dataset;
    const idx = Number(i);
    if (s === 'sent') {
      const cur = colleges.flatMap((x) => x.contacts).find((x) => x._id === c);
      const arr = ch === 'email' ? cur.emailSent : cur.linkedinSent;
      const isLast = idx === arr.length - 1;
      const v = prompt(`Sent date (YYYY-MM-DD)${isLast ? ' — ya "x" likho undo ke liye' : ''}:`, ymd(arr[idx]));
      if (v === null) return;
      if (v.trim().toLowerCase() === 'x') {
        if (!isLast) return toast('Sirf last step undo ho sakta hai');
        await api('DELETE', `/contacts/${c}/sent?channel=${ch}`);
      } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return toast('Date format YYYY-MM-DD');
        await api('PATCH', `/contacts/${c}/sent`, { channel: ch, index: idx, date: v.trim() });
      }
    } else if (s === 'wait') {
      if (!confirm('Abhi due nahi hai. Phir bhi "sent" mark karun?')) return;
      await api('POST', `/contacts/${c}/sent`, { channel: ch });
    } else {
      await api('POST', `/contacts/${c}/sent`, { channel: ch });
    }
    render();
  }));
  view.querySelectorAll('[data-reply]').forEach((b) => b.onclick = () => guard(async () => {
    const note = prompt('Reply aaya — note likho (optional):', '');
    if (note === null) return;
    await api('POST', `/contacts/${b.dataset.reply}/status`, { status: 'handling_personally', note });
    render();
  }));
  view.querySelectorAll('[data-resume]').forEach((b) => b.onclick = () => guard(async () => {
    await api('POST', `/contacts/${b.dataset.resume}/status`, { status: 'active' }); render();
  }));
  view.querySelectorAll('[data-delc]').forEach((b) => b.onclick = () => guard(async () => {
    if (!confirm('Is contact ko delete karun?')) return;
    await api('DELETE', `/contacts/${b.dataset.delc}`); render();
  }));
  view.querySelectorAll('[data-delcol]').forEach((b) => b.onclick = () => guard(async () => {
    if (!confirm(`Poora ${seg.unit.toLowerCase()} + uske saare contacts delete karun?`)) return;
    await api('DELETE', `/colleges/${b.dataset.delcol}`); render();
  }));
  view.querySelectorAll('[data-website]').forEach((b) => b.onclick = () => guard(async () => {
    const w = prompt(`${seg.unit} ki website (demo link isi se banta hai, khali = hata do):`, b.dataset.cur);
    if (w === null) return;
    await api('PATCH', `/colleges/${b.dataset.website}/website`, { website: w });
    render();
  }));
  view.querySelectorAll('[data-demo]').forEach((b) => b.onclick = () => guard(async () => {
    b.disabled = true; toast('Demo link ban raha hai... (pehli baar 1 min tak lag sakta hai)');
    try { const r = await api('POST', `/colleges/${b.dataset.demo}/demo`, { fresh: true }); await navigator.clipboard.writeText(r.url); toast('Demo link copy ho gaya ✓'); render(); }
    finally { b.disabled = false; }
  }));
  view.querySelectorAll('[data-addc]').forEach((b) => b.onclick = () => guard(async () => {
    const role = prompt(seg.slug === 'college' ? 'Role (jaise Dean, Head, Principal...):' : 'Role (jaise Founder, CEO, CTO...):', '');
    if (role === null) return;
    const name = prompt('Naam:', '') ?? '';
    const email = prompt('Email:', '') ?? '';
    const linkedinUrl = prompt('LinkedIn URL:', '') ?? '';
    await api('POST', '/contacts', { collegeId: b.dataset.addc, role, name, email, linkedinUrl });
    render();
  }));
}

// ---------- ASSIGN ----------
let assignFilter = 'none';
async function renderAssign() {
  const colleges = await api('GET', '/colleges');
  const count = (o) => colleges.filter((c) => (c.owner || 'none') === o).length;
  const tabs = [['none', 'Unassigned'], ['arjun', 'Arjun'], ['sagar', 'Sagar'], ['', 'Sab']];
  const list = colleges.filter((c) => !assignFilter || (c.owner || 'none') === assignFilter);
  view.innerHTML = `
    <div class="help"><b>Kaun kaunsa ${esc(seg.unit.toLowerCase())} bhejega:</b> ${esc(seg.unit.toLowerCase())} ke saamne apne naam ka checkbox tick karo. Naye ${esc(seg.unitPlural.toLowerCase())} (import/add) pehle <b>Unassigned</b> me aate hain, yahin se assign karo. "Aaj ka kaam" me upar se Arjun / Sagar ke ${esc(seg.unitPlural.toLowerCase())} alag dekh sakte ho.</div>
    <div class="legend">${tabs.map(([k, l]) => `<button class="btn small ${assignFilter === k ? 'primary' : ''}" data-af="${k}">${l} (${k ? count(k) : colleges.length})</button>`).join(' ')}</div>
    <div class="card"><table><thead><tr><th>${esc(seg.unit)}</th><th>Contacts</th><th>Arjun</th><th>Sagar</th></tr></thead><tbody>
      ${list.map((c) => `<tr>
        <td><b>${esc(c.name)}</b> <span class="muted">${esc(c.city || '')}</span></td>
        <td>${c.contacts.length}</td>
        ${Object.keys(OWNERS).map((o) => `<td><label><input type="checkbox" data-own="${c._id}" data-o="${o}" ${c.owner === o ? 'checked' : ''}> ${OWNERS[o]}</label></td>`).join('')}
      </tr>`).join('') || '<tr><td colspan="4" class="muted">Is list me koi ${esc(seg.unit.toLowerCase())} nahi.</td></tr>'}
    </tbody></table></div>`;
  view.querySelectorAll('[data-af]').forEach((b) => b.onclick = () => { assignFilter = b.dataset.af; renderAssign(); });
  view.querySelectorAll('[data-own]').forEach((el) => el.onchange = () => guard(async () => {
    try { await api('PATCH', `/colleges/${el.dataset.own}/owner`, { owner: el.checked ? el.dataset.o : '' }); }
    catch (e) { el.checked = !el.checked; throw e; }
    toast(el.checked ? `${OWNERS[el.dataset.o]} ko assign ho gaya` : 'Unassign ho gaya');
    const y = window.scrollY; await renderAssign(); window.scrollTo(0, y); refreshBadges();
  }));
}

// ---------- REPLIED ----------
async function renderReplied() {
  const list = await api('GET', '/replied');
  view.innerHTML = `<div class="card"><h2>Jinka reply aaya / jo main personally handle kar raha hoon (${list.length})</h2>
    ${list.length ? `<table><thead><tr><th>${esc(seg.unit)}</th><th>Banda</th><th>Since</th><th>Note</th><th></th></tr></thead><tbody>
      ${list.map((c) => `<tr><td>${esc(c.college)}</td><td>${esc(c.name)} <span class="muted">(${esc(c.role)})</span><br><small class="muted">${esc(c.email)}</small></td>
        <td>${c.repliedAt ? prettyDate(c.repliedAt) : ''}</td>
        <td><input data-note="${c._id}" value="${esc(c.replyNote)}" style="width:100%"></td>
        <td style="white-space:nowrap"><button class="btn" data-resume="${c._id}">Resume follow-ups</button></td></tr>`).join('')}
    </tbody></table>` : '<div class="empty">Abhi koi reply nahi.</div>'}</div>`;
  view.querySelectorAll('[data-note]').forEach((i) => i.onchange = () => guard(async () => {
    const c = list.find((x) => x._id === i.dataset.note);
    await api('POST', `/contacts/${c._id}/status`, { status: c.status, note: i.value }); toast('Note saved');
  }));
  view.querySelectorAll('[data-resume]').forEach((b) => b.onclick = () => guard(async () => {
    await api('POST', `/contacts/${b.dataset.resume}/status`, { status: 'active' }); render();
  }));
}

// ---------- ADD / IMPORT ----------
function parseCsv(text) {
  // minimal CSV/TSV parser with quote support; columns: college, role, name, email, linkedin, website (optional)
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const delim = line.includes('\t') ? '\t' : ',';
    const cols = []; let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === delim && !q) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cols.push(cur.trim());
    rows.push({ college: cols[0], role: cols[1], name: cols[2], email: cols[3], linkedin: cols[4], website: cols[5] });
  }
  if (rows[0] && /^(college|company|startup|organi[sz]ation)/i.test(rows[0].college || '')) rows.shift(); // header row
  return rows;
}

async function renderAdd() {
  const roleList = `<datalist id="roleList">${(seg.slug === 'college' ? ROLE_SUGGESTIONS : STARTUP_ROLES).map((r) => `<option value="${esc(r)}">`).join('')}</datalist>`;
  view.innerHTML = `
    <div class="card"><h2>Naya ${esc(seg.unit.toLowerCase())} add karo</h2>
      <div class="row"><input id="cName" placeholder="${esc(seg.unit)} name *" style="min-width:280px"><input id="cCity" placeholder="City (optional)"><input id="cWebsite" placeholder="Website (demo link ke liye)" style="min-width:240px"></div>
      <div id="contactRows"></div>
      ${roleList}
      <div class="row">
        <button class="btn" id="addPerson">+ Banda add karo</button>
        <button class="btn primary" id="saveCollege">Save ${esc(seg.unit.toLowerCase())}</button>
      </div>
    </div>
    <div class="card"><h2>Bulk import (Apollo / CSV / Excel se paste)</h2>
      <ol class="steps">
        <li><button class="btn small" id="dlTemplate">⬇ Demo template download karo (Excel me khulega)</button></li>
        <li>Excel me apni profiles bharo: <b>${esc(seg.unit.toLowerCase())}, role, name, email, linkedin, website</b> (website optional, demo link usi se banta hai). Ek banda = ek row. Ek ${esc(seg.unit.toLowerCase())} ke jitne bande, utni rows (naam har row me same likho).</li>
        <li>Phir ya toh <b>CSV file chuno</b>: <input type="file" id="csvFile" accept=".csv,.tsv,.txt"> ya Excel me rows select karke <b>Copy</b> karo aur neeche box me <b>Paste</b> karo.</li>
        <li><b>Import</b> dabao. Template ke sample rows (Demo College) hata dena ya baad me delete kar dena.</li>
      </ol>
      <textarea id="csv" placeholder="${seg.slug === 'college' ? 'IIT Demo, Dean, Dr. Sharma, sharma@iit.edu, linkedin.com/in/sharma' : 'Acme Labs, Founder, Riya Shah, riya@acme.io, linkedin.com/in/riya-shah'}"></textarea>
      <div class="row" style="margin-top:8px"><button class="btn primary" id="doImport">Import</button><span id="csvInfo" class="muted"></span></div>
    </div>`;

  const rowsBox = document.getElementById('contactRows');
  const addRow = () => {
    const div = document.createElement('div');
    div.className = 'contact-form';
    div.innerHTML = `
      <input data-f="role" list="roleList" placeholder="Role (kuch bhi likho)">
      <input data-f="name" placeholder="Naam">
      <input data-f="email" placeholder="Email">
      <input data-f="linkedinUrl" placeholder="LinkedIn URL">
      <button class="btn danger" type="button" title="Ye banda hatao">✕</button>`;
    div.querySelector('button').onclick = () => div.remove();
    rowsBox.appendChild(div);
    return div;
  };
  for (let i = 0; i < 4; i++) addRow();
  document.getElementById('addPerson').onclick = () => addRow().querySelector('input').focus();

  document.getElementById('saveCollege').onclick = () => guard(async () => {
    const contacts = [...rowsBox.querySelectorAll('.contact-form')].map((row) => {
      const o = {};
      row.querySelectorAll('input').forEach((el) => (o[el.dataset.f] = el.value.trim()));
      return o;
    }).filter((o) => o.name || o.email || o.linkedinUrl);
    await api('POST', '/colleges', { name: document.getElementById('cName').value, city: document.getElementById('cCity').value, website: document.getElementById('cWebsite').value, contacts });
    toast(`${seg.unit} saved`); currentTab = 'colleges'; render();
  });
  const csvBox = document.getElementById('csv');
  const csvInfo = document.getElementById('csvInfo');
  const showCount = () => { const n = parseCsv(csvBox.value).length; csvInfo.textContent = n ? `${n} rows ready hain` : ''; };
  csvBox.addEventListener('input', showCount);
  document.getElementById('csvFile').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { csvBox.value = String(rd.result).replace(/^﻿/, ''); showCount(); };
    rd.readAsText(f);
  };
  document.getElementById('dlTemplate').onclick = () => {
    const rows = seg.slug !== 'college' ? [
      [seg.unit.toLowerCase(), 'role', 'name', 'email', 'linkedin', 'website'],
      ['Demo Startup A', 'Founder', 'Riya Shah', 'riya@demo-a.io', 'linkedin.com/in/riya-demo', 'demo-a.io'],
      ['Demo Startup A', 'CTO', 'Aman Verma', 'aman@demo-a.io', 'linkedin.com/in/aman-demo', 'demo-a.io'],
      ['Demo Startup B', 'CEO', 'Kabir Nair', 'kabir@demo-b.io', 'linkedin.com/in/kabir-demo', 'demo-b.io'],
      ['Demo Startup B', 'Head of HR', 'Sneha Rao', 'sneha@demo-b.io', 'linkedin.com/in/sneha-demo', 'demo-b.io'],
    ] : [
      ['college', 'role', 'name', 'email', 'linkedin', 'website'],
      ['Demo College A', 'Dean', 'Dr. Anita Sharma', 'anita@demo-a.edu', 'linkedin.com/in/anita-demo', 'demo-a.edu'],
      ['Demo College A', 'Head', 'Prof. Rajesh Iyer', 'rajesh@demo-a.edu', 'linkedin.com/in/rajesh-demo', 'demo-a.edu'],
      ['Demo College A', 'Manager', 'Priya Menon', 'priya@demo-a.edu', 'linkedin.com/in/priya-demo', 'demo-a.edu'],
      ['Demo College B', 'Principal', 'Dr. Suresh Patil', 'suresh@demo-b.edu', 'linkedin.com/in/suresh-demo', 'demo-b.edu'],
      ['Demo College B', 'Placement Officer', 'Neha Kulkarni', 'neha@demo-b.edu', 'linkedin.com/in/neha-demo', 'demo-b.edu'],
    ];
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `botza-${seg.slug}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  document.getElementById('doImport').onclick = () => guard(async () => {
    const rows = parseCsv(document.getElementById('csv').value);
    if (!rows.length) return toast('Kuch paste karo');
    const r = await api('POST', '/import', { rows });
    toast(`${r.colleges} ${seg.unitPlural.toLowerCase()}, ${r.contacts} contacts imported`); currentTab = 'colleges'; render();
  });
}

// ---------- SETTINGS ----------
async function renderSettings() {
  // working copy: first step = primary message, rest = follow-ups
  const draft = {
    email: { first: settings.emailSteps[0], gaps: settings.emailSteps.slice(1).map((s) => s.gapDays) },
    linkedin: { first: settings.linkedinSteps[0], gaps: settings.linkedinSteps.slice(1).map((s) => s.gapDays) },
  };
  // drafts per channel, index 0 = primary/connection note, then follow-ups
  // (email: college card "📋 Prompt"; linkedin: 📋 copy icon in Aaj ka kaam)
  const drafts = {
    email: settings.emailSteps.map((s) => s.draft || ''),
    linkedin: settings.linkedinSteps.map((s) => s.draft || ''),
  };
  const attachments = settings.emailSteps.map((s) => s.attachment || ''); // email only; non-empty = Claude drafts, user sends
  const titles = { email: '📧 Email', linkedin: '💼 LinkedIn' };
  const firstNames = { email: 'Primary Email', linkedin: 'Connection Note' };
  const noFollow = (ch) => ch === 'linkedin' && seg.linkedinMax <= 1; // college: LinkedIn = connection note only
  const maxFollow = (ch) => (ch === 'linkedin' ? seg.linkedinMax - 1 : 15);
  let importNote = ''; // result of the last import, shown in the import box

  function draw() {
    view.innerHTML = `<div class="card"><h2>Follow-up settings — ${esc(seg.name)}</h2>
      <p class="muted">Primary message sabse pehle bhejna hota hai (wo bhi Aaj ka kaam me aata hai, aur "Bhej diya" dabake log hota hai). Uske baad ke follow-ups yahan set karo.</p>
      <div style="display:flex;gap:48px;flex-wrap:wrap">
        ${['email', 'linkedin'].map((ch) => `
          <div>
            <h3>${titles[ch]}</h3>
            <div class="row"><b>1. ${firstNames[ch]}</b> <span class="muted">(pehla message)</span></div>
            ${noFollow(ch) ? '<div class="row muted">Sirf connection note — follow-ups nahi hote.</div>' : `<div class="row">Follow-ups kitne?
              <button class="btn small" data-dec="${ch}">−</button>
              <input type="number" min="0" max="${maxFollow(ch)}" data-count="${ch}" value="${draft[ch].gaps.length}" style="width:64px">
              <button class="btn small" data-inc="${ch}">+</button></div>`}
            ${noFollow(ch) ? '' : draft[ch].gaps.map((g, i) => `<div class="row">
              <span style="width:110px">${i + 2}. Follow-up ${i + 1}</span>
              <span class="muted">pichhle ke</span>
              <input type="number" min="0" data-gap="${ch}" data-i="${i}" value="${g}" style="width:64px"> <span class="muted">din baad</span></div>`).join('')}
          </div>`).join('')}
      </div>
      <div class="help" style="margin-top:20px"><b>📄 PDF / document se drafts import karo</b>
        <ol class="steps" style="margin:6px 0">
          <li><button class="btn small" id="copyImportPrompt">Claude ke liye prompt copy karo</button> — Claude me apna PDF attach karke ye prompt paste karo, wo document ko sahi format me restructure kar dega.</li>
          <li>Claude ka output (ya uska PDF/.txt) yahan do: <input type="file" id="importFile" accept=".pdf,.txt,.md,text/plain,application/pdf"> ya text paste karo:</li>
        </ol>
        <textarea id="importText" placeholder="### EMAIL | Primary Email&#10;Subject: ...&#10;&#10;Hi {first_name}, ...&#10;&#10;### LINKEDIN | Connection Note&#10;..." style="min-height:70px"></textarea>
        <div class="row" style="margin-top:8px"><button class="btn primary" id="runImport">Drafts bharo (preview)</button>
          <span class="muted">Sirf neeche ke boxes bharenge, Save dabane par hi save hoga.</span></div>
        ${importNote ? `<p>${importNote}</p>` : ''}
      </div>
      <h3>✍️ Email drafts</h3>
      <p class="muted">Har step ka ready draft yahan paste karo (pehli line <code>Subject: ...</code> ho sakti hai). Placeholders: <code>{first_name}</code>, <code>{company}</code> (= ${esc(seg.unit.toLowerCase())} ka naam; <code>{college}</code> bhi chalta hai), <code>{sender_name}</code> (Aaj ka kaam me college card ke "Sender naam" box se aata hai — Email prompt aur LinkedIn 📋 dono me). College card ka "📋 Prompt" isi draft ko Claude ko dega.</p>
      ${drafts.email.map((d, i) => `<div style="margin-bottom:12px"><b>${i === 0 ? firstNames.email : 'Follow-up ' + i}</b>
        <label class="muted" style="margin-left:12px">📎 Attachment: <input data-attach="${i}" value="${esc(attachments[i] || '')}" placeholder="khali = seedha send; e.g. Demo video" style="width:240px"></label>
        <textarea data-draft="email:${i}" placeholder="Subject: ...&#10;&#10;Hi {first_name}, ...">${esc(d)}</textarea></div>`).join('')}
      <h3>💼 LinkedIn drafts</h3>
      <p class="muted">Har step ka message yahan paste karo. Placeholders: <code>{first_name}</code>, <code>{company}</code> (= ${esc(seg.unit.toLowerCase())} ka naam; <code>{college}</code> bhi chalta hai), <code>{sender_name}</code>. Aaj ka kaam me LinkedIn task par 📋 dabane se ye copy hoga.</p>
      ${drafts.linkedin.map((d, i) => `<div style="margin-bottom:12px"><b>${i === 0 ? firstNames.linkedin : 'Follow-up ' + i}</b>
        <textarea data-draft="linkedin:${i}" placeholder="Hi {first_name}, ...">${esc(d)}</textarea></div>`).join('')}
      <br><button class="btn primary" id="saveSettings">Save</button></div>`;

    const setCount = (ch, n) => {
      n = Math.max(0, Math.min(maxFollow(ch), Number(n) || 0));
      while (draft[ch].gaps.length < n) draft[ch].gaps.push(2);
      draft[ch].gaps.length = n;
      while (drafts[ch].length < n + 1) drafts[ch].push('');
      drafts[ch].length = n + 1;
      if (ch === 'email') { while (attachments.length < n + 1) attachments.push(''); attachments.length = n + 1; }
    };
    const sync = () => {
      view.querySelectorAll('[data-attach]').forEach((el) => (attachments[el.dataset.attach] = el.value.trim()));
      view.querySelectorAll('[data-gap]').forEach((el) => (draft[el.dataset.gap].gaps[el.dataset.i] = Math.max(0, Number(el.value) || 0)));
      view.querySelectorAll('[data-draft]').forEach((el) => {
        const [ch, i] = el.dataset.draft.split(':');
        drafts[ch][i] = el.value;
      });
    };
    view.querySelectorAll('[data-inc]').forEach((b) => b.onclick = () => { sync(); setCount(b.dataset.inc, draft[b.dataset.inc].gaps.length + 1); draw(); });
    view.querySelectorAll('[data-dec]').forEach((b) => b.onclick = () => { sync(); setCount(b.dataset.dec, draft[b.dataset.dec].gaps.length - 1); draw(); });
    view.querySelectorAll('[data-count]').forEach((el) => el.onchange = () => {
      const ch = el.dataset.count;
      if (Number(el.value) > maxFollow(ch)) toast(`${ch === 'linkedin' ? 'LinkedIn' : 'Email'} me max ${maxFollow(ch)} follow-ups ho sakte hain`);
      sync(); setCount(ch, el.value); draw();
    });
    // clicking a number box selects its value, so typing "1" replaces the old number instead of becoming "21"
    view.querySelectorAll('input[type="number"]').forEach((el) => {
      el.addEventListener('focus', () => { el.select(); el.dataset.justFocused = '1'; });
      el.addEventListener('mouseup', (e) => { if (el.dataset.justFocused) { e.preventDefault(); delete el.dataset.justFocused; } });
    });
    document.getElementById('copyImportPrompt').onclick = () => { navigator.clipboard.writeText(IMPORT_PROMPT); toast('Prompt copied'); };
    document.getElementById('runImport').onclick = () => guard(async () => {
      const file = document.getElementById('importFile').files[0];
      let text = document.getElementById('importText').value;
      if (file) text = /\.pdf$/i.test(file.name) || file.type === 'application/pdf' ? await pdfToText(file) : await file.text();
      const r = parseDrafts(text);
      sync();
      if (r.count) {
        for (const ch of ['email', 'linkedin']) {
          const last = r[ch].length - 1;
          if (!noFollow(ch) && last > draft[ch].gaps.length) setCount(ch, last); // document has more follow-ups than settings
          r[ch].forEach((d, i) => { if (d && i < drafts[ch].length) drafts[ch][i] = d; });
        }
      }
      const done = ['email', 'linkedin'].map((ch) => `${r[ch].filter(Boolean).length} ${ch === 'email' ? 'email' : 'LinkedIn'}`).join(' + ');
      importNote = (r.count ? `✅ ${done} draft neeche bhar diye. Check/edit karke <b>Save</b> dabao.<br>` : '')
        + r.warnings.map((w) => `⚠️ ${esc(w)}`).join('<br>');
      draw();
      if (r.count) toast(`${r.count} drafts bhare — Save dabana mat bhulo`);
    });
    document.getElementById('saveSettings').onclick = () => guard(async () => {
      sync();
      const build = (ch) => [
        { label: firstNames[ch], gapDays: 0, draft: drafts[ch][0], ...(ch === 'email' && { attachment: attachments[0] || '' }) },
        ...(noFollow(ch) ? [] : draft[ch].gaps).map((g, i) => ({ label: `Follow-up ${i + 1}`, gapDays: g, draft: drafts[ch][i + 1], ...(ch === 'email' && { attachment: attachments[i + 1] || '' }) })),
      ];
      await api('PUT', '/settings', { emailSteps: build('email'), linkedinSteps: build('linkedin') });
      toast('Saved'); render();
    });
  }
  draw();
}

// ---------- SEARCH ----------
(function () {
  const q = document.getElementById('q');
  const box = document.getElementById('results');
  let timer;
  const close = () => { box.hidden = true; };
  async function run() {
    const term = q.value.trim();
    if (term.length < 2) return close();
    const hits = await api('GET', '/search?q=' + encodeURIComponent(term));
    box.hidden = false;
    if (!hits.length) { box.innerHTML = '<div class="res-empty">Kuch nahi mila. Email/naam check karo ya contact add karo.</div>'; return; }
    box.innerHTML = hits.map((h) => `
      <div class="res">
        <div class="res-top"><b>${esc(h.college)}</b> · ${esc(h.name || '—')} <span class="role">${esc(h.role)}</span>
          ${h.status !== 'active' ? '<span class="tag due">Reply aaya / tumhare paas</span>' : ''}</div>
        <div class="res-line">${esc(h.email)} ${h.linkedinUrl ? `· <a href="${esc(safeUrl(h.linkedinUrl))}" target="_blank" rel="noopener">LinkedIn ↗</a>` : ''}</div>
        <div class="res-line">📧 ${esc(h.emailSummary)}<br>💼 ${esc(h.linkedinSummary)}</div>
        ${h.replyNote ? `<div class="res-line muted">Note: ${esc(h.replyNote)}</div>` : ''}
        <div class="res-actions">${h.status === 'active'
          ? `<button class="btn primary small" data-sreply="${h._id}" data-who="${esc(h.name || h.role)}">Reply aaya — follow-ups band karo</button>`
          : `<button class="btn small" data-sresume="${h._id}">Follow-ups phir se chalu karo</button>`}</div>
      </div>`).join('');
    box.querySelectorAll('[data-sreply]').forEach((b) => b.onclick = () => guard(async () => {
      const note = prompt(`${b.dataset.who} ka reply aaya. Note likho (optional):`, '');
      if (note === null) return;
      await api('POST', `/contacts/${b.dataset.sreply}/status`, { status: 'handling_personally', note });
      toast('Follow-ups band'); run(); render();
    }));
    box.querySelectorAll('[data-sresume]').forEach((b) => b.onclick = () => guard(async () => {
      await api('POST', `/contacts/${b.dataset.sresume}/status`, { status: 'active' });
      toast('Chalu'); run(); render();
    }));
  }
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => guard(run), 250); });
  q.addEventListener('focus', () => q.value.trim().length >= 2 && guard(run));
  document.addEventListener('click', (e) => { if (!e.target.closest('#searchBox')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();


// DB indicator in footer (so both users can confirm they see the same database)
fetch('/api/health').then((r) => r.json()).then((h) => {
  const el = document.createElement('div');
  el.style.cssText = 'text-align:center;color:#9ca3af;font-size:12px;padding:16px';
  el.textContent = 'DB: ' + h.db + ' @ ' + h.host + ' · ' + h.colleges + ' colleges, ' + h.contacts + ' contacts' + (h.cloud ? '' : ' · LOCAL DB (shared nahi)');
  document.body.appendChild(el);
}).catch(() => {});

// ---------- SEGMENTS (landing screen, shown on every page load) ----------
const landing = document.getElementById('landing');
const appEl = document.getElementById('app');

function enterSegment(chosen) {
  seg = chosen;
  lsSet('lastSegment', seg.slug);
  currentTab = 'today';
  todayStep = ''; todayFilter = '';
  landing.hidden = true; appEl.hidden = false;
  document.getElementById('segName').textContent = seg.name;
  todaySub = 'email'; settings = null; liData = null;
  document.getElementById('tabColleges').textContent = `Saare ${seg.unitPlural.toLowerCase()}`;
  document.getElementById('tabAdd').textContent = `${seg.unit} add karo`;
  document.getElementById('q').value = '';
  document.getElementById('results').hidden = true;
  guard(render);
}

async function showLanding() {
  seg = null;
  appEl.hidden = true; landing.hidden = false;
  landing.innerHTML = '<div class="land-loading">Loading…</div>';
  const segs = await api('GET', '/segments');
  const last = lsGet('lastSegment');
  landing.innerHTML = `<div class="land">
    <div class="brand land-brand"><div class="logo">B</div><h1>Botza Outreach<small>Tracker</small></h1></div>
    <h2>Aapko kis segment me jaana hai?</h2>
    <p class="muted">Segment chuno. Har segment ke contacts, drafts aur follow-ups alag rehte hain.</p>
    <div class="seg-grid">
      ${segs.map((g) => `<button class="seg-card ${g.slug === last ? 'last' : ''}" data-seg="${esc(g.slug)}">
        <span class="seg-ico">${ic(g.slug === 'college' ? 'school' : g.slug === 'startup' ? 'rocket' : 'folder')}</span>
        <b>${esc(g.name)}</b>
        <span class="seg-meta">${g.orgs} ${esc((g.orgs === 1 ? g.unit : g.unitPlural).toLowerCase())} · ${g.contacts} contacts</span>
        ${g.slug === last ? '<span class="seg-last">Pichhli baar yahin the</span>' : ''}
        ${BUILT_IN.includes(g.slug) ? '' : `<span class="seg-del" role="button" tabindex="0" data-delseg="${esc(g.slug)}" title="Is segment ko delete karo">${ic('trash')}</span>`}
      </button>`).join('')}
      <button class="seg-card add" id="segAddBtn" type="button"><span class="seg-ico">${ic('plus')}</span><b>Naya segment add karo</b><span class="seg-meta">Jaise Agencies, Hospitals, Schools…</span></button>
    </div>
    <form id="segForm" class="card seg-form" hidden>
      <h3>Naya segment</h3>
      <div class="row"><input id="sfName" placeholder="Segment ka naam * (jaise Agencies)" required>
        <input id="sfUnit" placeholder="Ek ko kya bolte hain? (jaise Agency)" style="min-width:220px"></div>
      <div class="row"><button class="btn primary" type="submit">Segment banao</button><button class="btn" type="button" id="sfCancel">Cancel</button></div>
    </form>
  </div>`;
  landing.querySelectorAll('[data-seg]').forEach((b) => b.onclick = () => enterSegment(segs.find((g) => g.slug === b.dataset.seg)));
  landing.querySelectorAll('[data-delseg]').forEach((d) => {
    const run = (e) => {
      e.stopPropagation(); e.preventDefault();
      const g = segs.find((x) => x.slug === d.dataset.delseg);
      const typed = prompt(`"${g.name}" segment delete karne par uske ${g.orgs} ${g.unitPlural.toLowerCase()} aur ${g.contacts} contacts hamesha ke liye hat jayenge. Wapas nahi aayega.\n\nPakka karne ke liye segment ka naam likho:`, '');
      if (typed === null) return;
      if (typed.trim().toLowerCase() !== g.name.trim().toLowerCase()) return toast('Naam match nahi hua, delete nahi hua');
      guard(async () => {
        const r = await api('DELETE', `/segments/${encodeURIComponent(g.slug)}`);
        if (lsGet('lastSegment') === g.slug) lsSet('lastSegment', '');
        toast(`"${g.name}" delete ho gaya (${r.orgs} ${g.unitPlural.toLowerCase()}, ${r.contacts} contacts)`);
        showLanding();
      });
    };
    d.onclick = run;
    d.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') run(e); };
  });
  const form = document.getElementById('segForm');
  document.getElementById('segAddBtn').onclick = () => { form.hidden = false; document.getElementById('sfName').focus(); };
  document.getElementById('sfCancel').onclick = () => { form.hidden = true; };
  form.onsubmit = (e) => {
    e.preventDefault();
    guard(async () => {
      const created = await api('POST', '/segments', { name: document.getElementById('sfName').value, unit: document.getElementById('sfUnit').value });
      toast('Segment ban gaya');
      enterSegment({ ...created, linkedinMax: created.linkedinMax ?? 3 });
    });
  };
}
document.getElementById('segSwitch').onclick = () => guard(showLanding);

guard(showLanding);
