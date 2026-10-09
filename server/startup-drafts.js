// Default sequence for the "Startup" segment. {college} = company name in this segment.
// Steps with an `attachment` note are DRAFT_ONLY for Claude: the sender fills the file / link by hand.
const emailSteps = [
  {
    label: 'Primary Email', gapDays: 0, attachment: '',
    draft: `Subject: The visitor who didn't wait for your reply

Hi {first_name},

It's 9 pm. Someone is on {college}'s website, wondering about pricing or whether you work with companies like theirs. There's no one to ask, so they open a competitor's tab.

Botza is an AI chatbot that answers visitors from your own knowledge base. It also works inside the company: HR uploads policy documents and employees ask the chatbot instead of messaging HR.

Would you be open to a 15-minute demo?

Best,
{sender_name}`,
  },
  {
    label: 'Follow-up 1', gapDays: 2, attachment: 'Brochure',
    draft: `Subject: Answering the same questions again, {first_name}?

{first_name}, quick one.

Which of these does your team type out most often?

- What does it cost?
- Do you work with companies like ours?
- How long does setup take?

Botza answers questions like these on your website from your own knowledge base, so people get a reply and your team gets time back. The attached brochure explains how.

Open to a 15-minute walkthrough?

Best,
{sender_name}`,
  },
  {
    label: 'Follow-up 2', gapDays: 2, attachment: 'Demo video link (paste [Demo Video Link])',
    draft: `Subject: Where policy questions go as you grow

Hi {first_name},

Picture HR on a Monday morning. Three messages are already waiting: what the notice period is, how reimbursements work, and whether work from home needs approval. The answers exist in a document. Nobody opens it, so everyone asks HR.

That's the problem Botza's internal chatbot solves: HR uploads the policy documents, and employees ask in plain language and get answers from them.

Have a look when you have a minute: [Demo Video Link]

Thanks,
{sender_name}`,
  },
  {
    label: 'Follow-up 3', gapDays: 2, attachment: "Link to {college}'s website with Botza (paste [Website Link With Botza])",
    draft: `Subject: Botza on {college}'s website, ready to try

Hi {first_name},

I did something a bit unusual: I set up Botza on a version of your website, so you don't have to imagine how it would work.

Open the link and ask it what a first-time visitor might ask, like a pricing question or "do you work with companies like ours?" It takes a minute or two.

[Website Link With Botza]

Regards,
{sender_name}`,
  },
  {
    label: 'Follow-up 4', gapDays: 2, attachment: 'Feature comparison sheet',
    draft: `Subject: Will it cover what {college} needs?

Hi {first_name},

A fair question you may be asking: we already have a handbook and an FAQ page, so why a chatbot?

Handbook or FAQ page: the visitor or employee has to find the right page first. Botza: they ask in their own words and get an answer drawn from the documents you provide.

The attached feature comparison sheet lays out what Botza covers. Reply with the question your team answers most, and I'll show you how Botza handles it.

Best,
{sender_name}`,
  },
  {
    label: 'Follow-up 5', gapDays: 2, attachment: '',
    draft: `Subject: Should I close this out?

{first_name}, this is my last note, I promise.

Maybe quick answers for website visitors, or fewer repeat questions for HR, just isn't a priority at {college} right now. That's completely reasonable.

If it becomes one later, reply here and I'll set up a short demo. If you'd prefer I don't write again, just say so.

All the best to you and the team,
{sender_name}`,
  },
];

const linkedinSteps = [
  {
    label: 'Connection Note', gapDays: 0,
    draft: `Hi {first_name}, I'm {sender_name}, Entrepreneur in Residence at Botza AI. We build a chatbot that answers website visitors and HR questions from a company's own documents. I'd like to connect and hear how {college} handles website enquiries.`,
  },
  {
    label: 'Follow-up 1', gapDays: 2,
    draft: `{first_name}, thanks for connecting. Rather than explain Botza, I'd like you to see it. It answers website visitors' questions from a company's own documents, and there's an HR version for employees too.

Short video here: [Demo Video Link]`,
  },
  {
    label: 'Follow-up 2', gapDays: 2,
    draft: `{first_name}, I went ahead and put Botza on a version of your website. Ask it something a visitor might ask and see what comes back: [Website Link With Botza]`,
  },
];

module.exports = { emailSteps, linkedinSteps };
