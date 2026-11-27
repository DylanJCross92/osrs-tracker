// The level-ups, 99s and big XP gains in the live feed, worked out from each player's saved snapshots.
//
// A snapshot is only saved when xp or levels changed, so a player who trains now and then (or updates their stats by hand) has snapshots days
// apart even though they are checked every day. What changed between two of them happened since the player was last checked, so a gap of a few
// days is normal and still counts. Only a long gap (old, sparse data) is left out, so it is never reported as something that "just" happened.
export const LEVEL_GAP_MS = 14 * 86_400_000
export const GAIN_GAP_MS = 7 * 86_400_000
export const BIG_GAIN_XP = 250_000

/**
 * rows: snapshots ordered by player, then time ({ player_id, captured_at, overall_xp, skills }). The first row of a player can be an older
 * baseline from before the feed's window: the first newer row is compared with it. byId: Map of the players that can appear in the feed.
 * Returns events (unsorted): levelup / max / gain, each with the days the change spans when that is more than a day and a half.
 */
export function activityEvents(rows, byId, windowStart = null) {
  const events = []
  let prev = null
  for (const row of rows) {
    const p = byId.get(row.player_id)
    if (!p) continue
    const gap = prev && prev.player_id === row.player_id ? row.captured_at - prev.captured_at : null
    // The baseline is only there to be compared with: what happened is reported at the newer snapshot, and only if that is inside the window.
    if (gap != null && gap > 0 && (windowStart == null || row.captured_at >= windowStart)) {
      const at = row.captured_at
      const days = gap > 1.5 * 86_400_000 ? Math.round(gap / 86_400_000) : null
      if (gap <= LEVEL_GAP_MS) {
        for (const [skill, s] of Object.entries(row.skills || {})) {
          const before = prev.skills?.[skill]?.level
          if (before != null && s.level > before) {
            events.push({ id: `lvl:${row.player_id}:${skill}:${s.level}`, kind: s.level >= 99 ? 'max' : 'levelup', playerId: p.id, skill, from: before, to: s.level, at, ...(days ? { days } : {}), ...(s.level >= 99 ? { cheer: { type: 'skill_level', value: 99 } } : {}) })
          }
        }
      }
      const gained = Number(row.overall_xp) - Number(prev.overall_xp)
      if (gap <= GAIN_GAP_MS && gained >= BIG_GAIN_XP) events.push({ id: `gain:${row.player_id}:${at.getTime()}`, kind: 'gain', playerId: p.id, xp: gained, at, ...(days ? { days } : {}) })
    }
    prev = row
  }
  return events
}
