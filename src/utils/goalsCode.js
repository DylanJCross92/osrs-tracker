// A short code for what a plan is aiming at: which skills, to which XP. The same goals always give the same code, in any order,
// and the code says nothing readable about the plan. The site records it when someone opens a shared planner link, and the server
// (server/src/utils/planMatch.js, whose goalsCode must stay the same) looks for saved plans with the same code, so the owner can see
// whose plan a link most likely came from. Where the plan starts is left out because it moves as the sharer plays.

/** The code for a list of goals ({ skill, targetXp }), or '' when there is nothing to describe. */
export function goalsCode(goals) {
  const parts = (Array.isArray(goals) ? goals : [])
    .filter((g) => g && typeof g.skill === 'string' && Number.isFinite(Number(g.targetXp)) && Number(g.targetXp) > 0)
    .map((g) => `${g.skill}:${Math.round(Number(g.targetXp))}`)
    .sort()
  if (!parts.length) return ''
  // FNV-1a, 32 bits.
  let h = 0x811c9dc5
  for (const ch of parts.join(',')) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
