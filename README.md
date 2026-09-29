# Botza Outreach Tracker

## Setup
    npm install
    copy .env.example .env      (then paste the shared MongoDB Atlas connection string into .env)
    npm start

Open http://localhost:3000

Without a `.env`, the app falls back to a local MongoDB at `mongodb://127.0.0.1:27017/botza_outreach`.
Everyone who uses the same `MONGO_URI` sees the same data. Never commit `.env`.
