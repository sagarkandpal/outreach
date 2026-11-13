// Remove steps that were recorded twice by one click (double click / two requests at once, before the server checked the step).
// A step saved less than a minute after the previous one is that duplicate; the person only got one message.
// Usage: node scripts/fix-double-sent.js          -> dry run (prints what would change)
//        node scripts/fix-double-sent.js --apply  -> backs up the touched contacts to backups/, then fixes them
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { College, Contact } = require('../server/models');

const apply = process.argv.includes('--apply');
const GAP = 60 * 1000;

const dedupe = (dates) => dates.filter((d, i) => i === 0 || new Date(d) - new Date(dates[i - 1]) >= GAP);

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME || 'botza_outreach' });
  const orgs = Object.fromEntries((await College.find().lean()).map((o) => [String(o._id), o]));
  const fixes = [];
  for (const c of await Contact.find().lean()) {
    const set = {};
    for (const f of ['emailSent', 'linkedinSent']) {
      const clean = dedupe(c[f] || []);
      if (clean.length !== (c[f] || []).length) set[f] = clean;
    }
    if (Object.keys(set).length) fixes.push({ c, set });
  }

  for (const { c, set } of fixes) {
    const o = orgs[String(c.collegeId)] || {};
    const parts = Object.keys(set).map((f) => `${f === 'emailSent' ? 'Email' : 'LinkedIn'} ${c[f].length} -> ${set[f].length}`);
    console.log(`  ${o.segment}/${o.owner || '-'}  ${c.name || c.role}  (${o.name})  ${parts.join(', ')}${c.linkedinConnectedAt ? '' : '  [not connected]'}`);
  }
  console.log(`\n${fixes.length} contacts ${apply ? 'fixing' : 'would be fixed (dry run, add --apply)'}`);

  if (apply && fixes.length) {
    const file = path.join(__dirname, '..', 'backups', `double-sent-before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(fixes.map(({ c }) => ({ _id: c._id, name: c.name, emailSent: c.emailSent, linkedinSent: c.linkedinSent })), null, 2));
    console.log(`Backup: ${file}`);
    let n = 0;
    for (const { c, set } of fixes) {
      // only if nobody changed this contact since it was read
      const r = await Contact.updateOne({ _id: c._id, emailSent: c.emailSent, linkedinSent: c.linkedinSent }, { $set: set });
      n += r.modifiedCount;
    }
    console.log(`Fixed ${n}/${fixes.length}`);
  }
  await mongoose.disconnect();
})();
