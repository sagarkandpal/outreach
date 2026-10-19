const express = require('express');
const { College, Contact, Segment, History, getSettings, getSegment } = require('./models');
const { decorate } = require('./due');
const { buildEmailPrompt, firstName } = require('./prompt');

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

// ---------- segments ----------
const slugify = (n) => String(n || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

router.get('/segments', wrap(async (req, res) => {
  const segs = await Segment.find().sort({ order: 1, createdAt: 1 }).lean();
  const colleges = await College.find({}, 'segment').lean();
  const segOf = Object.fromEntries(colleges.map((c) => [String(c._id), c.segment || 'college']));
  const contactCount = {};
  for (const c of await Contact.find({}, 'collegeId').lean()) { const k = segOf[String(c.collegeId)]; contactCount[k] = (contactCount[k] || 0) + 1; }
  res.json(segs.map((g) => ({ ...g, orgs: colleges.filter((c) => (c.segment || 'college') === g.slug).length, contacts: contactCount[g.slug] || 0 })));
}));

router.post('/segments', wrap(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const slug = slugify(name);
  if (!slug) return res.status(400).json({ error: 'Segment ka naam likho' });
  if (await Segment.exists({ slug })) return res.status(400).json({ error: 'Is naam ka segment pehle se hai' });
  const unit = String(req.body.unit || '').trim() || 'Company';
  const unitPlural = String(req.body.unitPlural || '').trim() || (/y$/i.test(unit) ? unit.slice(0, -1) + 'ies' : unit + 's');
  const order = await Segment.countDocuments();
  res.json(await Segment.create({ slug, name, unit, unitPlural, order }));
}));

// every request below works inside one segment (header X-Segment, default 'college')
router.use(async (req, res, next) => {
  try {
    const seg = await getSegment(String(req.get('X-Segment') || 'college'));
    if (!seg) return res.status(400).json({ error: 'Segment nahi mila' });
    req.seg = seg;
    next();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// every segment tracks LinkedIn acceptance before follow-ups
const dec = (req, c, settings, now = new Date()) => decorate(c, settings, now, true);
const colFilter = (req) => ({ segment: req.seg.slug });
const segColleges = (req) => College.find(colFilter(req));
// plain (lean) contacts of this segment only
async function segContacts(req, extra = {}, sort = { createdAt: 1 }) {
  const ids = (await College.find(colFilter(req), '_id').lean()).map((c) => c._id);
  return Contact.find({ collegeId: { $in: ids }, ...extra }).sort(sort).lean();
}

// ---------- settings ----------
router.get('/settings', wrap(async (req, res) => res.json(await getSettings(req.seg.slug))));

router.put('/settings', wrap(async (req, res) => {
  const s = await getSettings(req.seg.slug);
  const { emailSteps, linkedinSteps, roles } = req.body;
  if (emailSteps) s.emailSteps = emailSteps;
  if (linkedinSteps) s.linkedinSteps = linkedinSteps.slice(0, req.seg.linkedinMax);
  if (roles) s.roles = roles;
  await s.save();
  res.json(s);
}));

// ---------- colleges ----------
router.get('/colleges', wrap(async (req, res) => {
  const settings = await getSettings(req.seg.slug);
  const colleges = await segColleges(req).sort({ createdAt: 1 }).lean();
  const contacts = await segContacts(req);
  const byCollege = {};
  contacts.forEach((c) => (byCollege[c.collegeId] ||= []).push(dec(req, c, settings)));
  res.json(colleges.map((c) => ({ ...c, contacts: byCollege[c._id] || [] })));
}));

router.post('/colleges', wrap(async (req, res) => {
  const { name, city, notes, contacts = [] } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: `${req.seg.unit} name required` });
  const college = await College.create({ name, city, notes, segment: req.seg.slug });
  const rows = contacts.filter((c) => c.name || c.email || c.linkedinUrl || c.role);
  if (rows.length) await Contact.insertMany(rows.map((c) => ({ ...c, collegeId: college._id })));
  res.json(college);
}));

router.patch('/colleges/:id', wrap(async (req, res) => {
  const { name, city, notes } = req.body;
  res.json(await College.findByIdAndUpdate(req.params.id, { name, city, notes }, { new: true }));
}));

router.patch('/colleges/:id/owner', wrap(async (req, res) => {
  const owner = String(req.body.owner || '').toLowerCase();
  if (!['', 'arjun', 'sagar'].includes(owner)) return res.status(400).json({ error: 'owner must be arjun, sagar or empty' });
  res.json(await College.findByIdAndUpdate(req.params.id, { owner }, { new: true }));
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
  const settings = await getSettings(req.seg.slug);
  const c = await Contact.findById(req.params.id);
  const f = trackField(channel);
  if (c[f].length >= trackSteps(settings, channel).length) return res.status(400).json({ error: 'All steps already sent' });
  c[f].push(parseDate(date));
  await c.save();
  res.json(dec(req, c, settings));
}));

// edit date of an already-sent step
router.patch('/contacts/:id/sent', wrap(async (req, res) => {
  const { channel, index, date } = req.body;
  const settings = await getSettings(req.seg.slug);
  const c = await Contact.findById(req.params.id);
  const f = trackField(channel);
  if (index < 0 || index >= c[f].length) return res.status(400).json({ error: 'Step not sent yet' });
  c[f].set(index, parseDate(date));
  await c.save();
  res.json(dec(req, c, settings));
}));

// undo last sent step
router.delete('/contacts/:id/sent', wrap(async (req, res) => {
  const settings = await getSettings(req.seg.slug);
  const c = await Contact.findById(req.params.id);
  c[trackField(req.query.channel)].pop();
  await c.save();
  res.json(dec(req, c, settings));
}));

// reply / handle personally / resume
router.post('/contacts/:id/status', wrap(async (req, res) => {
  const { status, note } = req.body;
  const settings = await getSettings(req.seg.slug);
  const c = await Contact.findById(req.params.id);
  c.status = status;
  if (note !== undefined) c.replyNote = note;
  c.repliedAt = status === 'active' ? undefined : c.repliedAt || new Date();
  await c.save();
  res.json(dec(req, c, settings));
}));

// ---------- today ----------
// organisations + active contacts of this segment, loaded once per request
async function loadActive(req) {
  const colleges = await segColleges(req).lean();
  const contacts = await Contact.find({ collegeId: { $in: colleges.map((c) => c._id) }, status: 'active' }).sort({ createdAt: 1 }).lean();
  return { colleges, contacts };
}

async function buildToday(req, settings, onlyChannel, now = new Date(), pre) {
  const { colleges, contacts } = pre || await loadActive(req);
  const cname = Object.fromEntries(colleges.map((c) => [String(c._id), c.name]));
  const cowner = Object.fromEntries(colleges.map((c) => [String(c._id), c.owner || '']));
  const items = [];
  for (const raw of contacts) {
    const c = dec(req, raw, settings, now);
    for (const [channel, cells, steps] of [
      ['email', c.emailCells, settings.emailSteps],
      ['linkedin', c.linkedinCells, settings.linkedinSteps],
    ]) {
      if (onlyChannel && channel !== onlyChannel) continue;
      const i = cells.findIndex((x) => x.state === 'due' || x.state === 'overdue');
      if (i === -1) continue;
      const college = cname[String(c.collegeId)] || '?';
      // ready-to-paste text for channels without a connector (LinkedIn); email goes through the Claude prompt
      const message = channel === 'linkedin'
        ? String(steps[i].draft || '').trim()
            .replace(/\{first_name\}/g, firstName(c.name))
            .replace(/\{college\}/g, college.replace('[DEMO] ', ''))
        : '';
      items.push({
        contactId: c._id, college, owner: cowner[String(c.collegeId)] || '', role: c.role, name: c.name,
        email: c.email, linkedinUrl: c.linkedinUrl, channel, stepIndex: i, stepLabel: steps[i].label,
        state: cells[i].state, daysLate: cells[i].days || 0, isFirst: i === 0, message,
        attachment: channel === 'email' ? String(steps[i].attachment || '').trim() : '',
      });
    }
  }
  // most overdue first, then follow-ups before fresh first touches
  items.sort((a, b) => b.daysLate - a.daysLate || Number(a.isFirst) - Number(b.isFirst) || a.college.localeCompare(b.college));
  return items;
}

// LinkedIn work lives in its own sub-tab, so Today shows email only
router.get('/today', wrap(async (req, res) => res.json(await buildToday(req, await getSettings(req.seg.slug), 'email'))));

// ---------- linkedin tab (startups) ----------
// everything the Email + LinkedIn sub-tabs need, from one load of the segment
async function board(req) {
  const [settings, pre] = await Promise.all([getSettings(req.seg.slug), loadActive(req)]);
  const now = new Date();
  const items = await buildToday(req, settings, undefined, now, pre);
  const li = items.filter((i) => i.channel === 'linkedin');
  const cname = Object.fromEntries(pre.colleges.map((c) => [String(c._id), c.name]));
  const cowner = Object.fromEntries(pre.colleges.map((c) => [String(c._id), c.owner || '']));
  const row = (c) => ({
    contactId: c._id, college: cname[String(c.collegeId)] || '?', owner: cowner[String(c.collegeId)] || '', name: c.name, role: c.role, linkedinUrl: c.linkedinUrl,
  });
  const open = pre.contacts.filter((c) => !c.linkedinConnectedAt && (c.name || c.linkedinUrl));
  const pending = open.filter((c) => c.linkedinSent.length)
    .map((c) => ({ ...row(c), sentAt: c.linkedinSent[0], daysAgo: Math.max(0, Math.round((now - new Date(c.linkedinSent[0])) / 86400000)) }))
    .sort((a, b) => b.daysAgo - a.daysAgo);
  // note not marked sent in the app yet; only reachable through the Accept check search
  const others = open.filter((c) => !c.linkedinSent.length).map(row);
  return {
    notes: li.filter((i) => i.isFirst), followups: li.filter((i) => !i.isFirst), pending, others,
    emailCount: items.filter((i) => i.channel === 'email').length,
  };
}
router.get('/linkedin/today', wrap(async (req, res) => res.json(await board(req))));
// light version for the sub-tab / badge counts
router.get('/today/counts', wrap(async (req, res) => {
  const b = await board(req);
  res.json({ email: b.emailCount, linkedin: b.notes.length + b.followups.length });
}));

// accepted connection request (single, bulk, undo); accepting implies the note was sent, so mark it if it isn't yet
const connectedUpdate = (d) => ({ $set: {
  linkedinConnectedAt: d,
  linkedinSent: { $cond: [{ $gt: [{ $size: { $ifNull: ['$linkedinSent', []] } }, 0] }, '$linkedinSent', [d]] },
} });
router.post('/contacts/connected-bulk', wrap(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const d = parseDate(req.body.date);
  const r = await Contact.updateMany({ _id: { $in: ids } }, [connectedUpdate(d)], { updatePipeline: true });
  res.json({ ok: true, count: r.modifiedCount });
}));
router.post('/contacts/:id/connected', wrap(async (req, res) => {
  const c = await Contact.findByIdAndUpdate(req.params.id, [connectedUpdate(parseDate(req.body.date))], { new: true, updatePipeline: true });
  res.json(dec(req, c, await getSettings(req.seg.slug)));
}));
router.delete('/contacts/:id/connected', wrap(async (req, res) => {
  const c = await Contact.findByIdAndUpdate(req.params.id, { $unset: { linkedinConnectedAt: 1 } }, { new: true });
  res.json(dec(req, c, await getSettings(req.seg.slug)));
}));

// steps marked sent today (latest step per channel) so they can be undone from the Today tab
router.get('/today/done', wrap(async (req, res) => {
  const settings = await getSettings(req.seg.slug);
  const colleges = await segColleges(req).lean();
  const cname = Object.fromEntries(colleges.map((c) => [String(c._id), c.name]));
  const cowner = Object.fromEntries(colleges.map((c) => [String(c._id), c.owner || '']));
  const now = new Date();
  const isToday = (d) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const out = [];
  for (const c of await segContacts(req)) {
    for (const [channel, sent, steps] of [['email', c.emailSent, settings.emailSteps], ['linkedin', c.linkedinSent, settings.linkedinSteps]]) {
      if (!sent || !sent.length || !isToday(new Date(sent[sent.length - 1]))) continue;
      out.push({
        contactId: c._id, college: cname[String(c.collegeId)] || '?', owner: cowner[String(c.collegeId)] || '', name: c.name, role: c.role,
        channel, stepLabel: (steps[sent.length - 1] || {}).label || `Step ${sent.length}`,
      });
    }
  }
  out.sort((a, b) => a.college.localeCompare(b.college));
  res.json(out);
}));

// prompt for Claude Desktop (Gmail) covering the emails due today (optionally for one college)
router.post('/prompt/emails', wrap(async (req, res) => {
  const settings = await getSettings(req.seg.slug);
  const { senderName, college } = req.body || {};
  const items = (await buildToday(req, settings)).filter((i) => !college || i.college === college);
  res.json(buildEmailPrompt(items, settings.emailSteps, senderName));
}));

// ---------- finished list: everyone whose Email or LinkedIn steps are all sent (candidates to delete for good) ----------
router.get('/finished', wrap(async (req, res) => {
  const settings = await getSettings(req.seg.slug);
  const colleges = await segColleges(req).lean();
  const cname = Object.fromEntries(colleges.map((c) => [String(c._id), c.name]));
  const cowner = Object.fromEntries(colleges.map((c) => [String(c._id), c.owner || '']));
  const contacts = await Contact.find({ collegeId: { $in: colleges.map((c) => c._id) } }).sort({ createdAt: 1 }).lean();
  const emailTotal = settings.emailSteps.length, liTotal = settings.linkedinSteps.length;
  const last = (a) => (a && a.length ? a[a.length - 1] : null);
  const out = [];
  for (const c of contacts) {
    const emailDone = emailTotal > 0 && c.emailSent.length >= emailTotal;
    // a segment whose LinkedIn is only a connection note has no follow-up sequence to "finish"
    const liDone = liTotal > 1 && c.linkedinSent.length >= liTotal;
    if (!emailDone && !liDone) continue;
    out.push({
      contactId: c._id, name: c.name, role: c.role, college: cname[String(c.collegeId)] || '?', owner: cowner[String(c.collegeId)] || '',
      status: c.status, emailDone, liDone, emailSent: c.emailSent.length, emailTotal, emailLast: last(c.emailSent),
      liSent: c.linkedinSent.length, liTotal, liLast: last(c.linkedinSent), connected: !!c.linkedinConnectedAt,
    });
  }
  res.json(out);
}));

// delete contacts for good (only ones that belong to this segment)
router.post('/contacts/delete-bulk', wrap(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const orgIds = (await segColleges(req).lean()).map((c) => c._id);
  const doomed = await Contact.find({ _id: { $in: ids }, collegeId: { $in: orgIds } }, 'collegeId emailSent linkedinSent').lean();
  const touched = [...new Set(doomed.map((c) => String(c.collegeId)))];
  // keep a History record of every organisation we reached before its contacts disappear
  const ops = [];
  for (const o of await College.find({ _id: { $in: touched } }).lean()) {
    const mine = doomed.filter((c) => String(c.collegeId) === String(o._id) && (c.emailSent.length || c.linkedinSent.length));
    if (!mine.length) continue;
    const when = mine.flatMap((c) => [...c.emailSent, ...c.linkedinSent]).map((d) => new Date(d).getTime());
    ops.push({ updateOne: {
      filter: { segment: req.seg.slug, key: o.name.trim().toLowerCase() },
      update: {
        $setOnInsert: { name: o.name.trim() },
        $set: { city: o.city || '', owner: o.owner || '' },
        $inc: { contactsReached: mine.length },
        $min: { firstSentAt: new Date(Math.min(...when)) },
        $max: { lastSentAt: new Date(Math.max(...when)) },
      },
      upsert: true,
    } });
  }
  if (ops.length) await History.bulkWrite(ops);
  const r = await Contact.deleteMany({ _id: { $in: doomed.map((c) => c._id) } });
  // an organisation left with no contacts goes too, so no empty cards stay behind
  const stillHas = new Set((await Contact.distinct('collegeId', { collegeId: { $in: touched } })).map(String));
  const empty = touched.filter((id) => !stillHas.has(id));
  if (empty.length) await College.deleteMany({ _id: { $in: empty } });
  res.json({ ok: true, count: r.deletedCount, orgsRemoved: empty.length });
}));

// add organisations to History by hand (ones that were deleted before History existed); names only, no made-up numbers
router.post('/history', wrap(async (req, res) => {
  // items are plain names or { name, city }
  const seen = new Set();
  const rows = (Array.isArray(req.body.names) ? req.body.names : []).map((n) => (typeof n === 'string' ? { name: n } : n || {}))
    .map((n) => ({ name: String(n.name || '').trim(), city: String(n.city || '').trim() }))
    .filter((n) => n.name && !seen.has(n.name.toLowerCase()) && seen.add(n.name.toLowerCase()));
  const live = new Set((await segColleges(req).lean()).map((c) => c.name.trim().toLowerCase()));
  const fresh = rows.filter((n) => !live.has(n.name.toLowerCase()));
  if (fresh.length) {
    await History.bulkWrite(fresh.map(({ name, city }) => ({ updateOne: {
      filter: { segment: req.seg.slug, key: name.toLowerCase() },
      update: { $setOnInsert: { name, city, owner: '', contactsReached: 0 } },
      upsert: true,
    } })));
  }
  res.json({ ok: true, added: fresh.length, skipped: rows.length - fresh.length });
}));

// ---------- history: every organisation reached out to, still in the app or deleted after "Poora ho gaya" ----------
router.get('/history', wrap(async (req, res) => {
  const colleges = await segColleges(req).lean();
  const contacts = await Contact.find({ collegeId: { $in: colleges.map((c) => c._id) } }, 'collegeId emailSent linkedinSent').lean();
  const archived = await History.find({ segment: req.seg.slug }).lean();
  const sentBy = {};
  for (const c of contacts) {
    const d = [...c.emailSent, ...c.linkedinSent].map((x) => new Date(x).getTime());
    if (d.length) (sentBy[c.collegeId] ||= []).push(d);
  }
  const map = new Map();
  const entry = (name, city, owner) => {
    const k = String(name || '').trim().toLowerCase();
    if (!map.has(k)) map.set(k, { name: String(name || '').trim(), city: city || '', owner: owner || '', reached: 0, removed: 0, live: false, first: null, last: null });
    return map.get(k);
  };
  const span = (e, lo, hi) => { e.first = e.first === null ? lo : Math.min(e.first, lo); e.last = e.last === null ? hi : Math.max(e.last, hi); };
  for (const o of colleges) {
    const groups = sentBy[o._id];
    if (!groups) continue;
    const e = entry(o.name, o.city, o.owner);
    e.live = true; e.reached += groups.length;
    const all = groups.flat(); span(e, Math.min(...all), Math.max(...all));
  }
  for (const a of archived) {
    const e = entry(a.name, a.city, a.owner);
    e.removed += a.contactsReached; e.reached += a.contactsReached;
    if (a.firstSentAt) span(e, new Date(a.firstSentAt).getTime(), new Date(a.lastSentAt || a.firstSentAt).getTime());
  }
  res.json([...map.values()].sort((a, b) => (b.last || 0) - (a.last || 0)).map((e) => ({ ...e, first: e.first && new Date(e.first), last: e.last && new Date(e.last) })));
}));

// ---------- replied list ----------
router.get('/replied', wrap(async (req, res) => {
  const colleges = await segColleges(req).lean();
  const cname = Object.fromEntries(colleges.map((c) => [String(c._id), c.name]));
  const contacts = await segContacts(req, { status: { $ne: 'active' } }, { repliedAt: -1 });
  res.json(contacts.map((c) => ({ ...c, college: cname[String(c.collegeId)] || '?' })));
}));

// ---------- bulk import ----------
// rows: [{college, role, name, email, linkedin}]
router.post('/import', wrap(async (req, res) => {
  const rows = req.body.rows || [];
  const cache = {};
  let colleges = 0, contacts = 0, skipped = 0;
  for (const r of rows) {
    const cn = (r.college || '').trim();
    if (!cn) continue;
    if (!cache[cn.toLowerCase()]) {
      let col = await College.findOne({ segment: req.seg.slug, name: new RegExp(`^${cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      if (!col) { col = await College.create({ name: cn, segment: req.seg.slug }); colleges++; }
      cache[cn.toLowerCase()] = col;
    }
    const collegeId = cache[cn.toLowerCase()]._id;
    const email = (r.email || '').trim(), linkedinUrl = (r.linkedin || '').trim();
    const name = (r.name || '').trim(), role = (r.role || '').trim();
    // skip rows already present (same college + email / linkedin / name+role), so re-clicking Import is harmless
    const ci = (v) => new RegExp(`^${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const same = email ? { email: ci(email) } : linkedinUrl ? { linkedinUrl: ci(linkedinUrl) } : { name: ci(name), role: ci(role) };
    if (await Contact.exists({ collegeId, ...same })) { skipped++; continue; }
    await Contact.create({ collegeId, role, name, email, linkedinUrl });
    contacts++;
  }
  res.json({ colleges, contacts, skipped });
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
  const settings = await getSettings(req.seg.slug);
  const colleges = await segColleges(req).lean();
  const cname = Object.fromEntries(colleges.map((c) => [String(c._id), c.name]));
  const contacts = await segContacts(req);
  const hits = contacts.filter((c) =>
    [c.name, c.email, c.role, cname[String(c.collegeId)]].some((v) => String(v || '').toLowerCase().includes(q)) ||
    normLink(c.linkedinUrl).includes(ql));
  res.json(hits.slice(0, 15).map((raw) => {
    const c = dec(req, raw, settings);
    return {
      _id: c._id, name: c.name, role: c.role, email: c.email, linkedinUrl: c.linkedinUrl, status: c.status,
      replyNote: c.replyNote, college: cname[String(c.collegeId)] || '?',
      emailSummary: summarize(c.emailCells, settings.emailSteps),
      linkedinSummary: summarize(c.linkedinCells, settings.linkedinSteps),
    };
  }));
}));

module.exports = router;
