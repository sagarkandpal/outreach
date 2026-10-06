const mongoose = require('mongoose');

const stepSchema = new mongoose.Schema(
  {
    label: String, gapDays: { type: Number, default: 2 }, draft: { type: String, default: '' },
    // email only: non-empty = this step needs a manual attachment, so Claude only creates a Gmail draft
    attachment: { type: String, default: '' },
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  emailSteps: [stepSchema],
  linkedinSteps: [stepSchema],
  roles: [String],
});

const collegeSchema = new mongoose.Schema(
  { name: { type: String, required: true, trim: true }, city: String, notes: String },
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
    replyNote: { type: String, default: '' },
    repliedAt: Date,
  },
  { timestamps: true }
);

const DEFAULT_SETTINGS = {
  key: 'main',
  emailSteps: [
    { label: 'Primary Email', gapDays: 0 },
    ...[1, 2, 3, 4, 5].map((n) => ({ label: `Follow-up ${n}`, gapDays: 2 })),
  ],
  linkedinSteps: [
    { label: 'Connection Note', gapDays: 0 },
  ],
  roles: ['Dean', 'Head', 'Manager', 'Vice'],
};

const Settings = mongoose.model('Settings', settingsSchema);

async function getSettings() {
  let s = await Settings.findOne({ key: 'main' });
  if (!s) s = await Settings.create(DEFAULT_SETTINGS);
  // LinkedIn is connection-note only: drop any stored follow-up steps
  if (s.linkedinSteps.length > 1) { s.linkedinSteps = s.linkedinSteps.slice(0, 1); await s.save(); }
  return s;
}

module.exports = {
  Settings,
  getSettings,
  College: mongoose.model('College', collegeSchema),
  Contact: mongoose.model('Contact', contactSchema),
};
