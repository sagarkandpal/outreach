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
  const drafts = usedSteps.map((i) => `### ${steps[i].label}\n<<<DRAFT\n${steps[i].draft.trim().replace(/\{sender_name\}/g, () => sender)}\nDRAFT>>>`).join('\n\n');
  const cell = (s) => String(s).replace(/\s*[|\r\n]+\s*/g, ' ');
  const rows = ready.map((t, n) => `${n + 1} | ${cell(t.college.replace('[DEMO] ', ''))} | ${cell(firstName(t.name))} | ${t.email} | ${t.stepLabel}`).join('\n');
  const senderRule = sender ? `\n- Draft mein sender (mera) naam "${sender}" hi rehna chahiye; use badalna mat.` : '';

  const prompt = ready.length ? `Tumhare paas mera Gmail connected hai. Neeche recipients ki list hai. Har recipient ko uske "Step" wala draft email bhejo.

Rules:
- Har recipient ko sirf uske Step ka draft bhejo (Primary ya Follow-up N). Kisi aur step ka draft mat bhejna.
- Draft ke andar {first_name} ki jagah recipient ka First name, aur {college} ki jagah College ka naam daalo. Baaki draft ka text bilkul same rakho, kuch add/edit mat karo.${senderRule}
- Draft ki pehli line "Subject:" se shuru ho to wo email ka subject hai, baaki body hai.
- Har email alag alag bhejo (koi CC/BCC ya group mail nahi).
- Ambiguous kuch ho to guess mat karo; wo email mat bhejo aur report mein "failed" likho.
- "sent" sirf tab likho jab email Gmail se sach mein bhej diya gaya ho (draft bana dena ya queue karna "sent" nahi hai). Zara bhi shak ho ya error aaye to "failed" likho aur "note" mein wajah likho.

## Final report (strict)
Saare emails ke baad, aakhri message mein sirf ek json code block do, uske aage-peeche kuch mat likho. Recipients ki har row ke liye exactly ek entry, koi extra ya kam nahi. "n", "email" aur "step" Recipients list se hu-ba-hu copy karo.
\`\`\`json
{"report":[{"n":1,"email":"name@example.com","step":"Primary Email","status":"sent","note":""}]}
\`\`\`
"status" sirf "sent" ya "failed" ho sakta hai.

## Drafts
${drafts}

## Recipients (# | College | First name | Email | Step)
${rows}
` : '';

  return { prompt, count: ready.length, skipped, missingDrafts, ready };
}

module.exports = { buildEmailPrompt, firstName };
