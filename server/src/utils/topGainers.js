// "Top gainer today" history. Pure (no database, no clock unless passed), so the profile card and the share image read
// the same numbers and the maths can be tested on its own.
// A day is the 6 AM to 6 AM Eastern game day used everywhere else on the site (see dates.js).
import { diffDays } from './dates.js'

/**
 * The player who has gained the most XP: { player, xp, topSkill }, or null while nobody has gained any. `period` is 'day' (so far today,
 * 6 AM to 6 AM, which the daily tally uses) or 'h24' (the last 24 hours, which the Discover card shows).
 */
export function pickTopGainer(players, period = 'day') {
  let top = null
  for (const p of players) {
    const xp = p.gains?.[period]?.xp
    // A tie keeps whoever is listed first (the list is already sorted by gain).
    if (xp > 0 && (!top || xp > top.xp)) top = { player: p, xp, topSkill: p.gains[period].topSkill || null }
  }
  return top
}

/** How long as a figure and a word: { unit, value, display, label, text }. Under an hour reads "<1 hour". */
export function tenureOf(unit, value) {
  const n = Math.max(0, Math.floor(value))
  const display = unit === 'hours' && n === 0 ? '<1' : n.toLocaleString('en-US')
  const label = unit === 'hours' ? (n <= 1 ? 'hour' : 'hours') : n === 1 ? 'day' : 'days'
  return { unit, value: n, display, label, text: `${display} ${label}` }
}

/**
 * The days one player was the top gainer, summed up.
 * rows: [{ day: 'YYYY-MM-DD', xp, since? }] in any order (since: when that day's lead began); today: 'YYYY-MM-DD'.
 * Returns { days: 0 } for none, otherwise { days, streak, longest, bestXp, bestDay, firstDay, lastDay, leadingNow, tenure, headline }.
 * streak is the run of days in a row up to today or yesterday (a day still in progress does not break it).
 * tenure is how long the lead has lasted right now (null when they are not leading): in hours while it is under a day, in
 * days once it has run across days. headline is the figure to lead with: the hours for someone on their first day, else the total days.
 */
export function summarizeTopGainer(rows, today, now = Date.now()) {
  const list = [...rows].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
  if (!list.length) return { days: 0 }

  let longest = 1
  let run = 1
  for (let i = 1; i < list.length; i++) {
    run = diffDays(list[i - 1].day, list[i].day) === 1 ? run + 1 : 1
    if (run > longest) longest = run
  }
  const last = list[list.length - 1]
  const best = list.reduce((top, r) => (r.xp > top.xp ? r : top), list[0])
  const active = diffDays(last.day, today) <= 1
  const leadingNow = last.day === today

  let tenure = null
  if (leadingNow) {
    const since = last.since ? new Date(last.since).getTime() : NaN
    if (run >= 2) tenure = tenureOf('days', run)
    else if (Number.isFinite(since)) tenure = tenureOf('hours', (now - since) / 3_600_000)
    else tenure = tenureOf('days', 1)
  }
  const headline = tenure && tenure.unit === 'hours' && list.length === 1 ? tenure : tenureOf('days', list.length)

  return {
    days: list.length,
    streak: active ? run : 0,
    longest,
    bestXp: best.xp,
    bestDay: best.day,
    firstDay: list[0].day,
    lastDay: last.day,
    leadingNow,
    tenure,
    headline,
  }
}

/** The stats in one phrase, for share text and link previews: "12 days as top gainer" or "3 hours as top gainer". */
export function topGainerHeadline(stats) {
  return `${stats.headline ? stats.headline.text : tenureOf('days', stats.days).text} as top gainer`
}
