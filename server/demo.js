const { College } = require('./models');

// drafts can write {demo_link}, [demo link] (any case) or the older [Website Link With Botza]
const PLACEHOLDER = /\{demo[ _]?link\}|\[demo[ _]?link\]|\[Website Link With Botza\]/gi;
const hasPlaceholder = (text) => new RegExp(PLACEHOLDER.source, 'i').test(String(text || ''));
const fillDemoLink = (text, link) => String(text || '').replace(PLACEHOLDER, () => link);

// startups show their own chatbot (the service falls back to the college one when these are left out)
const STARTUP_WIDGET = { botzaWidgetScriptUrl: 'https://botza.panscience.xyz/widget/chatbot-widget.js', demoChatbotId: 'b8a67baf-a565-4af9-b3b2-fd1a42b6880c' };
const widgetFor = (college) => (college.segment === 'startups' ? STARTUP_WIDGET : {});

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

async function setDemo(college, fields) {
  Object.assign(college, fields);
  await College.updateOne({ _id: college._id, website: college.website }, { $set: fields });
}

// open the preview the way a visitor would: 200 = works, other status = the site cannot be shown, no answer = unknown
async function checkPreview(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (r.body) await r.body.cancel().catch(() => {});
    return r.ok ? { ok: true } : { ok: false, why: `site load nahi ho rahi (${r.status})` };
  } catch { return { unknown: true }; }
}

// Preview link for one organisation. Generated once through the hosted mirror-demo, checked, and cached on the college.
// Never throws: returns { url } or { error, failed? }. failed = the site itself cannot show Botza (remembered, not retried).
async function ensureDemoLink(college) {
  if (college.demoStatus === 'failed') return { error: college.demoError || 'is site par demo nahi lag sakta', failed: true };
  if (college.demoUrl && college.demoStatus === 'ok') return { url: college.demoUrl };
  let url = college.demoUrl;
  if (!url) {
    const site = normalizeWebsite(college.website);
    if (!site) return { error: 'website nahi hai' };
    const base = String(process.env.DEMO_API_URL || '').replace(/\/+$/, '');
    if (!base) return { error: 'DEMO_API_URL set nahi hai (.env me daalo)' };
    try {
      const r = await fetch(`${base}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: site, ...widgetFor(college) }),
        signal: AbortSignal.timeout(60000), // hosted free tier can take ~50s to wake up
      });
      const body = await r.json().catch(() => ({}));
      if (r.status === 400 || r.status === 422) {
        const why = `website khul nahi rahi (${body.error || r.status})`;
        await setDemo(college, { demoStatus: 'failed', demoError: why });
        return { error: why, failed: true };
      }
      if (!r.ok || !body.previewUrl) return { error: `demo link nahi bana (${body.error || r.status})` };
      // the service may report an http:// BASE_URL; always hand out the link on the same base we called
      url = `${base}${new URL(body.previewUrl).pathname}`;
      await setDemo(college, { demoUrl: url });
    } catch (e) {
      return { error: `demo service tak nahi pahunch paya (${e.name === 'TimeoutError' ? 'timeout' : e.message})` };
    }
  }
  const check = await checkPreview(url);
  if (check.unknown) return { error: 'demo link check nahi ho paya, thodi der baad dobara try karo' };
  if (!check.ok) {
    await setDemo(college, { demoUrl: '', demoStatus: 'failed', demoError: check.why });
    return { error: check.why, failed: true };
  }
  await setDemo(college, { demoStatus: 'ok', demoError: '' });
  return { url };
}

module.exports = { hasPlaceholder, fillDemoLink, normalizeWebsite, ensureDemoLink };
