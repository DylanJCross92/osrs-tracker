// The planner plans that accounts have saved, gathered by player name for the admin page. Pure (no database), so the grouping
// is easy to test. Nothing here names the account: the page is about what players plan, not who the account holder is.
import { SharePlanError, cleanSharedPlan } from './sharedPlans.js'

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

const planOf = (p, source, updatedAt, owner = '') => ({
  id: text(p.id, 40),
  // How the admin page opens this plan: 'a<account id>.<plan id>' or 'v<visitor id>.<plan id>' (see adminPlanShare).
  ref: owner ? `${owner}.${text(p.id, 40)}` : null,
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
 * visitors: the same for people who are not signed in, each with the random visitor id they are known by in the statistics:
 * [{ id, plans, planner, updatedAt }]. Their plans carry owner: { key: 'v:<id>', label: 'Visitor 1a2b3c' }.
 * Returns { totals: { players, plans, accounts, visitors }, players: [{ key, name, visitor?, accounts, visitors, plans }] }, players A to Z,
 * plans newest first. A visitor's plans that name no player get a group of their own, per visitor (key 'v:<id>', visitor: { key,
 * label }), after the players; accounts' plans with no player name come last in a group called "" (shown as "No player set").
 */
export function groupPlansByPlayer(accounts, visitors = []) {
  const groups = new Map()
  const seenAccounts = new Set()
  const seenVisitors = new Set()
  const add = (accountIndex, rsn, plan, visitorId = null) => {
    // A visitor's plans with no player name are kept apart, one group per visitor, rather than all in one heap.
    const key = visitorId && !playerKey(rsn) ? `v:${visitorId}` : playerKey(rsn)
    let g = groups.get(key)
    if (!g) {
      g = { key, name: text(rsn, 12), accounts: new Set(), visitors: new Set(), plans: [] }
      if (key.startsWith('v:')) g.visitor = { key, label: `Visitor ${visitorId.slice(0, 6)}` }
      groups.set(key, g)
    }
    if (!g.name) g.name = text(rsn, 12)
    if (visitorId) {
      g.visitors.add(visitorId)
      seenVisitors.add(visitorId)
      plan.owner = { key: `v:${visitorId}`, label: `Visitor ${visitorId.slice(0, 6)}` }
    } else {
      g.accounts.add(accountIndex)
      seenAccounts.add(accountIndex)
    }
    g.plans.push(plan)
  }
  const visitorId = (v) => (typeof v?.id === 'string' && /^[a-f0-9]{32}$/.test(v.id) ? v.id : null)
  for (const v of visitors) {
    const id = visitorId(v)
    if (!id) continue
    const saved = Array.isArray(v.plans) ? v.plans : []
    const draft = v.planner && Array.isArray(v.planner.goals) ? v.planner : null
    for (const p of saved) if (p && typeof p === 'object') add(null, p.player?.rsn, planOf(p, 'saved', v.updatedAt, `v${id}`), id)
    if (draft && draft.goals.length && !saved.some((p) => p && p.id === draft.planId)) {
      add(null, draft.rsn, planOf({ ...draft, id: draft.planId || 'working', name: draft.planName || 'Unsaved plan' }, 'working', v.updatedAt, `v${id}`), id)
    }
  }
  accounts.forEach((a, i) => {
    const saved = Array.isArray(a?.plans?.value) ? a.plans.value : Array.isArray(a?.plans) ? a.plans : []
    const draft = a?.planner?.value || (a?.planner && Array.isArray(a.planner.goals) ? a.planner : null)
    const owner = Number.isInteger(a?.id) ? `a${a.id}` : ''
    for (const p of saved) if (p && typeof p === 'object') add(i, p.player?.rsn, planOf(p, 'saved', a?.plans?.updatedAt, owner))
    // The working planner counts too, unless it is just an open copy of a plan that is already saved.
    if (draft && Array.isArray(draft.goals) && draft.goals.length && !saved.some((p) => p && p.id === draft.planId)) {
      add(i, draft.rsn, planOf({ ...draft, id: draft.planId || 'working', name: draft.planName || 'Unsaved plan' }, 'working', a.planner.updatedAt, owner))
    }
  })
  const players = [...groups.values()].map((g) => ({
    key: g.key,
    name: g.name,
    ...(g.visitor ? { visitor: g.visitor } : {}),
    accounts: g.accounts.size,
    visitors: g.visitors.size,
    plans: g.plans.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))),
  }))
  const rank = (p) => (p.key === '' ? 2 : p.visitor ? 1 : 0)
  players.sort((a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key))
  return { totals: { players: players.filter((p) => p.key && !p.visitor).length, plans: players.reduce((n, p) => n + p.plans.length, 0), accounts: seenAccounts.size, visitors: seenVisitors.size }, players }
}

/**
 * One plan of an account or visitor, in the shape the shared-plan page shows (the same as a public share, without a link):
 * { slug: null, name, rsn, mode: 'static', plan, summary, updatedAt }. `entry` is { plans, planner, updatedAt } as above and
 * `planId` the plan's id ('working' or the planner's own id for the plan left open and not saved). Returns null when there is none.
 * Goes through the same cleaning as a public share, so only the plan's own fields come out.
 */
export function adminPlanShare(entry, planId) {
  const saved = Array.isArray(entry?.plans?.value) ? entry.plans.value : Array.isArray(entry?.plans) ? entry.plans : []
  const draft = entry?.planner?.value || (entry?.planner && Array.isArray(entry.planner.goals) ? entry.planner : null)
  const hit = saved.find((p) => p && typeof p === 'object' && String(p.id) === planId)
  const open = !hit && draft && Array.isArray(draft.goals) && (planId === 'working' || String(draft.planId) === planId) ? draft : null
  const src = hit || open
  if (!src) return null
  const updatedAt = text(src.updatedAt || (hit ? entry?.plans?.updatedAt : entry?.planner?.updatedAt) || entry?.updatedAt, 40) || null
  try {
    const row = cleanSharedPlan({
      planId: /^[\w-]{1,40}$/.test(planId) ? planId : 'working',
      name: hit ? src.name : src.planName || 'Unsaved plan',
      rsn: hit ? src.player?.rsn : src.rsn,
      mode: 'static',
      plan: src,
    })
    return { slug: null, name: row.name, rsn: row.rsn, mode: row.mode, plan: row.plan, summary: row.summary, createdAt: updatedAt, updatedAt }
  } catch (err) {
    if (err instanceof SharePlanError) return null
    throw err
  }
}
