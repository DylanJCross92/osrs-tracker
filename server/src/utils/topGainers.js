// "Top gainer today" history. Pure (no database, no clock unless passed), so the profile card and the share image read
// the same numbers and the maths can be tested on its own.
// A day is the 6 AM to 6 AM Eastern game day used everywhere else on the site (see dates.js).
import { diffDays } from './dates.js'

/** The player who has gained the most XP so far today: { player, xp, topSkill }, or null while nobody has gained any. */
export function pickTopGainer(players) {
  let top = null
  for (const p of players) {
    const xp = p.gains?.day?.xp
    // A tie keeps whoever is listed first (the list is already sorted by gain).
    if (xp > 0 && (!top || xp > top.xp)) top = { player: p, xp, topSkill: p.gains.day.topSkill || null }
  }
  return top
}

/**
 * The days one player was the top gainer, summed up.
 * rows: [{ day: 'YYYY-MM-DD', xp }] in any order; today: 'YYYY-MM-DD'.
 * Returns { days: 0 } for none, otherwise { days, streak, longest, bestXp, bestDay, firstDay, lastDay, leadingNow }.
 * streak is the run of days in a row up to today or yesterday (a day still in progress does not break it).
 */
export function summarizeTopGainer(rows, today) {
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
  return {
    days: list.length,
    streak: active ? run : 0,
    longest,
    bestXp: best.xp,
    bestDay: best.day,
    firstDay: list[0].day,
    lastDay: last.day,
    leadingNow: last.day === today,
  }
}

/** The stats in one phrase, for share text and link previews: "12 days as top gainer". */
export function topGainerHeadline(stats) {
  return `${stats.days.toLocaleString('en-US')} ${stats.days === 1 ? 'day' : 'days'} as top gainer`
}
