const mongoose = require('mongoose');
const startup = require('./startup-drafts');

const stepSchema = new mongoose.Schema(
  {
    label: String, gapDays: { type: Number, default: 2 }, draft: { type: String, default: '' },
    // email only: non-empty = this step needs a manual attachment, so Claude only creates a Gmail draft
    attachment: { type: String, default: '' },
  },
  { _id: false }
);

// A segment = one audience (Colleges, Startups, ...) with its own organisations, contacts and drafts.
// `unit` is what one organisation is called in the UI (College / Company ...).
const segmentSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    unit: { type: String, default: 'Company' },
    unitPlural: { type: String, default: 'Companies' },
    linkedinMax: { type: Number, default: 3 }, // college = connection note only
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  emailSteps: [stepSchema],
  linkedinSteps: [stepSchema],
  roles: [String],
});

const collegeSchema = new mongoose.Schema(
  { name: { type: String, required: true, trim: true }, city: String, notes: String,
    website: { type: String, default: '' }, // site Botza is shown on in the demo link
    demoUrl: { type: String, default: '' }, // generated preview link (cached; cleared when website changes)
    segment: { type: String, default: 'college', index: true }, owner: { type: String, enum: ['', 'arjun', 'sagar'], default: '' } },
  { timestamps: true }
);

const contactSchema = new mongoose.Schema(
  {
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true, index: true },
    role: { type: String, default: '' },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    linkedinUrl: { type: String, default: '' },
    status: { type: String, enum: ['active', 'replied', 'handling_personally', 'done'], default: 'active' },
    // dates of steps already sent, in order (index = step index)
    emailSent: { type: [Date], default: [] },
    linkedinSent: { type: [Date], default: [] },
    // startups: when the connection request was accepted (follow-ups start after this)
    linkedinConnectedAt: Date,
    replyNote: { type: String, default: '' },
    repliedAt: Date,
  },
  { timestamps: true }
);

const genericSteps = (n) => [{ label: 'Primary Email', gapDays: 0 }, ...Array.from({ length: n }, (_, i) => ({ label: `Follow-up ${i + 1}`, gapDays: 2 }))];

const DEFAULT_SEGMENTS = [
  { slug: 'college', name: 'Colleges', unit: 'College', unitPlural: 'Colleges', linkedinMax: 1, order: 0 },
  { slug: 'startup', name: 'Startups', unit: 'Company', unitPlural: 'Companies', linkedinMax: 3, order: 1 },
];

// the original college settings keep key 'main' so existing data keeps working
const settingsKey = (slug) => (slug === 'college' ? 'main' : `seg:${slug}`);

function defaultSettings(slug) {
  const key = settingsKey(slug);
  if (slug === 'college') {
    return { key, emailSteps: genericSteps(5), linkedinSteps: [{ label: 'Connection Note', gapDays: 0 }], roles: ['Dean', 'Head', 'Manager', 'Vice'] };
  }
  if (slug === 'startup') {
    return { key, emailSteps: startup.emailSteps, linkedinSteps: startup.linkedinSteps, roles: ['Founder', 'CEO', 'CTO', 'COO', 'Head of HR'] };
  }
  return { key, emailSteps: genericSteps(5), linkedinSteps: [{ label: 'Connection Note', gapDays: 0 }], roles: [] };
}

const Settings = mongoose.model('Settings', settingsSchema);
const Segment = mongoose.model('Segment', segmentSchema);
const College = mongoose.model('College', collegeSchema);

// first run: create the built-in segments and tag pre-existing colleges as 'college'
// built-in segments the user deleted on purpose: ensureSegments must not bring them back on the next start
const Removed = mongoose.model('RemovedSegment', new mongoose.Schema({ slug: { type: String, required: true, unique: true } }, { timestamps: true }));
// only Colleges is permanent: the app falls back to it when no segment is given
const PROTECTED_SEGMENTS = ['college'];

async function ensureSegments() {
  const gone = new Set((await Removed.find().lean()).map((r) => r.slug));
  for (const seg of DEFAULT_SEGMENTS) {
    if (!gone.has(seg.slug)) await Segment.updateOne({ slug: seg.slug }, { $setOnInsert: seg }, { upsert: true });
  }
  await College.updateMany({ segment: { $exists: false } }, { $set: { segment: 'college' } });
}

async function getSegment(slug) {
  return Segment.findOne({ slug: slug || 'college' }).lean();
}

async function getSettings(slug = 'college') {
  const seg = await getSegment(slug);
  const max = seg ? seg.linkedinMax : 1;
  let s = await Settings.findOne({ key: settingsKey(slug) });
  if (!s) s = await Settings.create(defaultSettings(slug));
  // LinkedIn step limit is per segment (college = connection note only)
  if (s.linkedinSteps.length > max) { s.linkedinSteps = s.linkedinSteps.slice(0, max); await s.save(); }
  return s;
}

// organisations that were reached out to and later deleted from "Poora ho gaya"; the History tab keeps them
const historySchema = new mongoose.Schema(
  {
    segment: { type: String, required: true },
    key: { type: String, required: true }, // lower-cased organisation name
    name: String,
    city: { type: String, default: '' },
    owner: { type: String, default: '' },
    contactsReached: { type: Number, default: 0 }, // deleted contacts that had at least one message sent
    firstSentAt: Date,
    lastSentAt: Date,
  },
  { timestamps: true }
);
historySchema.index({ segment: 1, key: 1 }, { unique: true });

module.exports = {
  settingsKey,
  PROTECTED_SEGMENTS,
  DEFAULT_SEGMENT_SLUGS: DEFAULT_SEGMENTS.map((s) => s.slug),
  Removed,
  History: mongoose.model('History', historySchema),
  Settings,
  Segment,
  getSettings,
  getSegment,
  ensureSegments,
  College,
  Contact: mongoose.model('Contact', contactSchema),
};
