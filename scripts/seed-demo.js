// Fills the LOCAL "botza_demo" database with email-only demo data (attachment steps pre-set).
// Run:  node scripts/seed-demo.js   (never touches the shared Atlas DB)
const mongoose = require('mongoose');
const { Settings, College, Contact } = require('../server/models');

const URI = 'mongodb://127.0.0.1:27017';
const DB = 'botza_demo';

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(12, 0, 0, 0); return d; };

const drafts = [
  'Subject: Quick intro from Botza\n\nHi {first_name},\n\nI am reaching out to {college} to share how Botza can help your team.\n\nRegards,\n{sender_name}',
  'Subject: Demo video for {college}\n\nHi {first_name},\n\nFollowing up on my last note. I have attached a short demo video showing Botza in action.\n\nRegards,\n{sender_name}',
  'Subject: Case study you may like\n\nHi {first_name},\n\nSharing a short case study PDF from a similar college. Happy to walk you through it.\n\nRegards,\n{sender_name}',
  'Subject: Checking in\n\nHi {first_name},\n\nJust checking if you had a chance to look at my earlier emails.\n\nRegards,\n{sender_name}',
];

const emailSteps = [
  { label: 'Primary Email', gapDays: 0, draft: drafts[0], attachment: '' },
  { label: 'Follow-up 1', gapDays: 2, draft: drafts[1], attachment: 'Demo video' },
  { label: 'Follow-up 2', gapDays: 2, draft: drafts[2], attachment: 'Case study PDF' },
  { label: 'Follow-up 3', gapDays: 2, draft: drafts[3], attachment: '' },
];
const linkedinSteps = [{ label: 'Connection Note', gapDays: 0 }, { label: 'Follow-up 1', gapDays: 2 }];

// sentAgo: days ago each email step was sent (oldest first); [] = nothing sent yet
const data = [
  ['[DEMO] IIT Demo', 'Mumbai', [
    ['Dean', 'Dr. Anita Sharma', 'anita.sharma@demo-iit.edu', []],            // Primary due (plain send)
    ['Head', 'Prof. Rajesh Iyer', 'rajesh.iyer@demo-iit.edu', [3]],           // Follow-up 1 due (demo video)
  ]],
  ['[DEMO] NIT Demo', 'Pune', [
    ['Principal', 'Dr. Suresh Patil', 'suresh.patil@demo-nit.edu', [7, 5]],   // Follow-up 2 due (case study)
    ['Placement Officer', 'Neha Kulkarni', 'neha.kulkarni@demo-nit.edu', []], // Primary due
  ]],
  ['[DEMO] BITS Demo', 'Goa', [
    ['Manager', 'Priya Menon', 'priya.menon@demo-bits.edu', [10, 8, 6]],      // Follow-up 3 due (plain send)
    ['Director', 'Dr. Karan Mehta', 'karan.mehta@demo-bits.edu', [1]],        // waiting, not due yet
  ]],
];

(async () => {
  await mongoose.connect(URI, { dbName: DB });
  if (mongoose.connection.name !== 'botza_demo') throw new Error('Wrong DB, aborting');
  await Promise.all([Settings.deleteMany({}), College.deleteMany({}), Contact.deleteMany({})]);
  await Settings.create({ key: 'main', emailSteps, linkedinSteps, roles: ['Dean', 'Head', 'Manager'] });
  for (const [name, city, people] of data) {
    const col = await College.create({ name, city });
    for (const [role, pname, email, sentAgo] of people) {
      await Contact.create({ collegeId: col._id, role, name: pname, email, emailSent: sentAgo.map(daysAgo) });
    }
  }
  console.log(`Seeded "${DB}": ${data.length} colleges, ${data.flatMap((d) => d[2]).length} contacts`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
