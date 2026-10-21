const { College } = require('./models');

// drafts can write {demo_link}, [demo link] (any case) or the older [Website Link With Botza]
const PLACEHOLDER = /\{demo[ _]?link\}|\[demo[ _]?link\]|\[Website Link With Botza\]/gi;
const hasPlaceholder = (text) => new RegExp(PLACEHOLDER.source, 'i').test(String(text || ''));
const fillDemoLink = (text, link) => String(text || '').replace(PLACEHOLDER, () => link);

// "iitd.ac.in" -> "https://iitd.ac.in"; anything that is not a plain http(s) URL -> ''
function normalizeWebsite(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch { return ''; }
}

// Preview link for one organisation. Generated once through the hosted mirror-demo and cached on the college.
// Never throws: returns { url } or { error } so prompt building can skip just that recipient.
async function ensureDemoLink(college) {
  if (college.demoUrl) return { url: college.demoUrl };
  const site = normalizeWebsite(college.website);
  if (!site) return { error: 'website nahi hai' };
  const base = String(process.env.DEMO_API_URL || '').replace(/\/+$/, '');
  if (!base) return { error: 'DEMO_API_URL set nahi hai (.env me daalo)' };
  try {
    const r = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: site }),
      signal: AbortSignal.timeout(60000), // hosted free tier can take ~50s to wake up
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body.previewUrl) return { error: `demo link nahi bana (${body.error || r.status})` };
    // the service may report an http:// BASE_URL; always hand out the link on the same base we called
    const url = `${base}${new URL(body.previewUrl).pathname}`;
    await College.updateOne({ _id: college._id, website: college.website }, { $set: { demoUrl: url } });
    return { url };
  } catch (e) {
    return { error: `demo service tak nahi pahunch paya (${e.name === 'TimeoutError' ? 'timeout' : e.message})` };
  }
}

module.exports = { hasPlaceholder, fillDemoLink, normalizeWebsite, ensureDemoLink };
