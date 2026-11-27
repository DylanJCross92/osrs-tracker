// When the person who checks claims is usually around: 8am to 11pm Eastern time. Shown on the claim screen, converted to the
// visitor's own clock, so they know when a code is likely to be checked quickly.

export const CLAIM_HOURS = { zone: 'America/New_York', from: 8, to: 23, label: 'EST' }

/** { y, m, d, h, min } on the wall clock of `zone` at the moment `date` (m is 1-12). */
function wallClock(date, zone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  )
  return { y: parts.year, m: parts.month, d: parts.day, h: parts.hour, min: parts.minute }
}

/** The moment it is `hour`:00 on day y-m-d in `zone`. */
function instantIn(zone, y, m, d, hour) {
  const guess = Date.UTC(y, m - 1, d, hour)
  const w = wallClock(new Date(guess), zone)
  return new Date(guess - (Date.UTC(w.y, w.m - 1, w.d, w.h, w.min) - guess))
}

/** True while it is inside the usual hours (8:00 up to 23:00 Eastern). */
export function withinClaimHours(now = new Date(), hours = CLAIM_HOURS) {
  const h = wallClock(now, hours.zone).h
  return h >= hours.from && h < hours.to
}

const clock = (d) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

/** "5:00 AM to 8:00 PM" on the visitor's clock for today's usual hours, or '' when that is the same as the Eastern text (visitor is in Eastern time). */
export function hoursOnYourClock(now = new Date(), hours = CLAIM_HOURS) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (!zone || zone === hours.zone) return ''
  const w = wallClock(now, hours.zone)
  return `${clock(instantIn(hours.zone, w.y, w.m, w.d, hours.from))} to ${clock(instantIn(hours.zone, w.y, w.m, w.d, hours.to))}`
}

/** "8:00 AM to 11:00 PM EST" */
export const hoursText = (hours = CLAIM_HOURS) => {
  const t = (h) => `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`
  return `${t(hours.from)} to ${t(hours.to)} ${hours.label}`
}
