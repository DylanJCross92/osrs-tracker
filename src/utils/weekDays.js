// XP gained per game day (6 AM to 6 AM Eastern) over the last 7 days, oldest first, shared by the profile's Overview and the
// dashboard. Each snapshot's gain is credited to its own day, starting from the newest snapshot before the window, so the
// days add up to the same 7-day total as the stats table and a gap in older data can never be dumped onto one day.
// `snapshots` are the player's tracked snapshots, oldest first. Returns [] when there is not enough to draw.
import { gameDay, recentGameDays, startOfGameDay } from '@/utils/gameDay'
import { SKILL_NAMES, levelForSkill, xpForSkill } from '@/utils/osrsSkills'

// The snapshots the week is measured from: the newest one before the window (the starting point) and everything inside it.
function windowSnapshots(list, now) {
  const cutoff = startOfGameDay(now - 6 * 86_400_000)
  const firstInside = list.findIndex((s) => new Date(s.capturedAt).getTime() >= cutoff)
  if (firstInside < 0) return []
  return list.slice(Math.max(firstInside - 1, 0))
}

/**
 * How many days of real time the week's gains cover, for working out a pace. A game day resets at 6 AM, so counting seven
 * days would make a morning look like a day of nothing: instead the gains are divided by the time from the starting snapshot
 * to the newest one, so the pace holds steady through the day and moves a little with every hour played. At least one day
 * (a pace over a few hours is not worth much) and at most two weeks. Null when there is not enough to measure.
 */
export function paceSpanDays(snapshots, now = Date.now()) {
  const w = windowSnapshots(snapshots, now)
  if (w.length < 2) return null
  const span = (new Date(w[w.length - 1].capturedAt).getTime() - new Date(w[0].capturedAt).getTime()) / 86_400_000
  return Math.min(Math.max(span, 1), 14)
}

export function weekDaysFrom(snapshots, now = Date.now()) {
  const days = recentGameDays(7, now)
  const windowSnaps = windowSnapshots(snapshots, now)
  if (windowSnaps.length < 2) return []
  const byDay = new Map()
  const skillsByDay = new Map()
  for (let i = 1; i < windowSnaps.length; i++) {
    const k = gameDay(windowSnaps[i].capturedAt)
    byDay.set(k, (byDay.get(k) || 0) + Math.max(windowSnaps[i].overallXp - windowSnaps[i - 1].overallXp, 0))
    const per = skillsByDay.get(k) || {}
    for (const name of SKILL_NAMES) {
      if (name === 'Overall') continue
      const gained = xpForSkill(windowSnaps[i], name) - xpForSkill(windowSnaps[i - 1], name)
      const levels = Math.max(levelForSkill(windowSnaps[i], name) - levelForSkill(windowSnaps[i - 1], name), 0)
      if (gained <= 0 && levels <= 0) continue
      const cur = per[name] || { skill: name, xp: 0, levels: 0 }
      cur.xp += Math.max(gained, 0)
      cur.levels += levels
      // Level and total XP as of the day's last snapshot (this loop runs oldest to newest, so the last write wins).
      cur.level = levelForSkill(windowSnaps[i], name)
      cur.total = xpForSkill(windowSnaps[i], name)
      per[name] = cur
    }
    skillsByDay.set(k, per)
  }
  // Every skill that gained that day, biggest first. The chart's hover box shows the top two, the day recap all of them.
  const skillsOf = (k) => Object.values(skillsByDay.get(k) || {}).filter((x) => x.xp > 0 || x.levels > 0).sort((a, b) => b.xp - a.xp)
  return days.map((d) => {
    const skills = skillsOf(d.key)
    return { key: d.key, label: d.label, xp: byDay.get(d.key) || 0, skills, topSkills: skills.slice(0, 2) }
  })
}
