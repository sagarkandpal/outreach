// Remove duplicate colleges/contacts (e.g. from repeated bulk imports).
// Usage: node scripts/dedupe.js          -> dry run (prints what would be removed)
//        node scripts/dedupe.js --apply  -> actually delete
require('dotenv').config();
const mongoose = require('mongoose');
const { College, Contact } = require('../server/models');

const apply = process.argv.includes('--apply');
const norm = (s) => String(s || '').trim().toLowerCase();
const normLink = (u) => norm(u).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');

// how much progress a record carries; the most-progressed copy is kept
const progress = (c) => (c.emailSent || []).length + (c.linkedinSent || []).length + (c.status !== 'active' ? 100 : 0) + (c.replyNote ? 1 : 0);

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  // 1. colleges with the same name -> merge into the oldest, repoint contacts
  const colleges = await College.find().sort({ createdAt: 1 });
  const keepCol = {};
  const dupCols = [];
  for (const c of colleges) {
    const k = norm(c.name);
    if (!keepCol[k]) keepCol[k] = c;
    else dupCols.push({ dup: c, keep: keepCol[k] });
  }
  console.log(`Duplicate colleges: ${dupCols.length}`);
  for (const { dup, keep } of dupCols) {
    console.log(`  merge "${dup.name}" (${dup._id}) -> ${keep._id}`);
    if (apply) {
      await Contact.updateMany({ collegeId: dup._id }, { collegeId: keep._id });
      await College.findByIdAndDelete(dup._id);
    }
  }

  // 2. contacts: same college + same email / linkedin / (name+role)
  const contacts = await Contact.find().sort({ createdAt: 1 });
  const groups = {};
  for (const c of contacts) {
    let col = String(c.collegeId);
    const mapped = dupCols.find((d) => String(d.dup._id) === col);
    if (mapped) col = String(mapped.keep._id);
    const id = norm(c.email) ? `e:${norm(c.email)}` : normLink(c.linkedinUrl) ? `l:${normLink(c.linkedinUrl)}` : `n:${norm(c.name)}|${norm(c.role)}`;
    if (id === 'n:|') continue; // empty row, leave alone
    (groups[`${col}|${id}`] ||= []).push(c);
  }

  let removed = 0;
  for (const [key, list] of Object.entries(groups)) {
    if (list.length < 2) continue;
    const keep = list.reduce((best, c) => (progress(c) > progress(best) ? c : best), list[0]);
    const drop = list.filter((c) => c !== keep);
    console.log(`  ${keep.name || keep.email || keep.linkedinUrl} [${keep.role}] x${list.length} -> keeping ${keep._id}, removing ${drop.length}`);
    removed += drop.length;
    if (apply) await Contact.deleteMany({ _id: { $in: drop.map((d) => d._id) } });
  }

  console.log(`\nTotal contacts ${contacts.length}; duplicates ${apply ? 'removed' : 'to remove'}: ${removed}`);
  if (!apply) console.log('Dry run only. Re-run with --apply to delete.');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
