const { hasPlaceholder } = require('./demo');

const TITLES = new Set(['dr', 'prof', 'mr', 'mrs', 'ms', 'shri', 'smt']);

// email sign-off per college owner; replaces the draft's own closing + {sender_name} line
const SIGNATURES = {
  sagar: { name: 'Sagar Kandpal', linkedin: 'https://www.linkedin.com/in/sagar-kandpal/' },
  arjun: { name: 'Arjun Purwar', linkedin: 'https://www.linkedin.com/in/arjun-purwar/' },
};
const TITLE_LINE = 'Entrepreneur in Residence - Panscience Innovations';

// "Dr. Anita Sharma" -> "Anita"
function firstName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  while (parts.length > 1 && TITLES.has(parts[0].replace(/\./g, '').toLowerCase())) parts.shift();
  return parts[0] || '';
}

// items: output of /today (email items only are used). steps: settings.emailSteps
// senderName: replaces {sender_name} in drafts (optional; drafts without the placeholder are unaffected)
function buildEmailPrompt(items, steps, senderName, unit = 'College') {
  const sender = String(senderName || '').trim();
  const emailItems = items.filter((i) => i.channel === 'email');
  const skipped = [];
  const ready = [];
  for (const t of emailItems) {
    const draft = (steps[t.stepIndex] && steps[t.stepIndex].draft || '').trim();
    if (!t.email) skipped.push(`${t.college} / ${t.name || t.role}: email nahi hai`);
    else if (!draft) skipped.push(`${t.college} / ${t.name || t.role}: "${t.stepLabel}" ka draft Settings mein nahi hai`);
    else if (hasPlaceholder(draft) && !t.demoLink) skipped.push(`${t.college} / ${t.name || t.role}: demo link nahi ban paya (${t.demoError || 'website nahi hai'})`);
    else if (/\{attachment_link\}/i.test(draft) && !String(steps[t.stepIndex].attachmentUrl || '').trim()) skipped.push(`${t.college} / ${t.name || t.role}: "${t.stepLabel}" ka attachment link Settings mein nahi hai`);
    else if (/\{first_name\}/.test(draft) && !firstName(t.name)) skipped.push(`${t.college} / ${t.role}: contact ka naam nahi hai, draft mein {first_name} hai`);
    else ready.push(t);
  }
  const missingDrafts = [...new Set(emailItems.filter((t) => !(steps[t.stepIndex] && steps[t.stepIndex].draft || '').trim()).map((t) => t.stepLabel))];

  const usedSteps = [...new Set(ready.map((t) => t.stepIndex))].sort((a, b) => a - b);
  const urlOf = (i) => String(steps[i].attachmentUrl || '').trim();
  // every email is only drafted in Gmail, never sent; a manual attachment is just noted
  const attachOf = (i) => (urlOf(i) ? '' : String(steps[i].attachment || '').trim().replace(/[\r\n|]+/g, ' '));
  const linkText = (i) => String(steps[i].attachment || '').trim().replace(/[\[\]\r\n|]+/g, ' ') || 'Attachment';
  const modeOf = (i) => (attachOf(i) ? `DRAFT (attach: ${attachOf(i)})` : 'DRAFT');
  const hasAttach = usedSteps.some((i) => attachOf(i));
  const signerOf = (t) => (SIGNATURES[t.owner] ? t.owner : '');
  const signers = [...new Set(ready.map(signerOf).filter(Boolean))];
  // owner's sign-off replaces the draft's own closing + {sender_name}; no owner = draft stays as written
  const signed = (text, o) => {
    if (!o) return text;
    const sig = `Best regards,\n${SIGNATURES[o].name}\n${TITLE_LINE}\n[LinkedIn](${SIGNATURES[o].linkedin})`;
    const closing = /\n+(?:best regards|best|thanks|thank you|regards|warm regards|kind regards|cheers|sincerely),?[ \t]*\n+[ \t]*\{sender_name\}[ \t]*$/i;
    if (closing.test(text)) return text.replace(closing, () => `\n\n${sig}`);
    return text.replace(/\n*\{sender_name\}[ \t]*$/, () => `\n\n${sig}`);
  };
  const blocks = [];
  for (const t of ready) if (!blocks.some((b) => b.i === t.stepIndex && b.o === signerOf(t))) blocks.push({ i: t.stepIndex, o: signerOf(t) });
  blocks.sort((a, b) => a.i - b.i || a.o.localeCompare(b.o));
  const drafts = blocks.map(({ i, o }) => `### ${steps[i].label}${signers.length ? `  [Signer: ${o || '-'}]` : ''}  [Mode: ${modeOf(i)}]\n<<<DRAFT\n${signed(steps[i].draft.trim(), o).replace(/\{sender_name\}/g, () => sender).replace(/\{attachment_link\}/gi, () => `[${linkText(i)}](${urlOf(i)})`)}\nDRAFT>>>`).join('\n\n');
  // per-recipient demo link, only for steps whose draft uses {demo_link}
  const anyDemo = ready.some((t) => hasPlaceholder(steps[t.stepIndex].draft));
  const cell = (s) => String(s).replace(/\s*[|\r\n]+\s*/g, ' ');
  const rows = ready.map((t, n) => `${n + 1} | ${cell(t.college.replace('[DEMO] ', ''))} | ${cell(firstName(t.name))} | ${t.email} | ${t.stepLabel} | ${modeOf(t.stepIndex)}${signers.length ? ` | ${signerOf(t) || '-'}` : ''}${anyDemo ? ` | ${t.demoLink || '-'}` : ''}`).join('\n');
  const sigRule = signers.length ? '\n- Drafts mein sign-off pehle se laga hua hai (owner ke hisaab se). Har recipient ke liye wo Draft block lo jiska Step aur Signer uski Recipients row se match kare; "[LinkedIn](url)" clickable hyperlink bane (text sirf "LinkedIn"). Sign-off mat badalna.' : '';
  const senderRule = sender && !signers.length ? `\n- Draft mein sender (mera) naam "${sender}" hi rehna chahiye; use badalna mat.` : '';
  const draftRules = `
- Koi bhi email SEND mat karo, kisi ko bhi nahi. Har recipient ke liye sirf Gmail mein draft banao (same subject/body, recipient set); bhejunga main khud. Draft ka link connector ke create_draft result ke \`viewUrl\` field se hu-ba-hu copy karo (khud se link mat banao). Agar \`viewUrl\` na mile to link khali chhod do aur note mein likho.${hasAttach ? '\n- Mode mein "attach:" likha ho to attachment main khud lagaunga; use draft mein mat jodo.' : ''}`;
  const tableRule = `columns: # | ${unit} | Name | Email | Step | Action (Draft / Failed) | Draft link (clickable)${hasAttach ? ' | Attachment lagana hai ("attach:" ke baad likha naam, warna khali)' : ''}. Draft bana to Action = Draft aur viewUrl se mila link do.`;

  const prompt = ready.length ? `Tumhare paas mera Gmail connected hai. Neeche recipients ki list hai. Har recipient ke "Step" wale email ka Gmail draft banao. Koi email bhejna nahi hai.

Rules:
- Har recipient ko sirf uske Step ka draft banao (Primary ya Follow-up N). Kisi aur step ka draft mat banana.${draftRules}
- Draft ke andar {first_name} ki jagah recipient ka First name, aur {college} / {company} ki jagah ${unit} ka naam daalo. Baaki draft ka text bilkul same rakho, kuch add/edit mat karo.${senderRule}${sigRule}
${anyDemo ? '- Draft mein {demo_link} / [demo link] (ya [Website Link With Botza]) ki jagah us recipient ki "Demo link" daalo (Recipients list me di hui, hu-ba-hu, badalna mat). Link clickable rakho.\n' : ''}- Draft ki pehli line "Subject:" se shuru ho to wo email ka subject hai, baaki body hai.
- Draft mein jahan [text](url) jaisa markdown link ho, use email mein clickable hyperlink bana ke draft mein daalo: email ki HTML body use karo (har paragraph <p> mein, link <a href="url">text</a>), plain text body mein markdown kabhi mat bhejo. Link ka sirf text (jaise "Demo video link") dikhna chahiye, raw URL ya "[text](url)" ke brackets email mein dikhne nahi chahiye, aur href mein URL hu-ba-hu wahi ho jo draft mein hai. Agar connector HTML body support nahi karta to us email ka draft mat banao, bas table mein "Failed: HTML body unsupported" likho.
- Har email ka alag draft banao (koi CC/BCC ya group mail nahi).
- Ambiguous kuch ho to guess mat karo; uska draft mat banao aur table mein "Failed" likho.
- "Draft" sirf tab likho jab Gmail mein draft sach mein ban gaya ho. Zara bhi shak ho ya error aaye to "Failed" likho aur wajah batao.

## Final table
Saare drafts ke baad, aakhri message mein sirf ek readable markdown table do, Recipients ki har row ke liye exactly ek row, ${tableRule} "#", "Email" aur "Step" Recipients list se hu-ba-hu copy karo.

## Drafts
${drafts}

## Recipients (# | ${unit} | First name | Email | Step | Mode${signers.length ? ' | Signer' : ''}${anyDemo ? ' | Demo link' : ''})
${rows}
` : '';

  return { prompt, count: ready.length, skipped, missingDrafts, readyIds: ready.map((t) => String(t.contactId)) };
}

module.exports = { buildEmailPrompt, firstName };
