const TITLES = new Set(['dr', 'prof', 'mr', 'mrs', 'ms', 'shri', 'smt']);

// "Dr. Anita Sharma" -> "Anita"
function firstName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  while (parts.length > 1 && TITLES.has(parts[0].replace(/\./g, '').toLowerCase())) parts.shift();
  return parts[0] || '';
}

// items: output of /today (email items only are used). steps: settings.emailSteps
// senderName: replaces {sender_name} in drafts (optional; drafts without the placeholder are unaffected)
function buildEmailPrompt(items, steps, senderName) {
  const sender = String(senderName || '').trim();
  const emailItems = items.filter((i) => i.channel === 'email');
  const skipped = [];
  const ready = [];
  for (const t of emailItems) {
    const draft = (steps[t.stepIndex] && steps[t.stepIndex].draft || '').trim();
    if (!t.email) skipped.push(`${t.college} / ${t.name || t.role}: email nahi hai`);
    else if (!draft) skipped.push(`${t.college} / ${t.name || t.role}: "${t.stepLabel}" ka draft Settings mein nahi hai`);
    else if (/\{first_name\}/.test(draft) && !firstName(t.name)) skipped.push(`${t.college} / ${t.role}: contact ka naam nahi hai, draft mein {first_name} hai`);
    else ready.push(t);
  }
  const missingDrafts = [...new Set(emailItems.filter((t) => !(steps[t.stepIndex] && steps[t.stepIndex].draft || '').trim()).map((t) => t.stepLabel))];

  const usedSteps = [...new Set(ready.map((t) => t.stepIndex))].sort((a, b) => a - b);
  const attachOf = (i) => String(steps[i].attachment || '').trim().replace(/[\r\n|]+/g, ' ');
  const modeOf = (i) => (attachOf(i) ? `DRAFT_ONLY (attach: ${attachOf(i)})` : 'SEND');
  const hasDraftOnly = usedSteps.some((i) => attachOf(i));
  for (const t of ready) t.attachment = attachOf(t.stepIndex); // used by the report matcher in routes.js
  const drafts = usedSteps.map((i) => `### ${steps[i].label}  [Mode: ${modeOf(i)}]\n<<<DRAFT\n${steps[i].draft.trim().replace(/\{sender_name\}/g, () => sender)}\nDRAFT>>>`).join('\n\n');
  const cell = (s) => String(s).replace(/\s*[|\r\n]+\s*/g, ' ');
  const rows = ready.map((t, n) => `${n + 1} | ${cell(t.college.replace('[DEMO] ', ''))} | ${cell(firstName(t.name))} | ${t.email} | ${t.stepLabel} | ${modeOf(t.stepIndex)}`).join('\n');
  const senderRule = sender ? `\n- Draft mein sender (mera) naam "${sender}" hi rehna chahiye; use badalna mat.` : '';
  const draftRules = hasDraftOnly ? `
- Mode "SEND" wale recipients ko email seedha bhej do.
- Mode "DRAFT_ONLY" wale recipients ko email BHEJNA NAHI hai. Unke liye sirf Gmail mein draft banao (same subject/body, recipient set), kyunki main attachment khud lagaunga. Draft ka link connector ke create_draft result ke \`viewUrl\` field se hu-ba-hu copy karo (khud se link mat banao). Agar \`viewUrl\` na mile to link khali chhod do aur note mein likho.` : '';
  const statusRule = hasDraftOnly
    ? '"status" sirf "sent", "drafted" ya "failed" ho sakta hai. "drafted" sirf DRAFT_ONLY wale ke liye (Gmail mein draft sach mein ban gaya ho), uske saath "link" field mein draft ka link do. DRAFT_ONLY ko kabhi "sent" mat likhna.'
    : '"status" sirf "sent" ya "failed" ho sakta hai.';
  const tableRule = hasDraftOnly ? `
## Pehle ek table do
JSON se pehle ek readable markdown table do, columns: # | College | Name | Email | Step | Action (Sent / Draft) | Draft link (clickable) | Attachment lagana hai. SEND wale rows mein Action = Sent, link aur attachment khali. DRAFT_ONLY wale rows mein Action = Draft, viewUrl se mila link do aur "attach:" ke baad likha attachment ka naam likho.
` : '';
  const finalExample = hasDraftOnly
    ? '{"report":[{"n":1,"email":"a@x.edu","step":"Primary Email","status":"sent","note":""},{"n":2,"email":"b@x.edu","step":"Follow-up 1","status":"drafted","link":"<viewUrl se mila link>","note":""}]}'
    : '{"report":[{"n":1,"email":"name@example.com","step":"Primary Email","status":"sent","note":""}]}';

  const prompt = ready.length ? `Tumhare paas mera Gmail connected hai. Neeche recipients ki list hai. Har recipient ke "Step" wala draft email uske "Mode" ke hisaab se handle karo.

Rules:
- Har recipient ko sirf uske Step ka draft bhejo (Primary ya Follow-up N). Kisi aur step ka draft mat bhejna.${draftRules}
- Draft ke andar {first_name} ki jagah recipient ka First name, aur {college} ki jagah College ka naam daalo. Baaki draft ka text bilkul same rakho, kuch add/edit mat karo.${senderRule}
- Draft ki pehli line "Subject:" se shuru ho to wo email ka subject hai, baaki body hai.
- Har email alag alag bhejo (koi CC/BCC ya group mail nahi).
- Ambiguous kuch ho to guess mat karo; wo email mat bhejo aur report mein "failed" likho.
- "sent" sirf tab likho jab email Gmail se sach mein bhej diya gaya ho (draft bana dena ya queue karna "sent" nahi hai). Zara bhi shak ho ya error aaye to "failed" likho aur "note" mein wajah likho.

${tableRule}
## Final report (strict)
Saare emails${hasDraftOnly ? '/drafts' : ''} ke baad, aakhri message mein ${hasDraftOnly ? 'table ke baad ' : ''}ek json code block do${hasDraftOnly ? '' : ', uske aage-peeche kuch mat likho'}. Recipients ki har row ke liye exactly ek entry, koi extra ya kam nahi. "n", "email" aur "step" Recipients list se hu-ba-hu copy karo.
\`\`\`json
${finalExample}
\`\`\`
${statusRule}

## Drafts
${drafts}

## Recipients (# | College | First name | Email | Step | Mode)
${rows}
` : '';

  return { prompt, count: ready.length, skipped, missingDrafts, ready };
}

module.exports = { buildEmailPrompt, firstName };
