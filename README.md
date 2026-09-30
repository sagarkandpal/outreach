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

## Prompt for all emails (Aaj ka kaam)
1. Settings tab -> "Email drafts": har step (Primary, Follow-up 1, 2...) ka ready draft paste karo. Placeholders: `{first_name}`, `{college}`. Pehli line `Subject: ...` ho sakti hai.
2. Aaj ka kaam -> **✨ Prompt for all emails** -> Copy -> Gmail-connected Claude Desktop me paste.
3. Claude ke aakhri message ka `json` report block "Claude ka report paste karo" box mein paste karo -> **Check karo** -> **✓ mark karo**. Sirf jo `sent` hain wahi mark hote hain; failed / report me nahi aaye wale pending rehte hain.

## LinkedIn drafts
Settings -> "LinkedIn drafts" me har step ka message paste karo. Aaj ka kaam me LinkedIn task par step ke aage **📋** dabao -> draft (naam/college bhara hua) copy ho jayega. Bhejne ke baad **✓ Bhej diya** khud dabana.

## PDF se drafts import (Settings)
1. Settings -> "PDF / document se drafts import karo" -> **Claude ke liye prompt copy karo**.
2. Claude me apna PDF attach karke wo prompt paste karo. Claude drafts ko `### EMAIL | Primary Email` / `### LINKEDIN | Follow-up 1` jaisi headings me restructure karega.
3. Claude ka output (text paste, ya .txt / PDF upload) -> **Drafts bharo** -> boxes me check/edit -> **Save**.
(PDF padhne ke liye pdf.js internet se load hota hai; na chale to text paste karo.)
