// Pure helpers behind the player comparison page (/compare/a/b). Everything is derived from the same snapshots and
// gain functions the profile page uses, so a comparison can never disagree with either player's own profile.
import { SKILL_NAMES, xpForSkill, levelForSkill, rankForSkill, xpGain, levelGain, rankGain } from '@/utils/osrsSkills'
import { gameDay, startOfGameDay, recentGameDays } from '@/utils/gameDay'

export const COMPARE_SKILLS = ['Overall', ...SKILL_NAMES]

/**
 * Gains only look at snapshots TickGains tracked itself. Imported history from before the player was added is
 * months apart and would turn a 7-day window into the whole gap (same rule as the profile page).
 */
export function trackedSnapshots(player, snapshots) {
  const created = player?.createdAt ? new Date(player.createdAt).getTime() - 60_000 : null
  const list = created == null ? snapshots : snapshots.filter((s) => new Date(s.capturedAt).getTime() >= created)
  return list.length ? list : snapshots
}

/**
 * Overall XP gained per game day (6 AM to 6 AM Eastern) for the last n days, oldest first. Each snapshot's gain is
 * credited to its own day, starting from the newest snapshot before the window, so a gap in older data can never be
 * dumped onto one day.
 */
export function dailyXp(snapshots, n, now = Date.now()) {
  const days = recentGameDays(n, now)
  const byDay = new Map()
  const cutoff = startOfGameDay(now - (n - 1) * 86_400_000)
  const firstInside = snapshots.findIndex((s) => new Date(s.capturedAt).getTime() >= cutoff)
  if (firstInside >= 0) {
    const windowSnaps = snapshots.slice(Math.max(firstInside - 1, 0))
    for (let i = 1; i < windowSnaps.length; i++) {
      const k = gameDay(windowSnaps[i].capturedAt)
      byDay.set(k, (byDay.get(k) || 0) + Math.max(windowSnaps[i].overallXp - windowSnaps[i - 1].overallXp, 0))
    }
  }
  return days.map((d) => ({ key: d.key, label: d.label, xp: byDay.get(d.key) || 0 }))
}

/** How many of the last n game days had any XP gained. */
export function activeDays(snapshots, n = 30, now = Date.now()) {
  return dailyXp(snapshots, n, now).filter((d) => d.xp > 0).length
}

/**
 * Consecutive game days with XP, counting back from today. Today does not break a streak while it is still in
 * progress, so a player who trained yesterday but has not logged in yet today keeps it.
 */
export function currentStreak(snapshots, now = Date.now()) {
  const days = dailyXp(snapshots, 60, now)
  let i = days.length - 1
  if (days[i] && days[i].xp === 0) i--
  let streak = 0
  while (i >= 0 && days[i].xp > 0) {
    streak++
    i--
  }
  return streak
}

const lead = (a, b, lowerWins = false) => {
  if (a == null || b == null || a === b) return null
  return (lowerWins ? a < b : a > b) ? 'a' : 'b'
}

/** One row per skill (Overall first) with each side's level, XP, rank and gain over the period, plus who is ahead. */
export function compareSkills(snapsA, snapsB, latestA, latestB, period) {
  return COMPARE_SKILLS.map((skill) => {
    const side = (tracked, latest) => ({
      level: levelForSkill(latest, skill),
      xp: xpForSkill(latest, skill),
      rank: rankForSkill(latest, skill),
      gain: xpGain(tracked, skill, period),
    })
    const a = side(snapsA, latestA)
    const b = side(snapsB, latestB)
    return { skill, a, b, winner: lead(a.gain, b.gain) }
  })
}

/** The headline rows of the comparison: label, each side's raw value, formatted text and who leads. */
export function compareHeadline(snapsA, snapsB, latestA, latestB, period) {
  const gainA = xpGain(snapsA, 'Overall', period)
  const gainB = xpGain(snapsB, 'Overall', period)
  const lvlA = levelGain(snapsA, 'Overall', period)
  const lvlB = levelGain(snapsB, 'Overall', period)
  const rkA = rankGain(snapsA, 'Overall', period)
  const rkB = rankGain(snapsB, 'Overall', period)
  const count99 = (s) => Object.values(s?.skills || {}).filter((x) => x.level >= 99).length
  const actA = activeDays(snapsA)
  const actB = activeDays(snapsB)
  const stkA = currentStreak(snapsA)
  const stkB = currentStreak(snapsB)
  const rankOf = (s) => (s?.overallRank > 0 ? s.overallRank : null)
  return [
    { key: 'gain', label: 'XP gained', a: gainA, b: gainB, kind: 'xp', winner: lead(gainA, gainB) },
    { key: 'levels', label: 'Levels gained', a: lvlA, b: lvlB, kind: 'levels', winner: lead(lvlA, lvlB) },
    { key: 'rankMove', label: 'Rank change', a: rkA, b: rkB, kind: 'rankMove', winner: lead(rkA, rkB) },
    { key: 'active', label: 'Active days (30)', a: actA, b: actB, kind: 'int', winner: lead(actA, actB) },
    { key: 'streak', label: 'Current streak', a: stkA, b: stkB, kind: 'days', winner: lead(stkA, stkB) },
    { key: 'xp', label: 'Total XP', a: latestA.overallXp, b: latestB.overallXp, kind: 'int', winner: lead(latestA.overallXp, latestB.overallXp) },
    { key: 'level', label: 'Overall level', a: latestA.overallLevel, b: latestB.overallLevel, kind: 'int', winner: lead(latestA.overallLevel, latestB.overallLevel) },
    { key: 'rank', label: 'Overall rank', a: rankOf(latestA), b: rankOf(latestB), kind: 'rank', winner: lead(rankOf(latestA), rankOf(latestB), true) },
    { key: '99s', label: 'Level 99 skills', a: count99(latestA), b: count99(latestB), kind: 'int', winner: lead(count99(latestA), count99(latestB)) },
  ]
}

/** Count of skills each side leads on for the period (Overall is not a skill, so it is left out). */
export function skillLeads(rows) {
  let a = 0
  let b = 0
  for (const r of rows) {
    if (r.skill === 'Overall') continue
    if (r.winner === 'a') a++
    else if (r.winner === 'b') b++
  }
  return { a, b }
}

/** Which headline rows belong under which heading on the page. */
export const HEADLINE_GROUPS = [
  { title: 'Gains', keys: ['gain', 'levels', 'rankMove'] },
  { title: 'Consistency', keys: ['active', 'streak'] },
  { title: 'Standing', keys: ['xp', 'level', 'rank', '99s'] },
]

/**
 * How long each side's bar is, 0 to 1, relative to the bigger side of that row. For the overall rank a lower number
 * is better, so the better rank gets the full bar and the other side a bar scaled by how close it is.
 */
export function barShare(row) {
  const a = row.a
  const b = row.b
  if (row.key === 'rank') {
    if (!(a > 0) || !(b > 0)) return { a: a > 0 ? 1 : 0, b: b > 0 ? 1 : 0 }
    const best = Math.min(a, b)
    return { a: best / a, b: best / b }
  }
  const pa = Math.max(Number(a) || 0, 0)
  const pb = Math.max(Number(b) || 0, 0)
  const max = Math.max(pa, pb)
  if (max === 0) return { a: 0, b: 0 }
  return { a: pa / max, b: pb / max }
}

/** How many headline rows each side leads. */
export function roundsWon(rows) {
  let a = 0
  let b = 0
  for (const r of rows) {
    if (r.winner === 'a') a++
    else if (r.winner === 'b') b++
  }
  return { a, b, total: rows.length }
}

/** The skill (not Overall) one side gained the most XP in over the period, or null if none. */
export function topGainSkill(rows, side) {
  let best = null
  for (const r of rows) {
    if (r.skill === 'Overall') continue
    const gain = r[side].gain
    if (gain > 0 && (!best || gain > best.gain)) best = { skill: r.skill, gain }
  }
  return best
}

/** The single biggest game day in the last n days, or null if the player gained nothing. */
export function bestDay(snapshots, n = 30, now = Date.now()) {
  let best = null
  for (const d of dailyXp(snapshots, n, now)) if (d.xp > 0 && (!best || d.xp > best.xp)) best = { key: d.key, xp: d.xp }
  return best
}

/** Skill rows with some gain, sorted for display: by combined XP, by size of the gap, or in hiscores order. */
export function sortSkillRows(rows, mode = 'total') {
  const skills = rows.filter((r) => r.skill !== 'Overall')
  const active = skills.filter((r) => r.a.gain > 0 || r.b.gain > 0)
  const idle = skills.filter((r) => !(r.a.gain > 0 || r.b.gain > 0))
  const key = {
    total: (r) => -(r.a.gain + r.b.gain),
    gap: (r) => -Math.abs(r.a.gain - r.b.gain),
    skill: () => 0,
  }[mode]
  const sorted = mode === 'skill' ? active : [...active].sort((x, y) => key(x) - key(y))
  return { active: sorted, idle }
}

/** Text for one headline value, by the row's kind. */
export function formatCompareValue(kind, v) {
  if (v == null) return '-'
  switch (kind) {
    case 'xp':
      return v > 0 ? `+${v.toLocaleString('en-US')}` : '-'
    case 'levels':
      return v > 0 ? `+${v}` : '-'
    case 'rankMove':
      return v > 0 ? `▲ ${v.toLocaleString('en-US')}` : v < 0 ? `▼ ${Math.abs(v).toLocaleString('en-US')}` : '-'
    case 'days':
      return v === 1 ? '1 day' : `${v} days`
    default:
      return v ? v.toLocaleString('en-US') : v === 0 ? '0' : '-'
  }
}
