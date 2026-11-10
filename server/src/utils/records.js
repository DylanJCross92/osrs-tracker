// Personal records, worked out from a player's saved snapshots. Pure (no database, no clock unless passed), so the
// profile tab and the share images read the same numbers and the maths can be tested on its own.
//
// Only snapshots TickGains tracked itself are used, the same rule as the profile's gains and the compare page:
// history imported from before the player was added is far apart in time and would turn a whole gap into one "day".
// A "day" is the 6 AM to 6 AM Eastern game day used everywhere else on the site.
import { localDay, addDays, diffDays } from './dates.js'

export const WEEK_DAYS = 7
export const MONTH_DAYS = 30
// A record needs a little history behind it to mean something as a "record".
const FRESH_MIN_TRACKED_DAYS = 5

/** "4.2M" / "12.3K" / "850" (same shortening as formatXp in the card renderer and the site). */
function shortXp(xp) {
  const n = Number(xp) || 0
  if (n >= 1_000_000) return `${parseFloat((n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2))}M`
  if (n >= 1_000) return `${parseFloat((n / 1_000).toFixed(1))}K`
  return String(Math.round(n))
}

/** The record in one phrase, used for share text and link previews: "3.79M XP in a single day". */
export function recordHeadline(r) {
  const n = r.value.toLocaleString('en-US')
  switch (r.key) {
    case 'best-day':
      return `${shortXp(r.value)} XP in a single day`
    case 'best-week':
      return `${shortXp(r.value)} XP in 7 days`
    case 'best-month':
      return `${shortXp(r.value)} XP in 30 days`
    case 'longest-streak':
      return `${n} days in a row`
    case 'most-levels-day':
      return `${n} ${r.value === 1 ? 'level' : 'levels'} in a single day`
    case 'most-skills-day':
      return `${n} skills trained in a single day`
    default:
      return `${shortXp(r.value)} ${r.skill} XP in a single day`
  }
}

const msOf = (t) => new Date(t).getTime()
const slug = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const skillRecordKey = (skill) => `skill-${slug(skill)}`

/** Snapshots from the time the player was added onwards (a minute of slack), or all of them if that leaves none. */
export function trackedRows(rows, createdAt) {
  const created = createdAt ? msOf(createdAt) - 60_000 : null
  const list = created == null ? rows : rows.filter((r) => msOf(r.capturedAt) >= created)
  return list.length ? list : rows
}

/** What was gained on each game day: { xp, levels, skills: { name: xp } }, keyed 'YYYY-MM-DD'. */
function dayTotals(rows) {
  const days = new Map()
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]
    const cur = rows[i]
    const key = localDay(cur.capturedAt)
    const day = days.get(key) || { xp: 0, levels: 0, skills: {} }
    day.xp += Math.max(cur.overallXp - prev.overallXp, 0)
    for (const [name, s] of Object.entries(cur.skills || {})) {
      const before = prev.skills?.[name]
      if (!before) continue
      const gained = Math.max(s.xp - before.xp, 0)
      if (gained > 0) day.skills[name] = (day.skills[name] || 0) + gained
      day.levels += Math.max((s.level || 0) - (before.level || 0), 0)
    }
    days.set(key, day)
  }
  return days
}

/** Highest value in a list of { value, ... } (the earliest one wins a tie, it was set first). */
function best(list) {
  let top = null
  for (const item of list) if (item.value > 0 && (!top || item.value > top.value)) top = item
  return top
}

const topSkillOf = (day) => {
  let name = null
  let xp = 0
  for (const [n, v] of Object.entries(day?.skills || {})) {
    if (v > xp) {
      xp = v
      name = n
    }
  }
  return name ? { skill: name, xp } : null
}

/**
 * Every personal record for a player.
 * rows: snapshots oldest first, { capturedAt, overallXp, overallLevel, skills: { Name: { xp, level } } }.
 * Returns { since, trackedDays, today, records }, where each record is
 * { key, group, title, unit, value, skill, start, end, detail, current, pct, fresh, locked, unlockHint }.
 */
export function computeRecords(rows, { createdAt = null, now = Date.now() } = {}) {
  const tracked = trackedRows(rows, createdAt)
  const today = localDay(now)
  if (tracked.length < 2) return { since: tracked[0] ? localDay(tracked[0].capturedAt) : null, trackedDays: 0, today, records: [] }

  const since = localDay(tracked[0].capturedAt)
  const trackedDays = diffDays(since, today) + 1
  const totals = dayTotals(tracked)

  // A contiguous list of every game day from the first tracked day to today (days with no snapshot gained nothing).
  const days = []
  for (let i = 0; i < trackedDays; i++) {
    const key = addDays(since, i)
    days.push({ key, ...(totals.get(key) || { xp: 0, levels: 0, skills: {} }) })
  }
  const last = days[days.length - 1]
  const dayOf = (key) => days.find((d) => d.key === key)

  const records = []
  const fresh = (end) => trackedDays >= FRESH_MIN_TRACKED_DAYS && diffDays(end, today) <= 1

  // Biggest single day.
  const bestDay = best(days.map((d) => ({ value: d.xp, end: d.key })))
  if (bestDay) {
    const top = topSkillOf(dayOf(bestDay.end))
    records.push({
      key: 'best-day',
      group: 'headline',
      title: 'Biggest day',
      unit: 'xp',
      value: bestDay.value,
      start: bestDay.end,
      end: bestDay.end,
      detail: top ? { skill: top.skill, xp: top.xp, kind: 'top-skill' } : null,
      current: { value: last.xp, label: 'today so far' },
    })
  }

  // Biggest rolling 7 and 30 day stretches. They stay locked until that much history exists.
  const windowRecord = (key, title, span, label) => {
    if (trackedDays < span) {
      records.push({ key, group: 'headline', title, unit: 'xp', value: 0, locked: true, unlockHint: `Unlocks after ${span} days of tracking`, current: null })
      return
    }
    let sum = 0
    for (let i = 0; i < span; i++) sum += days[i].xp
    let topSum = sum
    let topEnd = span - 1
    for (let i = span; i < days.length; i++) {
      sum += days[i].xp - days[i - span].xp
      if (sum > topSum) {
        topSum = sum
        topEnd = i
      }
    }
    if (topSum <= 0) return
    const recent = days.slice(-span).reduce((n, d) => n + d.xp, 0)
    records.push({
      key,
      group: 'headline',
      title,
      unit: 'xp',
      value: topSum,
      start: days[topEnd - span + 1].key,
      end: days[topEnd].key,
      detail: null,
      current: { value: recent, label },
    })
  }
  windowRecord('best-week', 'Biggest week', WEEK_DAYS, 'last 7 days')
  windowRecord('best-month', 'Biggest 30 days', MONTH_DAYS, 'last 30 days')

  // Longest run of days in a row with XP gained. A day still in progress does not break the current run.
  let runStart = null
  let longest = { value: 0, start: null, end: null }
  let current = 0
  days.forEach((d, i) => {
    if (d.xp > 0) {
      if (runStart == null) runStart = i
      const len = i - runStart + 1
      if (len > longest.value) longest = { value: len, start: days[runStart].key, end: d.key }
    } else {
      runStart = null
    }
  })
  let j = days.length - 1
  if (days[j].xp === 0) j--
  while (j >= 0 && days[j].xp > 0) {
    current++
    j--
  }
  if (longest.value > 0) {
    records.push({
      key: 'longest-streak',
      group: 'headline',
      title: 'Longest streak',
      unit: 'days',
      value: longest.value,
      start: longest.start,
      end: longest.end,
      detail: null,
      current: { value: current, label: 'current streak' },
    })
  }

  // Most levels gained in a day.
  const levelDay = best(days.map((d) => ({ value: d.levels, end: d.key })))
  if (levelDay) {
    records.push({
      key: 'most-levels-day',
      group: 'headline',
      title: 'Most levels in a day',
      unit: 'levels',
      value: levelDay.value,
      start: levelDay.end,
      end: levelDay.end,
      detail: null,
      current: { value: last.levels, label: 'today so far' },
    })
  }

  // Most different skills trained in a day (one skill is not much of a record).
  const widest = best(days.map((d) => ({ value: Object.keys(d.skills).length, end: d.key })))
  if (widest && widest.value >= 2) {
    records.push({
      key: 'most-skills-day',
      group: 'headline',
      title: 'Most skills trained in a day',
      unit: 'skills',
      value: widest.value,
      start: widest.end,
      end: widest.end,
      detail: null,
      current: { value: Object.keys(last.skills).length, label: 'today so far' },
    })
  }

  // Best day in each skill.
  const skillNames = new Set()
  for (const d of days) for (const n of Object.keys(d.skills)) skillNames.add(n)
  const skillRecords = []
  for (const name of skillNames) {
    const top = best(days.map((d) => ({ value: d.skills[name] || 0, end: d.key })))
    if (!top) continue
    skillRecords.push({
      key: skillRecordKey(name),
      group: 'skill',
      title: `${name} best day`,
      unit: 'xp',
      value: top.value,
      skill: name,
      start: top.end,
      end: top.end,
      detail: null,
      current: { value: last.skills[name] || 0, label: 'today so far' },
    })
  }
  skillRecords.sort((a, b) => b.value - a.value)
  records.push(...skillRecords)

  for (const r of records) {
    if (r.locked) continue
    r.pct = r.value > 0 && r.current ? Math.min(r.current.value / r.value, 1) : 0
    r.fresh = fresh(r.end)
    r.headline = recordHeadline(r)
  }

  return { since, trackedDays, today, records }
}
