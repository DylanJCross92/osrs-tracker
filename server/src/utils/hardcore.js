// Pure rules for Hardcore Worlds characters (see services/hardcore.service.js). The official hiscores never say a character died, so what happened
// is worked out by comparing what the table shows now with the last thing we saw.

const HOUR_MS = 3_600_000
// A character has to be missing on two checks at least this far apart before it is called gone, so one flaky answer never marks anyone as having left.
export const MISS_GAP_MS = 20 * HOUR_MS

/**
 * True when a Hardcore Worlds character started again from nothing (a Reset after dying): any skill, or the overall total, now has LESS xp than the
 * last snapshot, which can never happen while a character just keeps playing. `prev` is the last snapshot row ({ overall_xp, skills }) and `stats` what the
 * hiscores show now ({ overall: { xp }, skills }). A first snapshot (no prev) is never a reset.
 */
export function detectLifeChange(prev, stats) {
  if (!prev || !stats) return false
  if (Number(stats.overall?.xp) < Number(prev.overall_xp)) return true
  for (const [name, skill] of Object.entries(stats.skills || {})) {
    const before = prev.skills?.[name]?.xp
    if (Number.isFinite(before) && skill.xp < before) return true
  }
  return false
}

/**
 * One more check where the table did not have the character. Returns the new { misses, missAt } and whether it is now gone ('left'): the first miss only
 * counts; a second one at least MISS_GAP_MS after the first confirms it. A miss sooner than that changes nothing.
 */
export function nextMiss({ misses = 0, missAt = null } = {}, now = new Date()) {
  const at = missAt ? new Date(missAt).getTime() : null
  if (!misses || at == null) return { misses: 1, missAt: now, left: false }
  if (now.getTime() - at >= MISS_GAP_MS) return { misses: misses + 1, missAt: new Date(at), left: true }
  return { misses, missAt: new Date(at), left: false }
}

/** What a finished life keeps: the total it reached and its three best skills, so the milestones can be cleared for the next life. */
export function lifeSummary(snapshot, timeline = []) {
  const skills = Object.entries(snapshot?.skills || {})
    .map(([skill, s]) => ({ skill, level: s.level, xp: s.xp }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 3)
  return { topSkills: skills, milestones: timeline.slice(0, 40) }
}
