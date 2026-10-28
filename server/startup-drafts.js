// Default sequence for the "Startup" segment. {company} = the company name (the old {college} placeholder still works too).
// Steps with an `attachment` note are DRAFT_ONLY for Claude: the sender fills the file / link by hand.
const emailSteps = [
  {
    label: 'Primary Email', gapDays: 0, attachment: '',
    draft: `Subject: Helping website visitors find answers

Hi {first_name},

A visitor can be interested in what your business offers but still have a question about pricing, product fit, or setup. If the answer isn't easy to find, they may postpone their enquiry or move on.

[Botza](https://botza.panscience.ai/) is an AI chatbot that answers website questions using the knowledge base and documents you provide, giving visitors another way to find relevant information without waiting for a manual reply.

Would you be open to a 15-minute demo?

Best,
{sender_name}`,
  },
  {
    label: 'Follow-up 1', gapDays: 2, attachment: '',
    draft: `Subject: Handling repeat website questions

Hi {first_name},

When visitors repeatedly ask about pricing, product fit, or setup, your team may spend time typing similar replies instead of focusing on other work.

Botza lets visitors ask questions in their own words and receive answers based on the knowledge base you provide.

I've attached a short [brochure](https://drive.google.com/file/d/1U2SRhuq4M7C0a-Lw1iRkrUddFqKkwoWA/view?usp=sharing) explaining how it works.

Would it be useful to see how Botza handles a typical website question?

Best,
{sender_name}`,
  },
  {
    label: 'Follow-up 2', gapDays: 2, attachment: '',
    draft: `Subject: Botza website chatbot demo

Hi {first_name},

A chatbot's value isn't just in greeting a visitor—it's in how it responds when someone asks a real question.

This short demo shows Botza answering website questions using a company's own knowledge base, so you can see the experience rather than rely on a product description.

Watch the demo: [Demo Video Link](https://drive.google.com/file/d/1HchTj9NmLYdqeLX2nUpIcgpZkZ1WPmUr/view?usp=sharing)

Thanks,
{sender_name}`,
  },
  {
    label: 'Follow-up 3', gapDays: 2, attachment: '',
    draft: `Subject: Botza website chatbot preview

Hi {first_name},

The most useful way to judge a chatbot is to try asking it a question yourself.

Here's a preview of Botza's website chatbot:

{demo_link}

Try a typical question about pricing, product fit, or setup and see how the demo responds.

This is a preview, not an installation on your live website.

Best,
{sender_name}`,
  },
  {
    label: 'Follow-up 4', gapDays: 2, attachment: '',
    draft: `Subject: Comparing FAQ pages and chatbots

Hi {first_name},

An FAQ page works well when visitors know where to look. But when they're unsure which page contains the answer, finding the right information can take extra effort.

Botza offers another route: visitors ask questions in their own words and receive answers based on the documents you provide.

I've attached the [feature comparison sheet](https://drive.google.com/file/d/1Mf_UgqmH6CCQcR2hX6DQ7m_5HTbL0S6p/view?usp=sharing) so you can assess whether a chatbot could complement your existing website information.

Would a quick comparison be useful?

Best,
{sender_name}`,
  },
  {
    label: 'Follow-up 5', gapDays: 2, attachment: '',
    draft: `Subject: A final note about Botza

Hi {first_name},

I've sent a few notes about Botza, and I don't want to keep adding to your inbox, so I'll leave it here.

If answering repeat website questions becomes a priority later, you're welcome to reply and arrange a short walkthrough.

If you'd prefer no further outreach, just let me know and I'll respect that.

Thanks,
{sender_name}`,
  },
];

const linkedinSteps = [
  {
    label: 'Connection Note', gapDays: 0,
    draft: `Hi {first_name}, I'm {sender_name} at Botza AI (https://botza.panscience.ai/). We help businesses answer repeat website questions using their own knowledge base, giving visitors another way to find answers without waiting for a manual reply. Thought it'd be useful to connect.`,
  },
  {
    label: 'Follow-up 1', gapDays: 2,
    draft: `Thanks for connecting, {first_name}.

A useful way to judge a website chatbot is to see whether it can answer questions using a company's own information.

Here's a short Botza demo showing that experience:

https://drive.google.com/file/d/1HchTj9NmLYdqeLX2nUpIcgpZkZ1WPmUr/view?usp=sharing`,
  },
  {
    label: 'Follow-up 2', gapDays: 2,
    draft: `{first_name}, the simplest way to assess a chatbot is to try asking it a question yourself.

Here's a preview of Botza's website chatbot:

{demo_link}

Try a typical question about pricing or product fit and see how the demo responds. This is a preview, not an installation on your live website.`,
  },
];

// colleges. {college} = the college name (drafts say "{college}'s website"; {college_website} also works).
// Steps with an `attachment` are attached by hand to the Gmail draft (only college Follow-up 5 now); other files are Drive links inside the draft. Follow-up 3 uses the per-college {demo_link}.
const collegeEmailSteps = [
  {
    label: 'Primary Email', gapDays: 0, attachment: '',
    draft: `Subject: A simpler way for students to find answers at {college}

Hi {first_name},

I was looking at {college}'s website and wanted to share an idea relevant to the student enquiry experience.

Prospective students often need specific information about fees, courses, eligibility or admissions. When they cannot find an answer quickly, they may need to call the college or wait for someone to respond.

[Botza AI](https://botza.panscience.ai/) adds a website assistant that answers questions using the information made available to it. Students can ask questions conversationally instead of navigating multiple pages, while your team can focus on enquiries that need personal attention.

Would you be open to a 15-minute walkthrough to see whether this could be useful for {college}?

Best regards,
{sender_name}
PanScience Innovations | Botza AI`,
  },
  {
    label: 'Follow-up 1', gapDays: 2, attachment: '',
    draft: `Subject: How an AI assistant could support {college}

Hi {first_name},

I wanted to follow up with a little more context on Botza AI.

The idea is straightforward: make your institution's existing knowledge easier to access through a conversational interface.

For prospective students, that can mean finding information about courses, fees and admissions. Internally, a separate assistant can help employees look up approved HR policies, procedures and other organisational information.

The assistant's responses depend on the information and configuration provided, and supported content can be updated as details change.

I've attached a [short overview of the platform](https://drive.google.com/file/d/1PMXWurspMRehUGZLoPF8zaWzWRLW_7e7/view?usp=sharing) for context.

Would a brief walkthrough focused on the student-facing use case be worth exploring for {college}?

Best regards,
{sender_name}
PanScience Innovations | Botza AI`,
  },
  {
    label: 'Follow-up 2', gapDays: 2, attachment: '',
    draft: `Subject: What if students could simply ask {college} a question?

Hi {first_name},

Here's a practical example of what the experience could look like.

A prospective student visits {college}'s website and asks, "What are the eligibility criteria for BTech CSE?"

Instead of searching across multiple pages, the student can ask the assistant and receive an answer based on the information configured for it. They can then ask a related question about admissions or hostel facilities.

The goal isn't to replace your admissions team. It's to make routine information easier to access, so students can find basic answers and your staff can focus on more specific enquiries.

I've included a [short demo video](https://drive.google.com/file/d/1l3wG95_mcjCa4kSPCZKQEWn5ko8EoiSo/view?usp=sharing) to make the experience easier to evaluate.

Would you be available for a 15-minute walkthrough?

Best regards,
{sender_name}
PanScience Innovations | Botza AI`,
  },
  {
    label: 'Follow-up 3', gapDays: 2, attachment: '',
    draft: `Subject: A sample Botza assistant for {college}

Hi {first_name},

Rather than asking you to imagine how Botza might work, I'd like to show you a practical example.

We've prepared a small demonstration using publicly available information from {college}'s website to illustrate how an assistant could respond to questions about courses, fees and other student-related information.

Try the demo: {demo_link}

This is a sample experience, not a live deployment at {college}. The purpose is to show how your existing website information could be made accessible through a conversational interface.

If the approach looks relevant, would you be open to a 15-minute discussion about the information your students ask for most often and whether Botza would be a suitable fit?

Best regards,
{sender_name}
PanScience Innovations | Botza AI`,
  },
  {
    label: 'Follow-up 4', gapDays: 2, attachment: '',
    draft: `Subject: Another possible use for AI at {college}: internal staff queries

Hi {first_name},

I've focused on prospective students in my earlier messages, but there may be a second use case worth considering.

Employees often need to locate information about leave policies, holiday calendars, internal procedures or forms. Finding these answers can involve checking documents or contacting the relevant team.

A separate Botza assistant can help employees retrieve answers from the HR policies and process information made available to it, through a shared link or another supported deployment option.

This could be considered independently of the student-facing assistant, depending on your institution's priorities.

Would it be useful to [compare the two use cases](https://drive.google.com/file/d/1i31RPS4_vzd6tU0NJTRrA4eBtien7joE/view?usp=sharing) and identify which, if either, deserves attention first?

Best regards,
{sender_name}
PanScience Innovations | Botza AI`,
  },
  {
    label: 'Follow-up 5', gapDays: 2, attachment: 'Sample analytics report',
    draft: `Subject: What students' questions could tell {college}

Hi {first_name},

I'll close the loop after this message.

One additional benefit of a website assistant is the opportunity to understand what visitors are asking. Where supported by the analytics configuration, Botza can help your team identify recurring questions and topics that visitors look for.

These insights may highlight information that deserves greater visibility on your website or help your team improve how common queries are addressed.

I've included a sample analytics report for reference, so you can assess the kind of information available.

Would a short walkthrough be useful to explore whether this could fit {college}'s needs?

If it's not a priority right now, no problem at all. Thank you for your time.

Best regards,
{sender_name}
PanScience Innovations | Botza AI`,
  },
];

const collegeLinkedinSteps = [
  {
    label: 'Connection Note', gapDays: 0,
    draft: `Hi {first_name}, I'm {sender_name} from PanScience Innovations, where we build AI ventures. I'm working on Botza AI (https://botza.panscience.ai/), which helps students and parents find answers on college websites. Thought it would be valuable to connect and exchange perspectives.`,
  },
    {
    label: 'Follow-up 1', gapDays: 2,
    draft: `Hi {first_name}, thanks for connecting!

When prospective students visit {college}'s website, they may have questions about fees, courses or admissions that they can't immediately resolve.

Botza AI helps visitors get answers from the information your institution provides, without having to search through multiple pages.

Here's a short demo video showing how it works: https://drive.google.com/file/d/1l3wG95_mcjCa4kSPCZKQEWn5ko8EoiSo/view?usp=sharing

Would you be open to a quick look at how this could work for {college}?`,
  },
  {
    label: 'Follow-up 2', gapDays: 2,
    draft: `Hi {first_name}, I've put together a small Botza demo for {college}, built only from publicly available information on your website, so you can see how it answers student questions: {demo_link}

It's a sample experience, not a live deployment at {college}.

Would you be open to a short 15-minute call to discuss whether this could work for your students? Happy to work around your schedule.
{{if_no_demo}}
Hi {first_name}, one thought worth sharing: the questions students ask can also reveal which information is difficult to find on a college website.

Botza can help answer routine queries and, through available analytics, show your team what visitors are asking. Here's a short brochure explaining how it works: https://drive.google.com/file/d/1PMXWurspMRehUGZLoPF8zaWzWRLW_7e7/view?usp=sharing

Would you be open to a short 15-minute call to see whether this could be a fit for {college}? Happy to work around your schedule.`,
  },
];

module.exports = { emailSteps, linkedinSteps, collegeEmailSteps, collegeLinkedinSteps };
