// Default sequence for the "EdTech Ins" segment (from "Botza AI Outreach for edtech.docx").
// {company} = the institute name, {demo_link} = the per-institute website preview.
// Steps with an `attachment` are attached by hand to the Gmail draft (brochure, comparison sheet).
const DEMO_VIDEO = 'https://drive.google.com/file/d/1SumHameFyTqytMfkoaOscpEaNawtATNu/view?usp=sharing';

const emailSteps = [
  {
    label: 'Primary Email', gapDays: 0, attachment: '',
    draft: `Subject: Still handling student enquiries manually?

Hi {first_name},

I'm {sender_name}, Entrepreneur in Residence (EIR) at PanScience Innovations, where we're building [Botza AI](https://botza.panscience.ai/).

When students visit {company}'s website, they may have questions about course fees, eligibility or batches but not find the answers they're looking for.

How do you currently handle these enquiries when your admissions team isn't available?

Botza is an AI website chatbot that answers student and parent questions using your institute's own course information and documents, even outside office hours.

Would you be open to a quick 15-minute look at how it works?

Best regards,
{sender_name}
PanScience Innovations | Botza AI`,
  },
  {
    label: 'Follow-up 1', gapDays: 2, attachment: '',
    draft: `Subject: How much time does your team spend answering repeat queries?

Hi {first_name},

Just wanted to share a little more about the idea I mentioned.

Instead of searching through multiple pages or waiting for someone to respond, students can simply ask Botza about courses, fees, eligibility or batches and get answers based on your institute's information.

I've attached a short [brochure](https://drive.google.com/file/d/1wyguwXyBN-a34eI2-oJByXNVAhHtmtBF/view?usp=sharing) showing how it works.

Does handling these repetitive student questions take up much of your team's time?

Best regards,
{sender_name}
PanScience Innovations | Botza AI`,
  },
  {
    label: 'Follow-up 2', gapDays: 2, attachment: '',
    draft: `Subject: What if students could get answers without calling your team?

Hi {first_name},

I thought a quick demonstration would explain Botza better than another long email.

In this short video, you'll see how a student can ask questions about a course and receive answers using the institute's own information.

Watch here: [Demo Video](${DEMO_VIDEO})

After watching, I'd be interested to know if this kind of experience would be useful on {company}'s website.

Best regards,
{sender_name}
PanScience Innovations | Botza AI`,
  },
  {
    label: 'Follow-up 3', gapDays: 2, attachment: '',
    draft: `Subject: Can your website answer students when your team can't?

Hi {first_name},

I've shared how Botza works, but you can also experience it yourself.

Here's a preview of our website chatbot:

{demo_link}

Try asking something a student might ask, such as:
- What are the eligibility criteria?
- Do you offer weekend batches?
- What is included in the course?

This is a demo preview, not an installation on your live website.

I'd be curious to know how you find the experience.

Best regards,
{sender_name}
PanScience Innovations | Botza AI`,
  },
  {
    label: 'Follow-up 4', gapDays: 2, attachment: '',
    draft: `Subject: Are repetitive student queries keeping your team busy?

Hi {first_name},

Your website's FAQ page already provides useful information. But students don't always know which page to visit or where to find a particular answer.

Botza adds another way to access that information: students ask questions in their own words and get answers based on the documents and knowledge you provide.

I've attached a short [comparison sheet](https://drive.google.com/file/d/1VPb_lyepegzs-jVFiusptwqaAEdEVQ1t/view?usp=sharing) showing how a chatbot can complement existing FAQ pages.

Do you think this could be useful for {company}?

Best regards,
{sender_name}
PanScience Innovations | Botza AI`,
  },
  {
    label: 'Follow-up 5', gapDays: 2, attachment: '',
    draft: `Subject: Should I leave this for another time?

Hi {first_name},

I've reached out a few times about Botza, so I'll make this my last follow-up.

I understand that adding something new to your website may not be a priority right now.

If helping students find answers about courses and admissions becomes relevant later, feel free to reach out. I'd be happy to walk you through Botza.

Thanks for your time, and all the best to your team.

Best regards,
{sender_name}
PanScience Innovations | Botza AI`,
  },
];

const linkedinSteps = [
  {
    label: 'Connection Note', gapDays: 0,
    draft: `Hi {first_name}, I'm {sender_name}, EIR at PanScience Innovations. We're building Botza AI (https://botza.panscience.ai/), an AI chatbot that helps EdTech websites answer student questions about courses, fees and eligibility using their own information, even after hours. Thought it'd be good to connect!`,
  },
  {
    label: 'Follow-up 1', gapDays: 2,
    draft: `Thanks for connecting, {first_name}!

I wanted to share a quick look at what we're building at Botza.

It helps students get answers about courses, fees and eligibility directly on an institute's website, even when the admissions team isn't available.

Here's a short demo showing how it works:
${DEMO_VIDEO}

Curious to know if this could be useful for {company}.`,
  },
  {
    label: 'Follow-up 2', gapDays: 2,
    draft: `Hi {first_name},

Rather than just explaining Botza, I'd like you to try it yourself.

Here's a preview of our website chatbot:
{demo_link}

Try asking a question a student might have about course fees, eligibility or batches and see how Botza responds using the information provided.

Would love to hear your thoughts!
{{if_no_demo}}
Hi {first_name}, circling back on my previous message.

Students often have quick questions about course fees, eligibility or batches, and Botza helps them get answers directly on {company}'s website using your own information, even when the admissions team isn't available.

Here's a short brochure explaining how it works: https://drive.google.com/file/d/1wyguwXyBN-a34eI2-oJByXNVAhHtmtBF/view?usp=sharing

Would you be open to a quick 15-minute call to see whether this could work for {company}? Happy to work around your schedule.`,
  },
];

const roles = ['Founder', 'CEO', 'Head of Admissions', 'Head of Marketing', 'Head of Sales'];

module.exports = { emailSteps, linkedinSteps, roles };
