// Planning helpers built on top of planner.js: strategy resolution, the GP-budget
// optimiser, the sequential training timeline and saved-plan storage/validation.
// Everything here reads the existing method dataset and quest list, it never changes them.

import { getMethod } from '@/data/trainingMethods'
import { getQuest } from '@/data/quests'
import { MATERIALS } from '@/data/methodMaterials'
import { SKILL_NAMES } from '@/utils/osrsSkills'
import { startOfGameDay } from '@/utils/gameDay'
import {
  MAX_XP,
  AUTO_FAST,
  AUTO_CHEAP,
  AUTO_PROFIT,
  AUTO_BALANCED,
  GLOBAL_STRATEGY,
  GLOBAL_STRATEGIES,
  DEFAULT_GP_VALUE,
  isAuto,
  planGoal,
  planTotals,
  compareMethods,
  xpAtLevel,
  levelAtXp,
} from '@/utils/planner'

export const STRATEGY_LABELS = {
  [AUTO_FAST]: 'Fastest',
  [AUTO_CHEAP]: 'Cheapest',
  [AUTO_BALANCED]: 'Balanced',
  [AUTO_PROFIT]: 'Best gp per hour',
}

/** A goal with "follow the global strategy" swapped for the real strategy, ready for planGoal. */
export function resolveGoal(goal, globalStrategy, gpValue) {
  return { ...goal, methodId: goal.methodId === GLOBAL_STRATEGY ? globalStrategy : goal.methodId, gpValuePerHour: gpValue }
}

// --- Budget optimiser -------------------------------------------------------

const MAX_FRONTIER = 500

/** Candidate routes for one goal: the four strategies plus every relevant specific method. */
export function routeOptions(goal) {
  const base = { ...goal }
  const options = []
  const seen = new Set()
  const add = (methodId, label) => {
    const plan = planGoal({ ...base, methodId })
    if (plan.hours == null || !plan.complete) return
    const key = `${Math.round(plan.hours * 100)}|${Math.round((plan.netGp ?? 0) / 1000)}`
    if (seen.has(key)) return
    seen.add(key)
    options.push({ methodId, label, plan, hours: plan.hours, gp: plan.netGp ?? 0, unpriced: plan.netGp == null || plan.gpPartial })
  }
  for (const id of [AUTO_FAST, AUTO_CHEAP, AUTO_BALANCED, AUTO_PROFIT]) add(id, STRATEGY_LABELS[id] + ' route')
  for (const row of compareMethods(base)) add(row.method.id, row.method.name)
  // Routes with unpriced steps could cost anything, so a budget never picks one when a fully priced route exists.
  const priced = options.filter((o) => !o.unpriced)
  return pareto(priced.length ? priced : options)
}

// Keep only routes that no other route beats on both time and gp.
function pareto(items) {
  const sorted = [...items].sort((a, b) => a.hours - b.hours || b.gp - a.gp)
  const out = []
  let bestGp = -Infinity
  for (const it of sorted) {
    if (it.gp > bestGp) {
      out.push(it)
      bestGp = it.gp
    }
  }
  return out
}

function thin(list, max) {
  if (list.length <= max) return list
  const step = list.length / max
  return Array.from({ length: max }, (_, i) => list[Math.floor(i * step)])
}

/**
 * Picks one route per goal so total training time is as low as possible while the combined
 * NET gp stays within the budget (net cost <= budget). This is a net-budget estimate: it does
 * not model the order in which gold is spent and earned, see `startingGpNeeded` for that.
 * goals must already be resolved (no 'global' method ids).
 */
export function optimiseBudget(goals, budget) {
  const active = goals.filter((g) => g.targetXp > g.currentXp)
  const perGoal = active.map((g) => ({ goal: g, options: routeOptions(g) }))
  let frontier = [{ hours: 0, gp: 0, picks: [] }]
  for (const { goal, options } of perGoal) {
    const next = []
    for (const f of frontier) {
      for (const o of options) next.push({ hours: f.hours + o.hours, gp: f.gp + o.gp, picks: [...f.picks, { skill: goal.skill, option: o }] })
    }
    frontier = thin(pareto(next), MAX_FRONTIER)
  }
  const allowed = -Math.abs(budget)
  const feasible = frontier.filter((f) => f.gp >= allowed)
  if (!perGoal.length) return { feasible: true, picks: [], hours: 0, netGp: 0, unpriced: false }
  if (!feasible.length) {
    const cheapest = frontier.reduce((a, b) => (b.gp > a.gp ? b : a))
    return { feasible: false, picks: cheapest.picks, hours: cheapest.hours, netGp: cheapest.gp, shortBy: allowed - cheapest.gp, unpriced: cheapest.picks.some((p) => p.option.unpriced) }
  }
  const best = feasible.reduce((a, b) => (b.hours < a.hours ? b : a))
  return { feasible: true, picks: best.picks, hours: best.hours, netGp: best.gp, unpriced: best.picks.some((p) => p.option.unpriced) }
}

/**
 * Worst-case starting gp a sequence of goals needs, in the order given: spending within a goal is
 * assumed to come before its profit, and profit from earlier goals is allowed to fund later ones.
 */
export function startingGpNeeded(plans) {
  let cum = 0
  let worst = 0
  for (const p of plans) {
    const net = p.netGp ?? 0
    worst = Math.max(worst, -(cum + Math.min(0, net)))
    cum += net
  }
  return Math.max(worst, 0)
}

// --- Timeline ---------------------------------------------------------------

const MILESTONE_LEVELS = [30, 50, 70, 80, 90, 99]

/** Hours into a plan at which the given xp total is reached (0 if it is already covered by the start). */
export function hoursToXp(plan, xp) {
  if (xp <= plan.startXp) return 0
  let hours = 0
  for (const seg of plan.segments) {
    if (seg.hours == null) continue
    if (xp >= seg.toXp) hours += seg.hours
    else {
      if (xp > seg.fromXp) hours += (seg.hours * (xp - seg.fromXp)) / (seg.toXp - seg.fromXp)
      return hours
    }
  }
  return hours
}

/** Skill categories used to colour the timeline rail. */
export const SKILL_CATEGORIES = {
  combat: { label: 'Combat', skills: ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Prayer', 'Magic'] },
  gathering: { label: 'Gathering', skills: ['Mining', 'Woodcutting', 'Fishing', 'Farming', 'Hunter'] },
  artisan: { label: 'Artisan', skills: ['Smithing', 'Crafting', 'Cooking', 'Fletching', 'Herblore', 'Runecraft', 'Construction', 'Firemaking'] },
  support: { label: 'Support', skills: ['Agility', 'Thieving', 'Slayer', 'Sailing'] },
}
export function categoryOfSkill(skill) {
  return Object.keys(SKILL_CATEGORIES).find((k) => SKILL_CATEGORIES[k].skills.includes(skill)) || 'support'
}

/**
 * Sequential timeline in the order given (skills are not trained at the same time).
 * Returns per-skill start/end dates, level milestones and the running gp balance, plus the overall finish.
 * Every entry also carries its position in training hours so a chart can draw it to scale.
 */
export function buildTimeline(goals, plans, hoursPerDay, startDate = new Date()) {
  const hpd = Number(hoursPerDay) > 0 ? Number(hoursPerDay) : null
  const dateAt = (hours) => (hpd ? new Date(startDate.getTime() + (hours / hpd) * 86_400_000) : null)
  let clock = 0
  let balance = 0
  const entries = goals.map((g, i) => {
    const plan = plans[i]
    const hours = plan.hours || 0
    const startHours = clock
    const milestones = []
    const targetLevel = levelAtXp(plan.targetXp, true)
    if (hours > 0) {
      for (const lvl of MILESTONE_LEVELS) {
        const xp = xpAtLevel(lvl)
        if (xp > plan.startXp && xp <= plan.targetXp) {
          const at = startHours + hoursToXp(plan, xp)
          milestones.push({ level: lvl, date: dateAt(at), hours: at })
        }
      }
      if (!MILESTONE_LEVELS.includes(targetLevel)) milestones.push({ level: targetLevel, date: dateAt(startHours + hours), hours: startHours + hours })
    }
    clock += hours
    balance += plan.netGp ?? 0
    return {
      skill: g.skill,
      category: categoryOfSkill(g.skill),
      hours,
      startHours,
      endHours: clock,
      startDate: dateAt(startHours),
      endDate: dateAt(clock),
      balance,
      netGp: plan.netGp,
      milestones,
      targetLevel,
      done: hours === 0,
    }
  })

  return { entries, totalHours: clock, totalDays: hpd ? clock / hpd : null, finishDate: dateAt(clock) }
}

// --- Live progress ----------------------------------------------------------

/**
 * A goal as it stands today. A goal keeps the XP it started from (so progress is always measured against the original
 * starting point); this returns a copy whose start is moved up to the tracked XP, capped at the target.
 */
export function liveGoalFor(goal, trackedXp) {
  const xp = Number(trackedXp)
  if (trackedXp == null || !Number.isFinite(xp)) return goal
  const current = Math.max(goal.currentXp, Math.min(xp, goal.targetXp))
  return current === goal.currentXp ? goal : { ...goal, currentXp: current }
}

/**
 * Progress against the original plan.
 * `originalPlans` were calculated from each goal's starting XP, `livePlans` from today's XP. The schedule compares the
 * training hours actually done so far with the hours the plan expected to be done by now at the same daily playtime, so
 * changing playtime never makes a plan look ahead or behind on its own.
 */
export function buildProgress(goals, liveGoals, originalPlans, livePlans, hoursPerDay, baselineAt, now = new Date()) {
  const per = goals.map((g, i) => {
    const live = liveGoals[i].currentXp
    const total = Math.max(0, g.targetXp - g.currentXp)
    const gained = Math.max(0, live - g.currentXp)
    const remaining = Math.max(0, g.targetXp - live)
    const done = remaining === 0
    return {
      skill: g.skill,
      total,
      gained,
      remaining,
      done,
      pct: total > 0 ? Math.min(1, gained / total) : done ? 1 : 0,
      startLevel: levelAtXp(g.currentXp, true),
      liveLevel: levelAtXp(live, true),
      targetLevel: levelAtXp(g.targetXp, true),
      // Training hours this goal was planned to take from its start, and what is left of them now: the timeline is drawn from these.
      hours: originalPlans[i]?.hours || 0,
      hoursLeft: livePlans[i]?.hours || 0,
    }
  })
  const totalXp = per.reduce((a, p) => a + p.total, 0)
  const gainedXp = per.reduce((a, p) => a + p.gained, 0)
  const completedGoals = per.filter((p) => p.done).length
  const sumHours = (plans) => plans.reduce((a, p) => a + (p?.hours || 0), 0)
  const originalHours = sumHours(originalPlans)
  const liveHours = sumHours(livePlans)
  const hpd = Number(hoursPerDay) > 0 ? Number(hoursPerDay) : null
  const baseline = baselineAt ? new Date(baselineAt) : null
  const elapsedDays = baseline && !Number.isNaN(baseline.getTime()) ? Math.max(0, (now - baseline) / 86_400_000) : null
  const aheadDays = hpd && elapsedDays != null ? Math.max(0, originalHours - liveHours) / hpd - elapsedDays : null
  return {
    per,
    totalXp,
    gainedXp,
    remainingXp: Math.max(0, totalXp - gainedXp),
    pct: totalXp > 0 ? Math.min(1, gainedXp / totalXp) : per.length && completedGoals === per.length ? 1 : 0,
    // How much of the planned training time is behind the player. This is what the progress bar shows: a goal that takes twice
    // as long takes twice the room, so the bar reads like a timeline.
    timePct: originalHours > 0 ? Math.min(1, Math.max(0, (originalHours - liveHours) / originalHours)) : totalXp > 0 ? Math.min(1, gainedXp / totalXp) : 0,
    completedGoals,
    goalCount: per.length,
    complete: per.length > 0 && completedGoals === per.length,
    originalHours,
    liveHours,
    elapsedDays,
    aheadDays,
    schedule: aheadDays == null ? null : aheadDays > 0.5 ? 'ahead' : aheadDays < -0.5 ? 'behind' : 'on',
  }
}

/**
 * When will the plan really finish, going by how fast the player has actually been gaining XP in the goal skills?
 * `snapshots` is the player's tracked history (oldest first, each with capturedAt and skills[skill].xp). The pace is measured
 * over the last `windowDays` days, or since the plan started when that is shorter, and compared with the planned finish date.
 * Returns { status: 'early' | 'late' | 'on', ... } or { status: 'none', reason } when there is too little to go on.
 */
export function projectFinish({ snapshots, goals, remainingXp, plannedDays, baselineAt, now = new Date(), windowDays = 14 }) {
  if (!remainingXp || remainingXp <= 0) return { status: 'none', reason: 'complete' }
  const baseline = baselineAt ? new Date(baselineAt) : null
  if (!baseline || Number.isNaN(baseline.getTime()) || !goals?.length) return { status: 'none', reason: 'no-baseline' }
  const windowStart = new Date(Math.max(baseline.getTime(), now.getTime() - windowDays * 86_400_000))
  const sumAt = (snap) => goals.reduce((a, g) => a + (Number(snap.skills?.[g.skill]?.xp) || 0), 0)
  const rows = (snapshots || [])
    .map((s) => ({ t: new Date(s.capturedAt).getTime(), xp: sumAt(s) }))
    .filter((r) => !Number.isNaN(r.t) && r.t <= now.getTime())
    .sort((a, b) => a.t - b.t)
  if (!rows.length) return { status: 'none', reason: 'no-history' }
  // Where the goal skills stood when the window opened: the newest snapshot before it, or the plan's own starting XP when the
  // window opens at the plan's start.
  const before = [...rows].reverse().find((r) => r.t <= windowStart.getTime())
  const startXp = before ? before.xp : windowStart.getTime() === baseline.getTime() ? goals.reduce((a, g) => a + g.currentXp, 0) : rows[0].xp
  const startT = before || windowStart.getTime() === baseline.getTime() ? windowStart.getTime() : rows[0].t
  const days = (now.getTime() - startT) / 86_400_000
  if (days < 1) return { status: 'none', reason: 'too-soon' }
  const gained = Math.max(0, rows[rows.length - 1].xp - startXp)
  if (gained <= 0) return { status: 'none', reason: 'no-gain' }
  const xpPerDay = gained / days
  const daysLeft = remainingXp / xpPerDay
  const projected = new Date(now.getTime() + daysLeft * 86_400_000)
  const planned = plannedDays != null ? new Date(baseline.getTime() + plannedDays * 86_400_000) : null
  const diffDays = planned ? (planned.getTime() - projected.getTime()) / 86_400_000 : null
  return {
    status: diffDays == null ? 'none' : diffDays > 0.5 ? 'early' : diffDays < -0.5 ? 'late' : 'on',
    xpPerDay,
    windowDays: Math.max(1, Math.round(days)),
    daysLeft,
    projected,
    planned,
    diffDays,
  }
}

/**
 * XP gained since the game day began (6 AM Eastern, the same day the rest of the site uses), in the goal skills only.
 * `snapshots` is the tracked history, oldest first; `currentXp` maps skill to its XP now. The day starts from the newest
 * snapshot taken before 6 AM, or from the first snapshot when there is none. Null when nothing was gained.
 */
export function gainedToday(snapshots, currentXp, now = Date.now()) {
  const rows = (snapshots || []).map((s) => ({ t: new Date(s.capturedAt).getTime(), skills: s.skills || {} })).filter((r) => !Number.isNaN(r.t)).sort((a, b) => a.t - b.t)
  if (!rows.length) return null
  const dayStart = startOfGameDay(now)
  const before = [...rows].reverse().find((r) => r.t <= dayStart) || rows[0]
  const skills = []
  for (const [skill, xp] of Object.entries(currentXp)) {
    const start = Number(before.skills[skill]?.xp)
    if (Number.isFinite(start) && Number.isFinite(xp) && xp > start) skills.push({ skill, gained: xp - start })
  }
  if (!skills.length) return null
  skills.sort((a, b) => b.gained - a.gained)
  return { total: skills.reduce((a, x) => a + x.gained, 0), skills }
}

// --- Sharing ------------------------------------------------------------------

/** Totals for a saved or shared plan from its own start, with no personal data: used for share previews and the public page. */
export function summarizePlan(plan) {
  const goals = plan.goals || []
  const plans = goals.map((g) => planGoal(resolveGoal(g, plan.globalStrategy, plan.gpValue)))
  const t = planTotals(plans, plan.hoursPerDay)
  return {
    totalHours: t.totalHours,
    netGp: t.netGp,
    days: t.days,
    totalXp: t.totalXp,
    goals: goals.map((g) => ({ skill: g.skill, fromLevel: levelAtXp(g.currentXp, true), toLevel: levelAtXp(g.targetXp, true) })),
  }
}

/** The body the server expects when a saved plan is made public. */
export function sharePayload(saved, mode) {
  return {
    planId: saved.id,
    name: saved.name,
    rsn: saved.player?.rsn || '',
    mode,
    plan: { hoursPerDay: saved.hoursPerDay, globalStrategy: saved.globalStrategy, gpValue: saved.gpValue, statsAt: saved.statsAt || null, goals: saved.goals },
    summary: summarizePlan(saved),
  }
}

// --- Saved plans (browser storage only, no accounts) -------------------------

const SAVED_KEY = 'tickgains-saved-plans-v1'
export const PLAN_FORMAT = 'tickgains-plan'
export const PLAN_VERSION = 1

function readSaved() {
  try {
    const list = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeSaved(list) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

export const listSavedPlans = () => readSaved().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))

const newId = () => `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

/** Build the stored shape of a plan from planner state. */
export function snapshotPlan(state, name, existing = {}) {
  const now = new Date().toISOString()
  return {
    id: existing.id || newId(),
    name: String(name || 'My plan').trim().slice(0, 60) || 'My plan',
    version: PLAN_VERSION,
    createdAt: existing.createdAt || now,
    updatedAt: now,
    player: { rsn: state.rsn || '', id: state.playerId ?? null },
    statsAt: state.statsAt || null,
    globalStrategy: state.globalStrategy,
    gpValue: state.gpValue,
    budget: state.budget || null,
    hoursPerDay: state.hoursPerDay,
    goals: state.goals.map((g) => ({
      skill: g.skill,
      currentXp: g.currentXp,
      targetXp: g.targetXp,
      methodId: g.methodId,
      customXpPerHour: g.customXpPerHour || 0,
      quests: [...(g.quests || [])],
      ...(g.allowedMethodIds?.length ? { allowedMethodIds: [...g.allowedMethodIds] } : {}),
    })),
  }
}

/** What makes two versions of a plan "the same" for saving: the goals and the settings that change its numbers. */
export function planFingerprint(p) {
  return JSON.stringify([
    Number(p.hoursPerDay),
    p.globalStrategy,
    Number(p.gpValue),
    (p.goals || []).map((g) => [g.skill, g.currentXp, g.targetXp, g.methodId, g.customXpPerHour || 0, [...(g.quests || [])], g.allowedMethodIds?.length ? [...g.allowedMethodIds] : null]),
  ])
}

export function savePlan(plan) {
  const list = readSaved()
  const i = list.findIndex((p) => p.id === plan.id)
  if (i >= 0) list[i] = plan
  else list.push(plan)
  return writeSaved(list) ? plan : null
}

export function deletePlan(id) {
  return writeSaved(readSaved().filter((p) => p.id !== id))
}

export function renamePlan(id, name) {
  const list = readSaved()
  const p = list.find((x) => x.id === id)
  if (!p) return null
  p.name = String(name || '').trim().slice(0, 60) || p.name
  p.updatedAt = new Date().toISOString()
  writeSaved(list)
  return p
}

export function duplicatePlan(id) {
  const list = readSaved()
  const p = list.find((x) => x.id === id)
  if (!p) return null
  const now = new Date().toISOString()
  const copy = { ...JSON.parse(JSON.stringify(p)), id: newId(), name: `${p.name} (copy)`.slice(0, 60), createdAt: now, updatedAt: now }
  list.push(copy)
  writeSaved(list)
  return copy
}

export function exportPlan(plan) {
  return JSON.stringify({ format: PLAN_FORMAT, version: PLAN_VERSION, plan }, null, 2)
}

const num = (v, lo, hi, fallback) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : fallback
}

/**
 * Validate and clean a plan from JSON (an import or a stored plan). Unknown skills are dropped, numbers clamped, and
 * a method that no longer exists falls back to following the global strategy. Returns { plan, warnings } or { error }.
 */
export function validatePlan(raw) {
  let obj = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return { error: 'That is not valid JSON.' }
    }
  }
  if (!obj || typeof obj !== 'object') return { error: 'That file does not contain a plan.' }
  if (obj.format !== undefined && obj.format !== PLAN_FORMAT) return { error: 'That file is not a TickGains plan.' }
  if (obj.version !== undefined && Number(obj.version) > PLAN_VERSION) return { error: 'That plan was made with a newer version of the planner.' }
  const src = obj.plan && typeof obj.plan === 'object' ? obj.plan : obj
  if (!Array.isArray(src.goals)) return { error: 'That plan has no goals.' }

  const warnings = []
  const seen = new Set()
  const goals = []
  for (const g of src.goals.slice(0, 24)) {
    if (!g || !SKILL_NAMES.includes(g.skill)) {
      warnings.push('Skipped a goal for an unknown skill.')
      continue
    }
    if (seen.has(g.skill)) {
      warnings.push(`Skipped a duplicate ${g.skill} goal.`)
      continue
    }
    seen.add(g.skill)
    let methodId = g.methodId
    if (methodId !== 'custom' && methodId !== GLOBAL_STRATEGY && !isAuto(methodId) && !getMethod(methodId)) {
      warnings.push(`${g.skill}: the saved method is no longer available, so it now follows the global strategy.`)
      methodId = GLOBAL_STRATEGY
    }
    goals.push({
      skill: g.skill,
      currentXp: Math.floor(num(g.currentXp, 0, MAX_XP, 0)),
      targetXp: Math.floor(num(g.targetXp, 0, MAX_XP, MAX_XP)),
      methodId,
      customXpPerHour: Math.floor(num(g.customXpPerHour, 0, 10_000_000, 0)),
      quests: Array.isArray(g.quests) ? g.quests.filter((id) => getQuest(id)) : [],
      ...(Array.isArray(g.allowedMethodIds) ? { allowedMethodIds: g.allowedMethodIds.filter((id) => getMethod(id)?.skill === g.skill) } : {}),
    })
  }
  if (!goals.length) return { error: 'That plan has no usable goals.' }

  const plan = {
    id: typeof src.id === 'string' && src.id ? src.id : newId(),
    name: String(src.name || 'Imported plan').trim().slice(0, 60) || 'Imported plan',
    version: PLAN_VERSION,
    createdAt: typeof src.createdAt === 'string' ? src.createdAt : new Date().toISOString(),
    updatedAt: typeof src.updatedAt === 'string' ? src.updatedAt : new Date().toISOString(),
    player: { rsn: String(src.player?.rsn || '').slice(0, 12), id: src.player?.id ?? null },
    statsAt: typeof src.statsAt === 'string' ? src.statsAt : null,
    globalStrategy: GLOBAL_STRATEGIES.includes(src.globalStrategy) ? src.globalStrategy : AUTO_FAST,
    gpValue: Math.floor(num(src.gpValue, 0, 1_000_000_000, DEFAULT_GP_VALUE)),
    budget: src.budget ? Math.floor(num(src.budget, 0, 100_000_000_000, 0)) || null : null,
    hoursPerDay: num(src.hoursPerDay, 0.25, 24, 2),
    goals,
  }
  return { plan, warnings }
}

/** Save an imported plan under a fresh id so it never overwrites an existing one. */
export function importPlan(raw) {
  const res = validatePlan(raw)
  if (res.error) return res
  const now = new Date().toISOString()
  const plan = { ...res.plan, id: newId(), updatedAt: now }
  if (!savePlan(plan)) return { error: 'Could not store the plan in this browser.' }
  return { plan, warnings: res.warnings }
}

// --- Materials ----------------------------------------------------------------

/**
 * Items needed to reach each level of a plan, for the item-based steps of its route. For every level the
 * highest-xp item usable at that level is chosen and the quantity covers that level's xp (rounded up).
 * Returns { rows: [{ level, method, items: [{ name, qty }] }], totals: [{ name, qty }] }.
 */
export function materialsForPlan(plan) {
  const rows = []
  const totals = new Map()
  let actions = 0
  for (const seg of plan.segments || []) {
    const list = seg.method && MATERIALS[seg.method.id]
    if (!list) continue
    for (let lvl = levelAtXp(seg.fromXp, true); lvl < levelAtXp(seg.toXp - 1, true) + 1; lvl++) {
      const from = Math.max(xpAtLevel(lvl), seg.fromXp)
      const to = Math.min(xpAtLevel(lvl + 1), seg.toXp)
      const need = to - from
      if (need <= 0) continue
      const usable = list.filter((it) => it.level <= lvl)
      if (!usable.length) continue
      const best = usable.reduce((a, b) => (b.xp > a.xp ? b : a))
      const count = need / best.xp
      actions += count
      const items = [{ name: best.name, qty: Math.ceil(count * best.qty) }]
      for (const e of best.extra) items.push({ name: e.name, qty: Math.ceil(count * e.qty) })
      rows.push({ level: lvl + 1, method: seg.method.name, items })
      for (const it of items) totals.set(it.name, (totals.get(it.name) || 0) + it.qty)
    }
  }
  return { rows, totals: [...totals].map(([name, qty]) => ({ name, qty })), actions: Math.ceil(actions) }
}

/** Combine several plans' materials into one shopping list. */
export function mergeMaterials(plans) {
  const totals = new Map()
  for (const p of plans) for (const t of materialsForPlan(p).totals) totals.set(t.name, (totals.get(t.name) || 0) + t.qty)
  return [...totals].map(([name, qty]) => ({ name, qty }))
}
