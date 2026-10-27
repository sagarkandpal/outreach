// Overwrite a segment's saved drafts with the ones in server/startup-drafts.js.
// Keeps each step's gapDays, and the attachment name + link already saved in Settings for steps that still use an attachment.
// Usage: node scripts/update-startup-drafts.js <segment>          -> dry run (prints what would change)
//        node scripts/update-startup-drafts.js <segment> --apply  -> actually save
// <segment> = college | startups (the slug as saved in the DB)
require('dotenv').config();
const mongoose = require('mongoose');
const { Settings, settingsKey } = require('../server/models');
const drafts = require('../server/startup-drafts');

const apply = process.argv.includes('--apply');
const slug = process.argv.slice(2).find((a) => !a.startsWith('--'));
const SOURCES = {
  college: { email: drafts.collegeEmailSteps, linkedin: drafts.collegeLinkedinSteps },
  startups: { email: drafts.emailSteps, linkedin: drafts.linkedinSteps },
};

function merge(saved, wanted, withAttachment) {
  return wanted.map((w, i) => {
    const old = (saved && saved[i]) || {};
    const step = { label: w.label, gapDays: old.gapDays != null ? old.gapDays : w.gapDays, draft: w.draft };
    if (withAttachment) {
      // drafts say "I've attached ...", so the file is attached by hand: a saved link would hide the "attach" note, drop it (printed below)
      step.attachment = w.attachment ? old.attachment || w.attachment : '';
      step.attachmentUrl = '';
      if (old.attachmentUrl) console.log(`  cleared saved link of "${w.label}": ${old.attachmentUrl}`);
    }
    return step;
  });
}

(async () => {
  const src = SOURCES[slug];
  if (!src) { console.log('Usage: node scripts/update-startup-drafts.js <college|startups> [--apply]'); return; }
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME || 'botza_outreach' });
  const s = await Settings.findOne({ key: settingsKey(slug) });
  if (!s) { console.log(`No saved settings for "${slug}": the defaults in startup-drafts.js apply already.`); return; }

  const emailSteps = merge(s.emailSteps, src.email, true);
  const linkedinSteps = merge(s.linkedinSteps, src.linkedin, false);

  const report = (channel, oldSteps, newSteps) => newSteps.forEach((n, i) => {
    const o = oldSteps[i];
    console.log(`  ${channel} ${n.label}: ${o && o.draft === n.draft ? 'unchanged' : o ? 'draft replaced' : 'new step'}${n.attachment ? ` | attach by hand: "${n.attachment}"` : ''}`);
  });
  report('email   ', s.emailSteps, emailSteps);
  report('linkedin', s.linkedinSteps, linkedinSteps);
  if (s.emailSteps.length > emailSteps.length) console.log(`  note: ${s.emailSteps.length - emailSteps.length} extra saved email step(s) will be dropped`);

  if (apply) {
    s.emailSteps = emailSteps;
    s.linkedinSteps = linkedinSteps;
    await s.save();
    console.log('Saved.');
  } else {
    console.log('Dry run, nothing saved. Re-run with --apply.');
  }
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => mongoose.disconnect());
