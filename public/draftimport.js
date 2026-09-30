// Import email + LinkedIn drafts from a restructured document (PDF / txt / pasted text).
// Strict format: every draft starts with a heading line "### EMAIL | <step>" or "### LINKEDIN | <step>".

const IMPORT_PROMPT = `Mere saath ek document (PDF) attach hai jisme mere outreach ke email drafts aur LinkedIn messages hain. Isko neeche diye gaye STRICT format mein restructure karo. Tumhara output sirf ek code block hona chahiye, uske aage-peeche kuch mat likho.

FORMAT:
- Har draft ek heading line se shuru ho: \`### EMAIL | <step>\` ya \`### LINKEDIN | <step>\`
- <step> sirf inme se ho: \`Primary Email\` (sirf EMAIL ke liye), \`Connection Note\` (sirf LINKEDIN ke liye), ya \`Follow-up 1\`, \`Follow-up 2\`, \`Follow-up 3\` ... (dono ke liye)
- Heading ke neeche us step ka poora draft. EMAIL draft ki pehli line \`Subject: ...\` ho (agar subject document mein hai), phir khali line, phir body.
- Har step ka exactly ek draft. Order: pehle saare EMAIL (Primary, Follow-up 1, 2...), phir saare LINKEDIN.

RULES:
- Draft ka text document se hu-ba-hu copy karo. Kuch summarize, rewrite, translate ya improve mat karo. Line breaks aur paragraphs waise hi rakho.
- Recipient ke naam (jaise "Hi Rahul") ki jagah \`{first_name}\` likho, aur college / university ke naam ki jagah \`{college}\`. Baaki text ko mat chhedo.
- Agar kisi step ka draft document mein nahi hai to uski heading mat likho (khali mat chhodo, guess mat karo).
- Koi extra heading, intro, explanation ya comment mat jodo.

EXAMPLE:
\`\`\`
### EMAIL | Primary Email
Subject: Botza x {college}

Hi {first_name},
...

### EMAIL | Follow-up 1
Subject: Re: Botza x {college}

Hi {first_name},
...

### LINKEDIN | Connection Note
Hi {first_name}, ...

### LINKEDIN | Follow-up 1
Hi {first_name}, ...
\`\`\``;

// "Primary Email" / "Connection Note" -> 0, "Follow-up 2" / "F2" -> 2, anything else -> null
function stepIndexFromLabel(label) {
  const s = String(label || '').trim().toLowerCase();
  if (/^(primary|connection|first|initial|intro)\b/.test(s)) return 0;
  const m = s.match(/^(?:follow[\s-]*up|f)\s*#?\s*(\d+)$/);
  return m ? Number(m[1]) : null;
}

// text -> { email: [draft|undefined,...], linkedin: [...], count, warnings: [] }
function parseDrafts(text) {
  const out = { email: [], linkedin: [], count: 0, warnings: [] };
  const HEAD = /^\s*#{0,4}\s*\**\s*(EMAIL|LINKEDIN)\s*[|:\-–—]\s*(.+?)\s*\**\s*$/i;
  let cur = null;
  const flush = () => {
    if (!cur) return;
    const body = cur.lines.join('\n').replace(/^\s*[-_*]{3,}\s*$/gm, '').trim();
    const ch = cur.channel;
    if (cur.index === null) out.warnings.push(`Step samajh nahi aaya: "${cur.label}" (${ch.toUpperCase()}) — skip`);
    else if (!body) out.warnings.push(`${ch.toUpperCase()} | ${cur.label}: draft khali hai — skip`);
    else {
      if (out[ch][cur.index] !== undefined) out.warnings.push(`${ch.toUpperCase()} | ${cur.label} do baar aaya — aakhri wala liya`);
      else out.count++;
      out[ch][cur.index] = body;
    }
    cur = null;
  };
  for (const line of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    const m = line.match(HEAD);
    if (m) {
      flush();
      const label = m[2].replace(/[*#`]/g, '').trim();
      cur = { channel: m[1].toLowerCase(), label, index: stepIndexFromLabel(label), lines: [] };
    } else if (cur) cur.lines.push(line);
  }
  flush();
  if (!out.count) out.warnings.push('Koi draft nahi mila. Document me "### EMAIL | Primary Email" jaisi headings honi chahiye.');
  return out;
}

// PDF file -> plain text with line breaks (pdf.js loaded from CDN on first use)
async function pdfToText(file) {
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('PDF reader load nahi hua (internet check karo) — text paste kar do'));
      document.head.appendChild(s);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    let lastY = null;
    for (const it of content.items) {
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 1) {
        // bigger vertical jump = paragraph break
        text += Math.abs(y - lastY) > (it.height || 10) * 1.9 ? '\n\n' : '\n';
      }
      text += it.str;
      if (it.hasEOL) text += '\n';
      lastY = y;
    }
    text += '\n';
  }
  return text;
}

if (typeof module !== 'undefined') module.exports = { parseDrafts, stepIndexFromLabel, IMPORT_PROMPT };
