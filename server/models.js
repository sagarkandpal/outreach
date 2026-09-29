const mongoose = require('mongoose');

const stepSchema = new mongoose.Schema(
  { label: String, gapDays: { type: Number, default: 2 } },
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
    { label: 'Follow-up 1', gapDays: 2 },
    { label: 'Follow-up 2', gapDays: 2 },
  ],
  roles: ['Dean', 'Head', 'Manager', 'Vice'],
};

const Settings = mongoose.model('Settings', settingsSchema);

async function getSettings() {
  let s = await Settings.findOne({ key: 'main' });
  if (!s) s = await Settings.create(DEFAULT_SETTINGS);
  return s;
}

module.exports = {
  Settings,
  getSettings,
  College: mongoose.model('College', collegeSchema),
  Contact: mongoose.model('Contact', contactSchema),
};
