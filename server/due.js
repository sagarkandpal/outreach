// All due-date logic lives here.
const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayDiff(a, b) {
  // whole calendar days from b to a (a - b)
  return Math.round((startOfDay(a) - startOfDay(b)) / DAY);
}

/**
 * Cells for one track (email or linkedin) of one contact.
 * state: sent | due | overdue | wait | locked | stopped
 */
function trackCells(sent, steps, status, now = new Date()) {
  const active = status === 'active';
  return steps.map((step, i) => {
    if (i < sent.length) return { state: 'sent', date: sent[i] };
    if (!active) return { state: 'stopped' };
    if (i > sent.length) return { state: 'locked' };
    // next step to send
    if (i === 0) return { state: 'due', days: 0 };
    const dueDay = new Date(startOfDay(sent[i - 1]).getTime() + step.gapDays * DAY);
    const diff = dayDiff(now, dueDay); // >0 overdue, 0 today, <0 in future
    if (diff > 0) return { state: 'overdue', days: diff, dueAt: dueDay };
    if (diff === 0) return { state: 'due', days: 0, dueAt: dueDay };
    return { state: 'wait', days: -diff, dueAt: dueDay };
  });
}

function decorate(contact, settings, now = new Date()) {
  const c = contact.toObject ? contact.toObject() : contact;
  c.emailCells = trackCells(c.emailSent, settings.emailSteps, c.status, now);
  c.linkedinCells = trackCells(c.linkedinSent, settings.linkedinSteps, c.status, now);
  return c;
}

module.exports = { trackCells, decorate, startOfDay };
