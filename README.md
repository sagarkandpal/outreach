# Botza Outreach Tracker

## Setup
    npm install
    copy .env.example .env      (then paste the shared MongoDB Atlas connection string into .env)
    npm start

Open http://localhost:3000

Without a `.env`, the app falls back to a local MongoDB at `mongodb://127.0.0.1:27017/botza_outreach`.
Everyone who uses the same `MONGO_URI` sees the same data. Never commit `.env`.

## Troubleshooting (data alag dikh raha hai?)
Server start hote hi terminal me ye line aani chahiye:

    Connected to DB "botza_outreach" on <cluster-host>  (cloud/.env)

- `LOCAL` likha aaye ya WARNING aaye -> `.env` nahi mili. `.env.example` ko copy karke `.env` banao aur MONGO_URI paste karo.
- Page ke sabse neeche `DB: ... · N colleges, N contacts` dikhta hai. Dono logon ka same hona chahiye.
