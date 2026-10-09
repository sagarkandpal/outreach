const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const routes = require('./routes');
const { getSettings, ensureSegments, College, Contact } = require('./models');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/botza_outreach';
// Always use this DB name, whatever the URI says (Atlas strings often have no DB name -> "test")
const DB_NAME = process.env.DB_NAME || 'botza_outreach';

const app = express();
app.use(express.json());
app.use('/api', routes);

// Shows which database this copy of the app is really talking to
app.get('/api/health', async (req, res) => {
  const c = mongoose.connection;
  res.json({
    db: c.name,
    host: c.host,
    cloud: !!process.env.MONGO_URI,
    colleges: await College.countDocuments(),
    contacts: await Contact.countDocuments(),
  });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

if (!process.env.MONGO_URI) {
  console.warn('\n!! WARNING: MONGO_URI not found (.env missing or empty). Using LOCAL MongoDB, so you will NOT see shared data.');
  console.warn('!! Copy .env.example to .env and paste the shared connection string.\n');
}

mongoose
  .connect(MONGO_URI, { dbName: DB_NAME })
  .then(async () => {
    await ensureSegments(); // built-in segments (Colleges, Startups) + tag old colleges
    await getSettings('college'); // creates default settings on first run
    await getSettings('startup');
    const c = mongoose.connection;
    console.log(`Connected to DB "${c.name}" on ${c.host}  (${process.env.MONGO_URI ? 'cloud/.env' : 'LOCAL'})`);
    app.listen(PORT, () => console.log(`Botza tracker running: http://localhost:${PORT}`));
  })
  .catch((e) => {
    console.error('MongoDB connect failed:', e.message);
    process.exit(1);
  });
