// The create-competition form: its choices, how they turn into what the server wants, and the words for how long is left.
// The same rules as the server's, so a mistake shows before anything is sent.

const HOUR = 3_600_000
const DAY = 24 * HOUR
export const MIN_HOURS = 1
export const MAX_DAYS = 60
export const MAX_AHEAD_DAYS = 90

// Quick ways to set the end from the start.
export const LENGTHS = [
  { key: '1d', label: '1 day', ms: DAY },
  { key: '3d', label: '3 days', ms: 3 * DAY },
  { key: '7d', label: '1 week', ms: 7 * DAY },
  { key: '14d', label: '2 weeks', ms: 14 * DAY },
]
// A start this close to now (or a little before it) simply means "now".
const NOW_WINDOW_MS = 60_000
const GRACE_MS = 5 * 60_000

// --- Skill of the Week ---------------------------------------------------------------------------------------------------
// One skill is featured each week (Monday to Sunday, on the viewer's clock), the same for everyone. It walks through every
// skill in a scrambled but fixed order, so it never repeats until all of them have had a turn.
const gcd = (a, b) => (b ? gcd(b, a % b) : a)

/** Midnight at the start of the Monday of the week this date falls in. */
export function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

/** Midnight at the start of the Monday after this date's week. */
export function nextMonday(d) {
  const m = mondayOf(d)
  m.setDate(m.getDate() + 7)
  return m
}

/** The featured skill for the week this date falls in. `skills` is the list to choose from. */
export function skillOfTheWeek(skills, d = new Date()) {
  const n = skills.length
  const m = mondayOf(d)
  const week = Math.floor(Date.UTC(m.getFullYear(), m.getMonth(), m.getDate()) / (7 * DAY))
  const step = [7, 5, 11, 13, 3, 1].find((k) => gcd(k, n) === 1)
  return skills[(week * step) % n]
}

export const sotwTitle = (skill) => `Skill of the Week: ${skill}`

/** Sets the form up as a Skill of the Week: that skill, a week long, starting now or at the next Monday midnight. */
export function applySotw(form, skill, startMode = 'now', now = new Date()) {
  form.metric = 'skill_xp'
  form.skill = skill
  form.title = sotwTitle(skill)
  if (startMode === 'monday') {
    const start = nextMonday(now)
    form.startDate = toDateInput(start)
    form.startTime = toTimeInput(start)
  } else {
    setStartNow(form, now)
  }
  applyLength(form, 7 * DAY, now)
}

/** A sensible title to start from: "Mining XP race" or "Overall XP race". */
export function defaultTitle(metric, skill) {
  return metric === 'overall_xp' ? 'Overall XP race' : `${skill || 'Skill'} XP race`
}

const pad = (n) => String(n).padStart(2, '0')
/** The date part of a date and time, as the value of a date input (the person's own clock). */
export const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** The time part, as the value of a time input. */
export const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** A date and a time from the two inputs, as a Date, or null when either is empty or not a real moment. */
export function joinLocal(date, time) {
  if (!date || !time) return null
  const d = new Date(`${date}T${time}`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** The form to start from: starts now, runs a week. */
export function blankForm(now = new Date()) {
  const end = new Date(now.getTime() + 7 * DAY)
  return {
    title: defaultTitle('skill_xp', 'Mining'),
    metric: 'skill_xp',
    skill: 'Mining',
    startDate: toDateInput(now),
    startTime: toTimeInput(now),
    endDate: toDateInput(end),
    endTime: toTimeInput(end),
  }
}

/** Sets the start fields to this moment. */
export function setStartNow(form, now = new Date()) {
  form.startDate = toDateInput(now)
  form.startTime = toTimeInput(now)
}

/** Sets the end to a chosen length after the start (or after now, when the start is not filled in yet). */
export function applyLength(form, ms, now = new Date()) {
  const start = joinLocal(form.startDate, form.startTime) || now
  const end = new Date(Math.max(start.getTime(), now.getTime()) + ms)
  form.endDate = toDateInput(end)
  form.endTime = toTimeInput(end)
}

/**
 * Turns the form into the request body. form: { title, metric, skill, startDate, startTime, endDate, endTime } (the person's
 * own clock). Returns { ok: true, body, startsAt, endsAt } or { ok: false, error }.
 */
export function buildCompetitionBody(form, now = new Date()) {
  const title = String(form.title || '').replace(/\s+/g, ' ').trim()
  if (title.length < 3) return { ok: false, error: 'Give the competition a title of at least 3 characters.' }
  if (form.metric !== 'skill_xp' && form.metric !== 'overall_xp') return { ok: false, error: 'Choose what is being measured.' }
  if (form.metric === 'skill_xp' && !form.skill) return { ok: false, error: 'Choose a skill.' }

  let startsAt = joinLocal(form.startDate, form.startTime)
  if (!startsAt) return { ok: false, error: 'Choose the start date and time.' }
  if (startsAt.getTime() < now.getTime() - GRACE_MS) return { ok: false, error: 'The start has already passed. Pick a time from now on.' }
  if (startsAt.getTime() <= now.getTime() + NOW_WINDOW_MS) startsAt = new Date(now)
  if (startsAt.getTime() > now.getTime() + MAX_AHEAD_DAYS * DAY) return { ok: false, error: `Start within the next ${MAX_AHEAD_DAYS} days.` }

  const endsAt = joinLocal(form.endDate, form.endTime)
  if (!endsAt) return { ok: false, error: 'Choose the end date and time.' }
  if (endsAt.getTime() <= startsAt.getTime()) return { ok: false, error: 'The end has to come after the start.' }
  if (endsAt.getTime() - startsAt.getTime() < MIN_HOURS * HOUR) return { ok: false, error: `A competition has to run for at least ${MIN_HOURS} hour.` }
  if (endsAt.getTime() - startsAt.getTime() > MAX_DAYS * DAY) return { ok: false, error: `A competition can run for at most ${MAX_DAYS} days.` }

  return {
    ok: true,
    startsAt,
    endsAt,
    body: { title, metric: form.metric, skill: form.metric === 'skill_xp' ? form.skill : '', startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
  }
}

/** A date and time spelled out: "Sat, Nov 15, 7:30 PM", with the year only when it is not this year. */
export function fullDateTime(d, now = new Date()) {
  const date = new Date(d)
  const opts = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
  if (date.getFullYear() !== now.getFullYear()) opts.year = 'numeric'
  return date.toLocaleString(undefined, opts)
}

/** How long the competition runs, in words: "7 days", "1 day 12 hours", "36 hours". */
export function lengthText(ms) {
  const hours = Math.round(ms / HOUR)
  if (hours < 48 && hours % 24 !== 0) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.floor(hours / 24)
  const rest = hours % 24
  return `${days} day${days === 1 ? '' : 's'}${rest ? ` ${rest} hour${rest === 1 ? '' : 's'}` : ''}`
}

/** What the chosen window says, for the summary under the form. */
export function describeWindow(startsAt, endsAt, now = new Date()) {
  const rightAway = startsAt.getTime() <= now.getTime() + NOW_WINDOW_MS
  return {
    rightAway,
    startText: rightAway ? 'Right away' : fullDateTime(startsAt, now),
    startNote: rightAway ? 'when you press the button' : `in ${durationText(startsAt.getTime() - now.getTime())}`,
    endText: fullDateTime(endsAt, now),
    length: lengthText(endsAt.getTime() - startsAt.getTime()),
  }
}

/** "2d 5h", "5h 12m", "12m", "under a minute" for a number of milliseconds. */
export function durationText(ms) {
  const total = Math.floor(Math.max(ms, 0) / 60_000)
  if (total < 1) return 'under a minute'
  const d = Math.floor(total / 1440)
  const h = Math.floor((total % 1440) / 60)
  const m = total % 60
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

/** What the clock says about a competition: how long until it starts or ends, or that it is over. */
export function clockText(c, now = Date.now()) {
  const start = new Date(c.startsAt).getTime()
  const end = new Date(c.endsAt).getTime()
  if (c.status === 'cancelled') return 'Cancelled'
  if (c.status === 'finished') return `Ended ${new Date(c.endsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
  if (c.status === 'scheduled' || now < start) return `Starts in ${durationText(start - now)}`
  if (now >= end) return 'Finishing up: taking the final numbers'
  return `Ends in ${durationText(end - now)}`
}
