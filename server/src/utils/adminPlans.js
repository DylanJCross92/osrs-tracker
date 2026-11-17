// The planner plans that accounts have saved, gathered by player name for the admin page. Pure (no database), so the grouping
// is easy to test. Nothing here names the account: the page is about what players plan, not who the account holder is.

// "Zezima", "zezima" and "Zezima " are one player; so are names that differ only by space, underscore or hyphen.
export const playerKey = (name) => String(name || '').trim().toLowerCase().replace(/[ _-]+/g, ' ')

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max)

function goalsOf(list) {
  return (Array.isArray(list) ? list : [])
    .filter((g) => g && typeof g === 'object' && typeof g.skill === 'string')
    .slice(0, 30)
    .map((g) => ({
      skill: text(g.skill, 20),
      currentXp: num(g.currentXp),
      targetXp: num(g.targetXp),
      methodId: text(g.methodId || 'global', 70),
    }))
}

const planOf = (p, source, updatedAt) => ({
  id: text(p.id, 40),
  name: text(p.name, 60) || 'Untitled plan',
  source, // 'saved' (in My plans) or 'working' (the planner as it was left, not saved under a name)
  updatedAt: text(p.updatedAt || updatedAt, 40) || null,
  hoursPerDay: num(p.hoursPerDay) || null,
  strategy: text(p.globalStrategy, 20),
  goals: goalsOf(p.goals),
})

/**
 * accounts: [{ plans, planner }] where plans is the account's saved plans (an array) and planner its working state
 * ({ rsn, goals, planId, planName, ... }) with the time it last changed, as { value, updatedAt } entries or plain values.
 * Returns { totals: { players, plans, accounts }, players: [{ key, name, accounts, plans }] }, players A to Z, plans newest
 * first, and plans with no player name last in a group called "" (shown as "No player set").
 */
export function groupPlansByPlayer(accounts) {
  const groups = new Map()
  const seenAccounts = new Set()
  const add = (accountIndex, rsn, plan) => {
    const key = playerKey(rsn)
    let g = groups.get(key)
    if (!g) groups.set(key, (g = { key, name: text(rsn, 12), accounts: new Set(), plans: [] }))
    if (!g.name) g.name = text(rsn, 12)
    g.accounts.add(accountIndex)
    g.plans.push(plan)
    seenAccounts.add(accountIndex)
  }
  accounts.forEach((a, i) => {
    const saved = Array.isArray(a?.plans?.value) ? a.plans.value : Array.isArray(a?.plans) ? a.plans : []
    const draft = a?.planner?.value || (a?.planner && Array.isArray(a.planner.goals) ? a.planner : null)
    for (const p of saved) if (p && typeof p === 'object') add(i, p.player?.rsn, planOf(p, 'saved', a?.plans?.updatedAt))
    // The working planner counts too, unless it is just an open copy of a plan that is already saved.
    if (draft && Array.isArray(draft.goals) && draft.goals.length && !saved.some((p) => p && p.id === draft.planId)) {
      add(i, draft.rsn, planOf({ ...draft, id: draft.planId || 'working', name: draft.planName || 'Unsaved plan' }, 'working', a.planner.updatedAt))
    }
  })
  const players = [...groups.values()].map((g) => ({
    key: g.key,
    name: g.name,
    accounts: g.accounts.size,
    plans: g.plans.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))),
  }))
  players.sort((a, b) => (a.key === '') - (b.key === '') || a.key.localeCompare(b.key))
  return { totals: { players: players.filter((p) => p.key).length, plans: players.reduce((n, p) => n + p.plans.length, 0), accounts: seenAccounts.size }, players }
}
