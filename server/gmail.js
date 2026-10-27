const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { applySignature, firstName, SIGNATURES } = require('./prompt');
const { fillDemoLink } = require('./demo');

// Gmail DRAFTS only: the app creates drafts in the owner's Gmail, the owner sends them by hand.
// gmail.compose is the narrowest scope Google offers for drafts; the code below only ever calls drafts.create.
const SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
const OWNERS = ['sagar', 'arjun'];
// refresh tokens stay on this machine (not in the shared database)
const TOKEN_FILE = path.join(__dirname, '..', '.gmail-tokens.json');

const redirectUri = () => process.env.GOOGLE_REDIRECT_URI || `http://localhost:${process.env.PORT || 3000}/api/auth/google/callback`;
const configured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const readTokens = () => { try { return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); } catch { return {}; } };
const writeTokens = (t) => fs.writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2), { mode: 0o600 });

async function googleToken(params) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, ...params }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body.error_description || body.error || `Google ${r.status}`), { code: body.error });
  return body;
}

// access tokens live ~1h; cached per owner in memory
const access = {};
async function accessToken(owner) {
  const acc = readTokens()[owner];
  if (!acc) throw new Error(`${owner} ka Gmail connect nahi hai`);
  if (access[owner] && access[owner].exp > Date.now() + 60000) return access[owner].token;
  try {
    const t = await googleToken({ grant_type: 'refresh_token', refresh_token: acc.refreshToken });
    access[owner] = { token: t.access_token, exp: Date.now() + t.expires_in * 1000 };
    return t.access_token;
  } catch (e) {
    if (e.code === 'invalid_grant') throw new Error(`${owner} ka Gmail access expire ho gaya, dobara connect karo`);
    throw e;
  }
}

// ---------- message rendering ----------
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) => escHtml(s)
  .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, t, u) => `<a href="${u}">${t}</a>`)
  .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, pre, u) => `${pre}<a href="${u}">${u}</a>`);

// plain-text draft (with [text](url) links) -> HTML: blank line = paragraph, "- " lines = list
function toHtml(body) {
  const blocks = body.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const html = blocks.map((b) => {
    const lines = b.split('\n');
    if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*•]\s+/, ''))}</li>`).join('')}</ul>`;
    return `<p>${lines.map(inline).join('<br>')}</p>`;
  }).join('\n');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">${html}</div>`;
}
const toText = (body) => body.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)');

// one recipient's final subject + body from the step draft
function renderEmail(t, step) {
  const college = t.college.replace('[DEMO] ', '');
  const url = String(step.attachmentUrl || '').trim();
  const linkText = String(step.attachment || '').trim().replace(/[[\]\r\n|]+/g, ' ') || 'Attachment';
  let text = applySignature(String(step.draft || '').trim(), t.owner)
    .replace(/\{sender_name\}/g, () => (SIGNATURES[t.owner] || {}).name || '')
    .replace(/\{first_name\}/g, () => firstName(t.name))
    .replace(/\{(?:college|company)\}/g, () => college)
    .replace(/\{college_website\}/gi, () => t.website || '')
    .replace(/\{attachment_link\}/gi, () => `[${linkText}](${url})`);
  text = fillDemoLink(text, t.demoLink || '');
  let subject = '';
  const m = text.match(/^\s*Subject:[ \t]*(.*)\r?\n?/i);
  if (m) { subject = m[1].trim(); text = text.slice(m[0].length); }
  return { subject: subject || `Botza AI for ${college}`, body: text.trim() };
}

const b64 = (buf) => Buffer.from(buf).toString('base64');
const wrap76 = (s) => s.replace(/(.{76})/g, '$1\r\n');
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function mime({ to, subject, body }) {
  const boundary = `b_${crypto.randomBytes(12).toString('hex')}`;
  const part = (type, content) => `--${boundary}\r\nContent-Type: ${type}; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(content))}\r\n`;
  return [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    part('text/plain', toText(body)) + part('text/html', toHtml(body)) + `--${boundary}--`,
  ].join('\r\n');
}

async function createDraft(owner, message) {
  const token = await accessToken(owner);
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw: b64url(mime(message)) } }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((body.error && body.error.message) || `Gmail ${r.status}`);
  const email = readTokens()[owner].email;
  return { id: body.id, link: `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}#drafts?compose=${body.message.id}` };
}

// ---------- connect / status routes (no segment needed) ----------
const router = express.Router();
const pending = new Map(); // oauth state -> { owner, exp }

router.get('/status', (req, res) => {
  const t = readTokens();
  res.json({ configured: configured(), accounts: Object.fromEntries(OWNERS.map((o) => [o, t[o] ? t[o].email : ''])) });
});

router.get('/connect', (req, res) => {
  const owner = String(req.query.owner || '').toLowerCase();
  if (!OWNERS.includes(owner)) return res.status(400).send('owner must be sagar or arjun');
  if (!configured()) return res.status(500).send('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET .env me nahi hain');
  const state = crypto.randomBytes(16).toString('hex');
  pending.set(state, { owner, exp: Date.now() + 10 * 60000 });
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(), response_type: 'code', scope: SCOPE,
    access_type: 'offline', prompt: 'consent select_account', state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
});

router.delete('/:owner', (req, res) => {
  const t = readTokens();
  delete t[req.params.owner];
  delete access[req.params.owner];
  writeTokens(t);
  res.json({ ok: true });
});

const page = (msg) => `<!doctype html><meta charset="utf-8"><title>Gmail connect</title><body style="font-family:sans-serif;padding:40px"><p>${escHtml(msg)}</p><p><a href="/">App pe wapas jao</a></p><script>setTimeout(()=>location.href='/',2500)</script>`;

// registered at /api/auth/google/callback (the redirect URI set in Google Cloud)
async function callback(req, res) {
  try {
    const st = pending.get(String(req.query.state || ''));
    pending.delete(String(req.query.state || ''));
    if (req.query.error) return res.status(400).send(page(`Google ne mana kar diya: ${req.query.error}`));
    if (!st || st.exp < Date.now()) return res.status(400).send(page('Link expire ho gaya, app me se dobara Connect dabao.'));
    const t = await googleToken({ grant_type: 'authorization_code', code: String(req.query.code || ''), redirect_uri: redirectUri() });
    if (!t.refresh_token) return res.status(400).send(page('Google ne refresh token nahi diya. myaccount.google.com/permissions se Botza Tracker hata ke dobara connect karo.'));
    const p = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: `Bearer ${t.access_token}` } });
    const profile = await p.json().catch(() => ({}));
    if (!p.ok || !profile.emailAddress) return res.status(502).send(page('Gmail profile nahi mili, dobara try karo.'));
    const all = readTokens();
    all[st.owner] = { email: profile.emailAddress, refreshToken: t.refresh_token, connectedAt: new Date().toISOString() };
    writeTokens(all);
    access[st.owner] = { token: t.access_token, exp: Date.now() + t.expires_in * 1000 };
    res.send(page(`${st.owner} ka Gmail connect ho gaya: ${profile.emailAddress}`));
  } catch (e) { res.status(500).send(page(`Connect fail: ${e.message}`)); }
}

module.exports = { router, callback, createDraft, renderEmail, mime, toHtml, readTokens, configured, OWNERS };
