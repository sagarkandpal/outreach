const express = require('express');
const { College, Contact, Settings, getSettings } = require('./models');
const { decorate } = require('./due');
const { buildEmailPrompt } = require('./prompt');

const router = express.Router();
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(500).json({ error: e.message }));

// "YYYY-MM-DD" -> local noon (avoids timezone day-shifts); missing -> now
function parseDate(s) {
  if (!s) return new Date();
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

const trackField = (channel) => (channel === 'linkedin' ? 'linkedinSent' : 'emailSent');
const trackSteps = (settings, channel) => (channel === 'linkedin' ? settings.linkedinSteps : settings.emailSteps);

// ---------- settings ----------
router.get('/settings', wrap(async (req, res) => res.json(await getSettings())));

router.put('/settings', wrap(async (req, res) => {
  const s = await getSettings();
  const { emailSteps, linkedinSteps, roles } = req.body;
  if (emailSteps) s.emailSteps = emailSteps;
  if (linkedinSteps) s.linkedinSteps = linkedinSteps;
  if (roles) s.roles = roles;
  await s.save();
  res.json(s);
}));

// ---------- colleges ----------
router.get('/colleges', wrap(async (req, res) => {
  const settings = await getSettings();
  const colleges = await College.find().sort({ createdAt: 1 }).lean();
  const contacts = await Contact.find().sort({ createdAt: 1 }).lean();
  const byCollege = {};
  contacts.forEach((c) => (byCollege[c.collegeId] ||= []).push(decorate(c, settings)));
  res.json(colleges.map((c) => ({ ...c, contacts: byCollege[c._id] || [] })));
}));

router.post('/colleges', wrap(async (req, res) => {
  const { name, city, notes, contacts = [] } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'College name required' });
  const college = await College.create({ name, city, notes });
  const rows = contacts.filter((c) => c.name || c.email || c.linkedinUrl || c.role);
  if (rows.length) await Contact.insertMany(rows.map((c) => ({ ...c, collegeId: college._id })));
  res.json(college);
}));

router.patch('/colleges/:id', wrap(async (req, res) => {
  const { name, city, notes } = req.body;
  res.json(await College.findByIdAndUpdate(req.params.id, { name, city, notes }, { new: true }));
}));

router.delete('/colleges/:id', wrap(async (req, res) => {
  await Contact.deleteMany({ collegeId: req.params.id });
  await College.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

// ---------- contacts ----------
router.post('/contacts', wrap(async (req, res) => {
  const { collegeId, role, name, email, linkedinUrl } = req.body;
  res.json(await Contact.create({ collegeId, role, name, email, linkedinUrl }));
}));

router.patch('/contacts/:id', wrap(async (req, res) => {
  const { role, name, email, linkedinUrl } = req.body;
  res.json(await Contact.findByIdAndUpdate(req.params.id, { role, name, email, linkedinUrl }, { new: true }));
}));

router.delete('/contacts/:id', wrap(async (req, res) => {
  await Contact.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

// mark next step sent
router.post('/contacts/:id/sent', wrap(async (req, res) => {
  const { channel, date } = req.body;
  const settings = await getSettings();
  const c = await Contact.findById(req.params.id);
  const f = trackField(channel);
  if (c[f].length >= trackSteps(settings, channel).length) return res.status(400).json({ error: 'All steps already sent' });
  c[f].push(parseDate(date));
  await c.save();
  res.json(decorate(c, settings));
}));

// edit date of an already-sent step
router.patch('/contacts/:id/sent', wrap(async (req, res) => {
  const { channel, index, date } = req.body;
  const settings = await getSettings();
  const c = await Contact.findById(req.params.id);
  const f = trackField(channel);
  if (index < 0 || index >= c[f].length) return res.status(400).json({ error: 'Step not sent yet' });
  c[f].set(index, parseDate(date));
  await c.save();
  res.json(decorate(c, settings));
}));

// undo last sent step
router.delete('/contacts/:id/sent', wrap(async (req, res) => {
  const settings = await getSettings();
  const c = await Contact.findById(req.params.id);
  c[trackField(req.query.channel)].pop();
  await c.save();
  res.json(decorate(c, settings));
}));

// reply / handle personally / resume
router.post('/contacts/:id/status', wrap(async (req, res) => {
  const { status, note } = req.body;
  const settings = await getSettings();
  const c = await Contact.findById(req.params.id);
  c.status = status;
  if (note !== undefined) c.replyNote = note;
  c.repliedAt = status === 'active' ? undefined : c.repliedAt || new Date();
  await c.save();
  res.json(decorate(c, settings));
}));

// ---------- today ----------
async function buildToday(settings) {
  const colleges = await College.find().lean();
  const cname = Object.fromEntries(colleges.map((c) => [String(c._id), c.name]));
  const contacts = await Contact.find({ status: 'active' }).lean();
  const items = [];
  for (const raw of contacts) {
    const c = decorate(raw, settings);
    for (const [channel, cells, steps] of [
      ['email', c.emailCells, settings.emailSteps],
      ['linkedin', c.linkedinCells, settings.linkedinSteps],
    ]) {
      const i = cells.findIndex((x) => x.state === 'due' || x.state === 'overdue');
      if (i === -1) continue;
      items.push({
        contactId: c._id, college: cname[String(c.collegeId)] || '?', role: c.role, name: c.name,
        email: c.email, linkedinUrl: c.linkedinUrl, channel, stepIndex: i, stepLabel: steps[i].label,
        state: cells[i].state, daysLate: cells[i].days || 0, isFirst: i === 0,
      });
    }
  }
  // most overdue first, then follow-ups before fresh first touches
  items.sort((a, b) => b.daysLate - a.daysLate || Number(a.isFirst) - Number(b.isFirst) || a.college.localeCompare(b.college));
  return items;
}

router.get('/today', wrap(async (req, res) => res.json(await buildToday(await getSettings()))));

// one structured prompt for Claude Desktop (Gmail) covering every email due today
router.post('/prompt/emails', wrap(async (req, res) => {
  const settings = await getSettings();
  const { ready, ...out } = buildEmailPrompt(await buildToday(settings), settings.emailSteps);
  res.json(out);
}));

// Claude's strict sent-report -> preview (apply:false) or mark sent (apply:true). Only "sent" entries that match a
// task still due today are marked; everything else stays pending.
const norm = (s) => String(s || '').trim().toLowerCase();
router.post('/prompt/report', wrap(async (req, res) => {
  const { report, apply } = req.body || {};
  if (!Array.isArray(report)) return res.status(400).json({ error: 'Report ka format galat hai (report array chahiye)' });
  const settings = await getSettings();
  const { ready } = buildEmailPrompt(await buildToday(settings), settings.emailSteps);
  const pool = [...ready]; // due email tasks that were in the prompt; each can be claimed once
  const out = { willMark: [], failed: [], unmatched: [], missing: [], marked: 0 };
  const label = (t) => ({ email: t.email, step: t.stepLabel, college: t.college.replace('[DEMO] ', ''), name: t.name });

  for (const e of report) {
    const idx = pool.findIndex((t) => norm(t.email) === norm(e && e.email) && norm(t.stepLabel) === norm(e && e.step));
    if (idx === -1) { out.unmatched.push({ email: e && e.email, step: e && e.step, status: e && e.status }); continue; }
    const t = pool.splice(idx, 1)[0];
    if (norm(e.status) === 'sent') out.willMark.push({ ...label(t), contactId: t.contactId, stepIndex: t.stepIndex });
    else out.failed.push({ ...label(t), note: String(e.note || '') });
  }
  out.missing = pool.map(label); // in the prompt but not in the report -> stay pending

  if (apply) {
    for (const w of out.willMark) {
      const c = await Contact.findById(w.contactId);
      // still the same next step? (guards against double-marking on re-apply)
      if (!c || c.status !== 'active' || c.emailSent.length !== w.stepIndex) continue;
      c.emailSent.push(new Date());
      await c.save();
      out.marked++;
    }
  }
  out.willMark = out.willMark.map(({ contactId, stepIndex, ...rest }) => rest);
  res.json(out);
}));

// ---------- replied list ----------
router.get('/replied', wrap(async (req, res) => {
  const colleges = await College.find().lean();
  const cname = Object.fromEntries(colleges.map((c) => [String(c._id), c.name]));
  const contacts = await Contact.find({ status: { $ne: 'active' } }).sort({ repliedAt: -1 }).lean();
  res.json(contacts.map((c) => ({ ...c, college: cname[String(c.collegeId)] || '?' })));
}));

// ---------- bulk import ----------
// rows: [{college, role, name, email, linkedin}]
router.post('/import', wrap(async (req, res) => {
  const rows = req.body.rows || [];
  const cache = {};
  let colleges = 0, contacts = 0;
  for (const r of rows) {
    const cn = (r.college || '').trim();
    if (!cn) continue;
    if (!cache[cn.toLowerCase()]) {
      let col = await College.findOne({ name: new RegExp(`^${cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      if (!col) { col = await College.create({ name: cn }); colleges++; }
      cache[cn.toLowerCase()] = col;
    }
    await Contact.create({
      collegeId: cache[cn.toLowerCase()]._id, role: r.role || '', name: r.name || '',
      email: r.email || '', linkedinUrl: r.linkedin || '',
    });
    contacts++;
  }
  res.json({ colleges, contacts });
}));

// ---------- search (email / linkedin / name / college / role) ----------
const normLink = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
const summarize = (cells, steps) => {
  const i = cells.findIndex((c) => ['due', 'overdue', 'wait'].includes(c.state));
  if (i === -1) return cells[0] && cells[0].state === 'stopped' ? 'Ruka hua' : 'Sab step ho gaye ✓';
  const c = cells[i];
  const when = c.state === 'overdue' ? `${c.days} din late` : c.state === 'due' ? 'aaj bhejna hai' : `${c.days} din baad`;
  return `${steps[i].label} — ${when}`;
};

router.get('/search', wrap(async (req, res) => {
  let q = String(req.query.q || '').trim().toLowerCase();
  const found = q.match(/[^\s<>"',;]+@[^\s<>"',;]+/); // "Name <a@b.com>" -> a@b.com
  if (found) q = found[0];
  if (q.length < 2) return res.json([]);
  const ql = normLink(q);
  const settings = await getSettings();
  const colleges = await College.find().lean();
  const cname = Object.fromEntries(colleges.map((c) => [String(c._id), c.name]));
  const contacts = await Contact.find().lean();
  const hits = contacts.filter((c) =>
    [c.name, c.email, c.role, cname[String(c.collegeId)]].some((v) => String(v || '').toLowerCase().includes(q)) ||
    normLink(c.linkedinUrl).includes(ql));
  res.json(hits.slice(0, 15).map((raw) => {
    const c = decorate(raw, settings);
    return {
      _id: c._id, name: c.name, role: c.role, email: c.email, linkedinUrl: c.linkedinUrl, status: c.status,
      replyNote: c.replyNote, college: cname[String(c.collegeId)] || '?',
      emailSummary: summarize(c.emailCells, settings.emailSteps),
      linkedinSummary: summarize(c.linkedinCells, settings.linkedinSteps),
    };
  }));
}));

module.exports = router;
