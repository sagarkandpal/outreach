// Contacts imported with only a first name ("Aman") get the surname from their LinkedIn link
// (linkedin.com/in/aman-jain-83785979 -> "Aman Jain"). Only the name field changes; nothing is deleted.
// Usage: node scripts/fill-surnames.js                    -> dry run (prints what would change)
//        node scripts/fill-surnames.js --apply            -> saves old names to backups/, then updates
//        node scripts/fill-surnames.js --restore <file>   -> puts the old names from a backup file back
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Contact } = require('../server/models');

const apply = process.argv.includes('--apply');
const restoreFile = process.argv[process.argv.indexOf('--restore') + 1];

// same rules as fullName() in public/app.js
const MIDDLE = /^(.|singh|kumar|pratap|pal|raj|kaur|prasad|chandra|nath|lal|sundar|madhur|mohan|kant|dev)$/i;
const NOT_SURNAME = /^(it|iit|iim|ceo|cto|founder|official|hr|ca|mba|phd|befikr|gemini|fraganote)$/i; // slug words that are a title or company, not a surname
const liHandle = (u) => { try { const m = String(u || '').match(/linkedin\.com\/in\/([^/?#]+)/i); return m ? decodeURIComponent(m[1]) : ''; } catch { return ''; } };
const fullName = (name, url) => {
  const n = String(name || '').trim();
  if (!n || /\s/.test(n)) return n;
  const parts = liHandle(url).split('-').filter((p) => /^\p{L}+$/u.test(p));
  if (parts.length < 2 || parts[0].toLowerCase() !== n.toLowerCase() || NOT_SURNAME.test(parts[1])) return n;
  // a third word only after a middle name ("amit-kumar-gupta"); otherwise it is usually a company or title ("anil-ambati-managing-director")
  return parts.slice(0, parts.length > 2 && MIDDLE.test(parts[1]) ? 3 : 2).map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase()).join(' ');
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  if (process.argv.includes('--restore')) {
    const rows = JSON.parse(fs.readFileSync(restoreFile, 'utf8'));
    let n = 0;
    // only rows still carrying the name this script set, so later manual edits are kept
    for (const r of rows) n += (await Contact.updateOne({ _id: r._id, name: r.newName }, { $set: { name: r.oldName } }, { timestamps: false })).modifiedCount;
    console.log(`restored ${n} of ${rows.length} names`);
    return mongoose.disconnect();
  }

  const contacts = await Contact.find({}, 'name linkedinUrl').lean();
  const changes = contacts
    .map((c) => ({ _id: String(c._id), oldName: c.name, newName: fullName(c.name, c.linkedinUrl), linkedinUrl: c.linkedinUrl }))
    .filter((c) => c.newName && c.newName !== String(c.oldName || '').trim());
  changes.forEach((c) => console.log(`${c.oldName} -> ${c.newName}   (${c.linkedinUrl})`));
  console.log(`\n${changes.length} of ${contacts.length} contacts ${apply ? 'to update' : 'would change (dry run, add --apply)'}`);

  if (apply && changes.length) {
    const dir = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `contact-names-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(changes, null, 2));
    console.log(`backup: ${file}`);
    let n = 0;
    for (const c of changes) n += (await Contact.updateOne({ _id: c._id, name: c.oldName }, { $set: { name: c.newName } }, { timestamps: false })).modifiedCount;
    console.log(`updated ${n}`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
