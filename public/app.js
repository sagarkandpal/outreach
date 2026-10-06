const view = document.getElementById('view');
let settings = null;
let currentTab = 'today';
let todayFilter = ''; // Today tab channel filter, kept across re-renders
const OWNERS = { arjun: 'Arjun', sagar: 'Sagar' };
const lsGet = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
let todayOwner = lsGet('todayOwner'); // Today tab owner filter ('' = all, 'arjun', 'sagar', 'none')
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
};
const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;


const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(method, url, body) {
  const r = await fetch('/api' + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
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
  settings = await api('GET', '/settings');
  refreshBadges();
  await ({ today: renderToday, colleges: renderColleges, replied: renderReplied, assign: renderAssign, add: renderAdd, settings: renderSettings }[currentTab])();
}

async function refreshBadges() {
  const [today, replied, colleges] = await Promise.all([api('GET', '/today'), api('GET', '/replied'), api('GET', '/colleges')]);
  document.getElementById('todayCount').textContent = today.length;
  document.getElementById('repliedCount').textContent = replied.length;
  const unassigned = colleges.filter((c) => !c.owner).length;
  const ab = document.getElementById('assignCount');
  ab.textContent = unassigned;
  ab.classList.toggle('grey', !unassigned);
}

// ---------- TODAY ----------
const ownerMatch = (i) => !todayOwner || (todayOwner === 'none' ? !i.owner : i.owner === todayOwner);

async function renderToday() {
  let items = await api('GET', '/today');
  const mine0 = items.filter(ownerMatch);
  const late = mine0.filter((i) => i.state === 'overdue').length;
  const collegeCount = new Set(mine0.map((i) => i.college)).size;
  view.innerHTML = `
    <div class="owner-tabs" id="ownerTabs"></div>
    <div class="stats">
      <div class="stat"><b id="stTotal">${mine0.length}</b><span>Aaj ke kaam</span></div>
      <div class="stat ${late ? 'bad' : ''}" id="stLateBox"><b id="stLate">${late}</b><span>Late ho chuke</span></div>
      <div class="stat"><b id="stColleges">${collegeCount}</b><span>Colleges</span></div>
      <div class="filter">Dikhao:
        <select id="fChannel"><option value="">Email + LinkedIn</option><option value="email">Sirf Email</option><option value="linkedin">Sirf LinkedIn</option></select>
      </div>
    </div>
    <div class="help"><b>Kaise use karein:</b> message bhejo → <b>✓ Bhej diya</b> dabao. Email ka agla follow-up apne aap 2 din baad yahin aa jayega. Card me <b>✓ Sab Bhej diya</b> dabake us college ke saare tasks ek saath mark karo. Kisi ka reply aaye toh <b>Reply aaya</b> dabao — uske baaki follow-ups ruk jayenge. Upar search me email dalo toh turant pata chal jayega wo kis college ka hai.</div>
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
      todayOwner = b.dataset.owner; lsSet('todayOwner', todayOwner);
      drawOwnerTabs(); draw(); drawDone(); updateStats();
    });
  };

  // college card 📋 button: build the prompt for one college
  const buildPrompt = async (college, senderName) => {
    try { localStorage.setItem('senderName', senderName); } catch {}
    return api('POST', '/prompt/emails', { senderName, college });
  };

  const updateStats = () => {
    const mine = items.filter(ownerMatch);
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
          card.querySelector('.tcard-body').innerHTML = `<div class="card-done">${ic('check')}Is college ka kaam ho gaya</div>`;
          card.querySelectorAll('.tcard-head button, .tcard-head input').forEach((el) => { el.disabled = true; });
        }
      }, 220);
    });
    drawOwnerTabs(); updateStats();
    drawDone(); refreshBadges();
  };

  const draw = () => {
    const ch = document.getElementById('fChannel').value;
    const list = items.filter((i) => (!ch || i.channel === ch) && ownerMatch(i));
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
          ${[...people.values()].some((p) => p.tasks.some((t) => t.channel === 'email'))
            ? `<span class="card-prompt"><input data-sender placeholder="Sender naam" value="${esc(savedSender())}" style="width:110px">
                <button class="btn small" data-copycollege="${esc(name)}" title="Is college ke saare emails ka Claude prompt copy karo">${ic('copy')}Prompt</button></span>` : ''}
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
      if (!r.count) return toast(r.skipped[0] || 'Is college ka koi email ready nahi');
      await navigator.clipboard.writeText(r.prompt);
      toast(`${college.replace('[DEMO] ', '')}: ${r.count} emails ka prompt copy ho gaya ✓`);
    }));
    box.querySelectorAll('[data-msg]').forEach((b) => b.onclick = () => {
      const t = items.find((x) => x.contactId === b.dataset.msg && x.channel === 'linkedin');
      if (!t || !t.message) return toast('Settings me is step ka LinkedIn draft nahi hai');
      navigator.clipboard.writeText(t.message);
      toast(`${t.stepLabel} copied ✓`);
    });
    box.querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => { navigator.clipboard.writeText(b.dataset.copy); toast('Copied'); });
  };
  const sel = document.getElementById('fChannel');
  sel.value = todayFilter;
  sel.onchange = () => { todayFilter = sel.value; draw(); drawDone(); };
  drawOwnerTabs();
  draw();
  drawDone();
}

// ---------- COLLEGES grid ----------
function cellHtml(cell, channel, idx, contactId, label) {
  const attr = `data-c="${contactId}" data-ch="${channel}" data-i="${idx}" data-s="${cell.state}" title="${esc(label)}"`;
  switch (cell.state) {
    case 'sent': return `<button class="cell sent" ${attr} title="${esc(label)} — ${prettyDate(cell.date)}">✓ ${prettyDate(cell.date)}</button>`;
    case 'due': return `<button class="cell due" ${attr}>Aaj</button>`;
    case 'overdue': return `<button class="cell overdue" ${attr}>${cell.days}d late</button>`;
    case 'wait': return `<button class="cell wait" ${attr}>${cell.days}d baad</button>`;
    case 'stopped': return `<span class="cell stopped" title="Stopped">⏸</span>`;
    default: return `<span class="cell locked">–</span>`;
  }
}

async function renderColleges() {
  const colleges = await api('GET', '/colleges');
  if (!colleges.length) { view.innerHTML = '<div class="card empty">Abhi koi college nahi. "Add / Import" me jaake add karo.</div>'; return; }
  view.innerHTML = `
    <div class="legend">
      <span><b style="color:var(--green)">✓ date</b> bheja</span><span><b style="color:var(--amber)">Aaj</b> aaj bhejna hai</span>
      <span><b style="color:var(--red)">Nd late</b> deri</span><span><b>Nd baad</b> abhi wait (click = jaldi bheja)</span>
      <span>⏸ reply aaya / ruka</span><span>Sent cell click = date badlo (last wale pe "x" = undo)</span>
    </div>
    ${colleges.map((col) => `
    <div class="card college">
      <h3><span>${esc(col.name)} <span class="muted">${esc(col.city || '')}</span></span>
        <span><button class="btn" data-addc="${col._id}">+ Contact</button> <button class="btn danger" data-delcol="${col._id}">Delete</button></span></h3>
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
            ${c.linkedinCells.map((cell, i) => `<td>${cellHtml(cell, 'linkedin', i, c._id, settings.linkedinSteps[i].label)}</td>`).join('')}
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
    if (!confirm('Poora college + uske saare contacts delete karun?')) return;
    await api('DELETE', `/colleges/${b.dataset.delcol}`); render();
  }));
  view.querySelectorAll('[data-addc]').forEach((b) => b.onclick = () => guard(async () => {
    const role = prompt('Role (jaise Dean, Head, Principal...):', '');
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
    <div class="help"><b>Kaun kaunsa college bhejega:</b> college ke saamne apne naam ka checkbox tick karo. Naye colleges (import/add) pehle <b>Unassigned</b> me aate hain, yahin se assign karo. "Aaj ka kaam" me upar se Arjun / Sagar ke colleges alag dekh sakte ho.</div>
    <div class="legend">${tabs.map(([k, l]) => `<button class="btn small ${assignFilter === k ? 'primary' : ''}" data-af="${k}">${l} (${k ? count(k) : colleges.length})</button>`).join(' ')}</div>
    <div class="card"><table><thead><tr><th>College</th><th>Contacts</th><th>Arjun</th><th>Sagar</th></tr></thead><tbody>
      ${list.map((c) => `<tr>
        <td><b>${esc(c.name)}</b> <span class="muted">${esc(c.city || '')}</span></td>
        <td>${c.contacts.length}</td>
        ${Object.keys(OWNERS).map((o) => `<td><label><input type="checkbox" data-own="${c._id}" data-o="${o}" ${c.owner === o ? 'checked' : ''}> ${OWNERS[o]}</label></td>`).join('')}
      </tr>`).join('') || '<tr><td colspan="4" class="muted">Is list me koi college nahi.</td></tr>'}
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
    ${list.length ? `<table><thead><tr><th>College</th><th>Banda</th><th>Since</th><th>Note</th><th></th></tr></thead><tbody>
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
  // minimal CSV/TSV parser with quote support; columns: college, role, name, email, linkedin
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
    rows.push({ college: cols[0], role: cols[1], name: cols[2], email: cols[3], linkedin: cols[4] });
  }
  if (rows[0] && /^college/i.test(rows[0].college || '')) rows.shift(); // header row
  return rows;
}

async function renderAdd() {
  const roleList = `<datalist id="roleList">${ROLE_SUGGESTIONS.map((r) => `<option value="${esc(r)}">`).join('')}</datalist>`;
  view.innerHTML = `
    <div class="card"><h2>Naya college add karo</h2>
      <div class="row"><input id="cName" placeholder="College name *" style="min-width:280px"><input id="cCity" placeholder="City (optional)"></div>
      <div id="contactRows"></div>
      ${roleList}
      <div class="row">
        <button class="btn" id="addPerson">+ Banda add karo</button>
        <button class="btn primary" id="saveCollege">Save college</button>
      </div>
    </div>
    <div class="card"><h2>Bulk import (Apollo / CSV / Excel se paste)</h2>
      <ol class="steps">
        <li><button class="btn small" id="dlTemplate">⬇ Demo template download karo (Excel me khulega)</button></li>
        <li>Excel me apni profiles bharo: <b>college, role, name, email, linkedin</b>. Ek banda = ek row. Ek college ke jitne bande, utni rows (college ka naam har row me same likho).</li>
        <li>Phir ya toh <b>CSV file chuno</b>: <input type="file" id="csvFile" accept=".csv,.tsv,.txt"> ya Excel me rows select karke <b>Copy</b> karo aur neeche box me <b>Paste</b> karo.</li>
        <li><b>Import</b> dabao. Template ke sample rows (Demo College) hata dena ya baad me delete kar dena.</li>
      </ol>
      <textarea id="csv" placeholder="IIT Demo, Dean, Dr. Sharma, sharma@iit.edu, linkedin.com/in/sharma"></textarea>
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
    await api('POST', '/colleges', { name: document.getElementById('cName').value, city: document.getElementById('cCity').value, contacts });
    toast('College saved'); currentTab = 'colleges'; render();
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
    const rows = [
      ['college', 'role', 'name', 'email', 'linkedin'],
      ['Demo College A', 'Dean', 'Dr. Anita Sharma', 'anita@demo-a.edu', 'linkedin.com/in/anita-demo'],
      ['Demo College A', 'Head', 'Prof. Rajesh Iyer', 'rajesh@demo-a.edu', 'linkedin.com/in/rajesh-demo'],
      ['Demo College A', 'Manager', 'Priya Menon', 'priya@demo-a.edu', 'linkedin.com/in/priya-demo'],
      ['Demo College B', 'Principal', 'Dr. Suresh Patil', 'suresh@demo-b.edu', 'linkedin.com/in/suresh-demo'],
      ['Demo College B', 'Placement Officer', 'Neha Kulkarni', 'neha@demo-b.edu', 'linkedin.com/in/neha-demo'],
    ];
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'botza-import-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  document.getElementById('doImport').onclick = () => guard(async () => {
    const rows = parseCsv(document.getElementById('csv').value);
    if (!rows.length) return toast('Kuch paste karo');
    const r = await api('POST', '/import', { rows });
    toast(`${r.colleges} colleges, ${r.contacts} contacts imported`); currentTab = 'colleges'; render();
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
  let importNote = ''; // result of the last import, shown in the import box

  function draw() {
    view.innerHTML = `<div class="card"><h2>Follow-up settings</h2>
      <p class="muted">Primary message sabse pehle bhejna hota hai (wo bhi Aaj ka kaam me aata hai, aur "Bhej diya" dabake log hota hai). Uske baad ke follow-ups yahan set karo.</p>
      <div style="display:flex;gap:48px;flex-wrap:wrap">
        ${['email', 'linkedin'].map((ch) => `
          <div>
            <h3>${titles[ch]}</h3>
            <div class="row"><b>1. ${firstNames[ch]}</b> <span class="muted">(pehla message)</span></div>
            ${ch === 'linkedin' ? '<div class="row muted">Sirf connection note — follow-ups nahi hote.</div>' : `<div class="row">Follow-ups kitne?
              <button class="btn small" data-dec="${ch}">−</button>
              <input type="number" min="0" max="15" data-count="${ch}" value="${draft[ch].gaps.length}" style="width:64px">
              <button class="btn small" data-inc="${ch}">+</button></div>`}
            ${ch === 'linkedin' ? '' : draft[ch].gaps.map((g, i) => `<div class="row">
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
      <p class="muted">Har step ka ready draft yahan paste karo (pehli line <code>Subject: ...</code> ho sakti hai). Placeholders: <code>{first_name}</code>, <code>{college}</code>, <code>{sender_name}</code> (Aaj ka kaam me college card ke "Sender naam" box se aata hai). College card ka "📋 Prompt" isi draft ko Claude ko dega.</p>
      ${drafts.email.map((d, i) => `<div style="margin-bottom:12px"><b>${i === 0 ? firstNames.email : 'Follow-up ' + i}</b>
        <label class="muted" style="margin-left:12px">📎 Attachment: <input data-attach="${i}" value="${esc(attachments[i] || '')}" placeholder="khali = seedha send; e.g. Demo video" style="width:240px"></label>
        <textarea data-draft="email:${i}" placeholder="Subject: ...&#10;&#10;Hi {first_name}, ...">${esc(d)}</textarea></div>`).join('')}
      <h3>💼 LinkedIn drafts</h3>
      <p class="muted">Har step ka message yahan paste karo. Placeholders: <code>{first_name}</code>, <code>{college}</code>. Aaj ka kaam me LinkedIn task par 📋 dabane se ye copy hoga.</p>
      ${drafts.linkedin.map((d, i) => `<div style="margin-bottom:12px"><b>${i === 0 ? firstNames.linkedin : 'Follow-up ' + i}</b>
        <textarea data-draft="linkedin:${i}" placeholder="Hi {first_name}, ...">${esc(d)}</textarea></div>`).join('')}
      <br><button class="btn primary" id="saveSettings">Save</button></div>`;

    const setCount = (ch, n) => {
      n = Math.max(0, Math.min(15, Number(n) || 0));
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
    view.querySelectorAll('[data-count]').forEach((el) => el.onchange = () => { sync(); setCount(el.dataset.count, el.value); draw(); });
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
          if (ch === 'email' && last > draft[ch].gaps.length) setCount(ch, Math.min(last, 15)); // document has more follow-ups than settings
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
        ...(ch === 'linkedin' ? [] : draft[ch].gaps).map((g, i) => ({ label: `Follow-up ${i + 1}`, gapDays: g, draft: drafts[ch][i + 1], ...(ch === 'email' && { attachment: attachments[i + 1] || '' }) })),
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

render();
