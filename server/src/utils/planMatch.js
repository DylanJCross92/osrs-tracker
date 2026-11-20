// Finds whose saved plan a shared planner link most likely came from. The browser records a short code for the plan in the link
// (goalsCode in src/utils/goalsCode.js, which this must match); here the same code is worked out for the plans people have saved.
// Only for the site owner's visitor timeline. Matching is by skills and target XP, so a very common plan can match several people.

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

/** Every goal list a person has: each saved plan and the planner left in progress. `plans` and `planner` may be wrapped as { value }. */
function goalLists(plans, planner) {
  const saved = Array.isArray(plans?.value) ? plans.value : Array.isArray(plans) ? plans : []
  const draft = planner?.value || planner
  const lists = saved.filter((p) => p && Array.isArray(p.goals)).map((p) => p.goals)
  if (draft && Array.isArray(draft.goals)) lists.push(draft.goals)
  return lists
}

/**
 * The people whose plans carry this code: [{ key, label }] with keys like the visitor list ('a:7' for an account, 'v:<id>' for a
 * browser). accounts: [{ id, email, plans, planner }], visitors: [{ id, plans, planner }]. `skipKey` is the person being looked at,
 * who may have saved the plan after opening it.
 */
export function findPlanOwners(fingerprint, accounts = [], visitors = [], skipKey = '') {
  if (!fingerprint) return []
  const out = []
  const has = (a) => goalLists(a.plans, a.planner).some((goals) => goalsCode(goals) === fingerprint)
  for (const a of accounts) {
    const key = `a:${a.id}`
    if (key !== skipKey && has(a)) out.push({ key, label: a.email || `Account ${a.id}` })
  }
  for (const v of visitors) {
    const key = `v:${v.id}`
    if (key !== skipKey && /^[a-f0-9]{32}$/.test(String(v.id)) && has(v)) out.push({ key, label: `Visitor ${String(v.id).slice(0, 6)}` })
  }
  return out
}

/** How the owners read in the timeline: "Visitor ab12cd, a@b.com and 2 more". */
export function describeOwners(owners, shown = 3) {
  const names = owners.slice(0, shown).map((o) => o.label)
  const more = owners.length - names.length
  return names.join(', ') + (more > 0 ? ` and ${more} more` : '')
}
