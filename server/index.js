const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const routes = require('./routes');
const { getSettings } = require('./models');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/botza_outreach';

const app = express();
app.use(express.json());
app.use('/api', routes);
app.use(express.static(path.join(__dirname, '..', 'public')));

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    await getSettings(); // creates default settings on first run
    app.listen(PORT, () => console.log(`Botza tracker running: http://localhost:${PORT}`));
  })
  .catch((e) => {
    console.error('MongoDB connect failed:', e.message);
    process.exit(1);
  });
