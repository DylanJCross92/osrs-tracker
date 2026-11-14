import { getMethod, methodsForSkill } from '@/data/trainingMethods'
import { getQuest, questXpFor } from '@/data/quests'

export const MAX_XP = 200_000_000
export const MAX_VIRTUAL_LEVEL = 126

// Official xp table, built once with integer-only math (level 126 = 188,884,740).
const XP_TABLE = (() => {
  const table = [0, 0]
  let points = 0
  for (let lvl = 1; lvl < MAX_VIRTUAL_LEVEL; lvl++) {
    points += Math.floor(lvl + 300 * 2 ** (lvl / 7))
    table[lvl + 1] = Math.floor(points / 4)
  }
  return table
})()

export function xpAtLevel(level) {
  const l = Math.min(Math.max(Math.floor(level), 1), MAX_VIRTUAL_LEVEL)
  return XP_TABLE[l]
}

/** Level for an xp amount; virtual levels (100-126) when allowVirtual. */
export function levelAtXp(xp, allowVirtual = false) {
  const cap = allowVirtual ? MAX_VIRTUAL_LEVEL : 99
  let level = 1
  while (level < cap && xp >= XP_TABLE[level + 1]) level++
  return level
}

// Best catalog method usable at a given level (null if none). 'fast' picks the
// highest xp/hr; 'cheap' picks the lowest cost per xp (net gp / xp, so profit
// methods win), ignoring methods with no trustworthy gp figure.
function bestMethodAt(skill, level, mode = 'fast', valuePerHour = DEFAULT_GP_VALUE, allowed = null, blocked = null) {
  const candidates = methodsForSkill(skill).filter((meth) => meth.minLevel <= level && (meth.maxLevel == null || level <= meth.maxLevel) && (!allowed || allowed.has(meth.id)))
  // Methods with a confirmed unmet requirement are not recommended. If nothing else covers this level they are used anyway
  // (and flagged in the route) rather than leaving a gap in the plan.
  const open = blocked ? candidates.filter((meth) => !blocked.has(meth.id)) : candidates
  const usable = open.length ? open : candidates
  if (!usable.length) return null
  const byFast = (a, b) => b.xpPerHour - a.xpPerHour
  if (mode === 'balanced') {
    // Lowest effective cost per xp, where each hour of your time is worth `valuePerHour` gp:
    // (valuePerHour - gp/hr) / xp/hr. Unpriced methods are skipped when anything is priced.
    const priced = usable.filter((meth) => meth.gpPerHour != null)
    if (priced.length) {
      const score = (meth) => (valuePerHour - meth.gpPerHour) / meth.xpPerHour
      return priced.sort((a, b) => score(a) - score(b) || byFast(a, b))[0]
    }
  }
  if (mode === 'profit') {
    // Most gp per hour among methods that actually make money; where nothing does, fall back to the cheapest.
    const profitable = usable.filter((meth) => meth.gpPerHour != null && meth.gpPerHour > 0)
    if (profitable.length) return profitable.sort((a, b) => b.gpPerHour - a.gpPerHour || byFast(a, b))[0]
    mode = 'cheap'
  }
  if (mode === 'cheap') {
    const priced = usable.filter((meth) => meth.gpPerHour != null)
    if (priced.length) return priced.sort((a, b) => b.gpPerHour / b.xpPerHour - a.gpPerHour / a.xpPerHour || byFast(a, b))[0]
  }
  return usable.sort(byFast)[0]
}

/**
 * Fills [fromXp, toXp) with the fastest usable method at each point. The
 * range is cut at every level where any method of the skill unlocks or
 * stops being valid, so each piece uses whatever is best at that level,
 * e.g. copper -> iron -> Motherlode -> Blast Mine on the way to granite.
 * Pieces with no catalog method come back with method: null.
 */
function fillRoute(skill, fromXp, toXp, mode = 'fast', valuePerHour = DEFAULT_GP_VALUE, allowed = null, blocked = null) {
  if (toXp <= fromXp) return []
  const cuts = new Set([fromXp, toXp])
  for (const meth of methodsForSkill(skill)) {
    const start = xpAtLevel(meth.minLevel)
    if (start > fromXp && start < toXp) cuts.add(start)
    if (meth.maxLevel != null) {
      const end = xpAtLevel(meth.maxLevel + 1)
      if (end > fromXp && end < toXp) cuts.add(end)
    }
  }
  const points = [...cuts].sort((x, y) => x - y)
  const pieces = []
  for (let i = 0; i < points.length - 1; i++) {
    const method = bestMethodAt(skill, levelAtXp(points[i], true), mode, valuePerHour, allowed, blocked)
    const last = pieces[pieces.length - 1]
    if (last && last.method === method) last.toXp = points[i + 1]
    else pieces.push({ method, fromXp: points[i], toXp: points[i + 1] })
  }
  return pieces
}

function finishSegment(seg, kind) {
  const xp = seg.toXp - seg.fromXp
  const rate = seg.method ? seg.method.xpPerHour : 0
  const hours = rate ? xp / rate : null
  const gp = seg.method?.gpPerHour
  return {
    ...seg,
    kind,
    xp,
    startLevel: levelAtXp(seg.fromXp, true),
    endLevel: levelAtXp(seg.toXp, true),
    xpPerHour: rate,
    hours,
    netGp: hours != null && gp != null ? Math.round(hours * gp) : null,
  }
}

/**
 * Manual choices for sets of levels: [{ fromLevel, toLevel, methodId }], each meaning "train from fromLevel up to toLevel with
 * this method". They sit on top of whatever route the goal's strategy gives and never overlap each other.
 */
export function cleanOverrides(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((o) => ({ fromLevel: Math.floor(Number(o?.fromLevel)), toLevel: Math.floor(Number(o?.toLevel)), methodId: o?.methodId }))
    .filter((o) => Number.isFinite(o.fromLevel) && Number.isFinite(o.toLevel) && o.fromLevel >= 1 && o.toLevel > o.fromLevel && o.toLevel <= MAX_VIRTUAL_LEVEL && typeof o.methodId === 'string' && o.methodId)
    .sort((a, b) => a.fromLevel - b.fromLevel)
}

/**
 * Sets (or, with a null methodId, clears) the manual method for the levels from..to. Whatever was chosen before for any of those
 * levels is replaced, and a choice that only partly overlaps is trimmed to the levels left over. Neighbours with the same method join up.
 */
export function setOverrideRange(list, fromLevel, toLevel, methodId) {
  const kept = []
  for (const o of cleanOverrides(list)) {
    if (o.toLevel <= fromLevel || o.fromLevel >= toLevel) kept.push(o)
    else {
      if (o.fromLevel < fromLevel) kept.push({ ...o, toLevel: fromLevel })
      if (o.toLevel > toLevel) kept.push({ ...o, fromLevel: toLevel })
    }
  }
  if (methodId) kept.push({ fromLevel, toLevel, methodId })
  kept.sort((a, b) => a.fromLevel - b.fromLevel)
  const merged = []
  for (const o of kept) {
    const last = merged[merged.length - 1]
    if (last && last.methodId === o.methodId && last.toLevel === o.fromLevel) last.toLevel = o.toLevel
    else merged.push({ ...o })
  }
  return merged
}

// Lays the manual choices over a route: wherever one covers part of a piece, that part uses the chosen method.
function applyOverrides(segments, overrides, startXp, targetXp) {
  const ranges = cleanOverrides(overrides)
    .map((o) => ({ method: getMethod(o.methodId), from: Math.max(xpAtLevel(o.fromLevel), startXp), to: Math.min(xpAtLevel(o.toLevel), targetXp) }))
    .filter((r) => r.method && r.to > r.from)
  if (!ranges.length) return segments
  const out = []
  const push = (piece) => {
    const last = out[out.length - 1]
    if (last && last.toXp === piece.fromXp && last.kind === piece.kind && last.method === piece.method) last.toXp = piece.toXp
    else out.push(piece)
  }
  for (const seg of segments) {
    const cuts = new Set([seg.fromXp, seg.toXp])
    for (const r of ranges) {
      if (r.from > seg.fromXp && r.from < seg.toXp) cuts.add(r.from)
      if (r.to > seg.fromXp && r.to < seg.toXp) cuts.add(r.to)
    }
    const points = [...cuts].sort((a, b) => a - b)
    for (let i = 0; i < points.length - 1; i++) {
      const [from, to] = [points[i], points[i + 1]]
      const r = ranges.find((x) => from >= x.from && to <= x.to)
      push(r ? { method: r.method, fromXp: from, toXp: to, kind: 'manual' } : { ...seg, fromXp: from, toXp: to })
    }
  }
  return out
}

export const AUTO_FAST = 'auto-fast'
export const AUTO_CHEAP = 'auto-cheap'
export const AUTO_PROFIT = 'auto-profit'
export const AUTO_BALANCED = 'auto-balanced'
export const GLOBAL_STRATEGY = 'global'
export const DEFAULT_GP_VALUE = 2_000_000
export const isAuto = (id) => id === AUTO_FAST || id === AUTO_CHEAP || id === AUTO_PROFIT || id === AUTO_BALANCED
export const GLOBAL_STRATEGIES = [AUTO_FAST, AUTO_CHEAP, AUTO_BALANCED]

/**
 * Plans one skill goal as a route of milestones. goal: { skill, currentXp,
 * targetXp, methodId, customXpPerHour?, quests? }. methodId is one of:
 *  - 'auto-fast' / 'auto-cheap': the fastest (or cheapest per xp) usable
 *    method at every level on the way, the "best route" strategies;
 *  - a catalog method id: the method you want to end up training with. If it
 *    unlocks above your current level the route first climbs to it with the
 *    fastest available methods ('prep'), runs it ('main') while valid, then
 *    continues with the fastest available ('post') if it caps out first;
 *  - 'custom': a single segment at your own xp/hr.
 * goal.quests are quest ids whose flat xp rewards are counted as already done. goal.doneQuestIds are quests the player has
 * finished, which are never counted.
 */
export function planGoal(goal) {
  const currentXp = Math.max(Math.floor(goal.currentXp || 0), 0)
  const targetXp = Math.min(Math.floor(goal.targetXp || 0), MAX_XP)
  // Quests the player has already finished cannot give their reward again.
  const doneQuests = Array.isArray(goal.doneQuestIds) && goal.doneQuestIds.length ? new Set(goal.doneQuestIds) : null
  const questXp = Math.min(questXpFor(doneQuests ? (goal.quests || []).filter((id) => !doneQuests.has(id)) : goal.quests, goal.skill), Math.max(targetXp - currentXp, 0))
  const startXp = currentXp + questXp
  const remainingXp = Math.max(targetXp - startXp, 0)
  const auto = isAuto(goal.methodId) ? goal.methodId : null
  const chosen = goal.methodId === 'custom' || auto ? null : getMethod(goal.methodId)
  // Optional: only route through these methods (a list of method ids). Empty or missing means any method.
  const allowedSet = Array.isArray(goal.allowedMethodIds) && goal.allowedMethodIds.length ? new Set(goal.allowedMethodIds) : null
  // Optional: method ids with a confirmed unmet requirement, skipped when the planner picks methods itself.
  const blockedSet = Array.isArray(goal.blockedMethodIds) && goal.blockedMethodIds.length ? new Set(goal.blockedMethodIds) : null

  const result = { currentXp, startXp, questXp, targetXp, remainingXp, method: chosen, segments: [], hours: null, netGp: null, gpPartial: false, warning: null, complete: true }
  if (remainingXp === 0) return { ...result, hours: 0, netGp: 0 }

  let segments = []
  if (auto) {
    const mode = auto === AUTO_CHEAP ? 'cheap' : auto === AUTO_PROFIT ? 'profit' : auto === AUTO_BALANCED ? 'balanced' : 'fast'
    segments = fillRoute(goal.skill, startXp, targetXp, mode, goal.gpValuePerHour ?? DEFAULT_GP_VALUE, allowedSet, blockedSet).map((x) => ({ ...x, kind: 'auto' }))
  } else if (!chosen) {
    const rate = Math.floor(goal.customXpPerHour || 0)
    if (!rate) return { ...result, complete: false, warning: 'Pick a training method or enter an XP/hour rate.' }
    segments = [{ method: { name: 'Custom rate', xpPerHour: rate, gpPerHour: Number.isFinite(goal.customGpPerHour) ? goal.customGpPerHour : null }, fromXp: startXp, toXp: targetXp, kind: 'main' }]
  } else {
    const mainStart = xpAtLevel(chosen.minLevel)
    const mainEnd = chosen.maxLevel == null ? Infinity : xpAtLevel(chosen.maxLevel + 1)
    const prepEnd = Math.min(targetXp, mainStart)
    segments.push(...fillRoute(chosen.skill, startXp, prepEnd, 'fast', goal.gpValuePerHour ?? DEFAULT_GP_VALUE, allowedSet, blockedSet).map((x) => ({ ...x, kind: 'prep' })))
    const mainFrom = Math.max(startXp, mainStart)
    const mainTo = Math.min(targetXp, mainEnd)
    if (mainTo > mainFrom) segments.push({ method: chosen, fromXp: mainFrom, toXp: mainTo, kind: 'main' })
    if (targetXp > mainEnd) {
      segments.push(...fillRoute(chosen.skill, Math.max(mainEnd, startXp), targetXp, 'fast', goal.gpValuePerHour ?? DEFAULT_GP_VALUE, allowedSet, blockedSet).map((x) => ({ ...x, kind: 'post' })))
    }
  }

  segments = applyOverrides(segments, goal.overrides, startXp, targetXp)
  const finished = segments.map((seg) => finishSegment(seg, seg.kind))
  const gaps = finished.filter((seg) => !seg.method)
  const timed = finished.filter((seg) => seg.hours != null)
  const gpKnown = finished.filter((seg) => seg.netGp != null)

  result.segments = finished
  result.hours = timed.reduce((sum, seg) => sum + seg.hours, 0)
  result.netGp = gpKnown.length ? gpKnown.reduce((sum, seg) => sum + seg.netGp, 0) : null
  result.gpPartial = gpKnown.length > 0 && gpKnown.length < timed.length
  if (gaps.length) {
    const xp = gaps.reduce((sum, seg) => sum + seg.xp, 0)
    result.complete = false
    result.warning = `No catalog method covers levels ${gaps[0].startLevel}–${gaps[gaps.length - 1].endLevel} (${formatNum(xp)} xp), that part isn't counted. Use a custom rate for it.`
  }
  return result
}

/** Catalog methods that actually matter between two levels (usable at some point on the way). */
export function relevantMethods(skill, fromLevel, toLevel) {
  return methodsForSkill(skill).filter((meth) => meth.minLevel <= toLevel && (meth.maxLevel == null || meth.maxLevel >= fromLevel))
}

/** Fastest-route vs cheapest-route plans for the same goal. */
export function compareStrategies(goal) {
  return {
    fast: planGoal({ ...goal, methodId: AUTO_FAST }),
    cheap: planGoal({ ...goal, methodId: AUTO_CHEAP }),
    profit: planGoal({ ...goal, methodId: AUTO_PROFIT }),
    balanced: planGoal({ ...goal, methodId: AUTO_BALANCED }),
  }
}

/** Methods between two levels that make gp, best first. Empty when the skill has no way to profit there. */
export function profitableMethods(skill, fromLevel, toLevel) {
  return relevantMethods(skill, fromLevel, toLevel)
    .filter((meth) => meth.gpPerHour != null && meth.gpPerHour > 0)
    .sort((a, b) => b.gpPerHour - a.gpPerHour)
}

/**
 * What choosing `other` costs or saves against `base` (usually the fastest
 * plan): extra hours, gp saved (positive = better off), and gp saved per
 * extra hour, the number that answers "is saving 5M worth 15 more hours?".
 */
export function tradeoff(base, other) {
  if (base.hours == null || other.hours == null || base.netGp == null || other.netGp == null) return null
  const extraHours = other.hours - base.hours
  const gpSaved = other.netGp - base.netGp
  return { extraHours, gpSaved, gpPerHour: extraHours > 0.05 ? gpSaved / extraHours : null }
}

export function tradeoffText(t) {
  if (!t) return ''
  const hrs = formatHours(Math.abs(t.extraHours))
  const gp = formatGp(Math.abs(t.gpSaved)).replace(/^[+-]/, '')
  if (Math.abs(t.extraHours) < 0.05 && Math.abs(t.gpSaved) < 1000) return 'About the same time and cost.'
  if (t.extraHours <= 0.05 && t.gpSaved >= 0) return `Faster${t.gpSaved >= 1000 ? ` and ${gp} better off` : ''}.`
  if (t.gpSaved <= 0) return `${hrs} slower${t.gpSaved < -1000 ? ` and ${gp} more expensive` : ' with no savings'}.`
  return `Saves ${gp} for ${hrs} extra, about ${formatGp(t.gpPerHour).replace(/^\+/, '')} per extra hour.`
}

/** One row per catalog method relevant to the goal, each planned on its own (with climb-up routes). */
export function compareMethods(rawGoal) {
  // Each row is the whole goal on one method, so any manual choices for sets of levels are left out here.
  const goal = { ...rawGoal, overrides: undefined }
  const fromLevel = levelAtXp(goal.currentXp, true)
  const toLevel = levelAtXp(goal.targetXp, true)
  const fast = planGoal({ ...goal, methodId: AUTO_FAST })
  return relevantMethods(goal.skill, fromLevel, toLevel)
    .map((method) => {
      const plan = planGoal({ ...goal, methodId: method.id })
      return { method, plan, trade: plan.complete ? tradeoff(fast, plan) : null }
    })
    .filter((row) => row.plan.hours != null)
    .sort((a, b) => a.plan.hours - b.plan.hours)
}

export function planTotals(plans, hoursPerDay) {
  const totalXp = plans.reduce((s, p) => s + p.remainingXp, 0)
  const totalHours = plans.reduce((s, p) => s + (p.hours || 0), 0)
  const gpPlans = plans.filter((p) => p.netGp != null)
  const netGp = gpPlans.length ? gpPlans.reduce((s, p) => s + p.netGp, 0) : null
  const hpd = Number(hoursPerDay) > 0 ? Number(hoursPerDay) : null
  const days = hpd ? Math.ceil(totalHours / hpd) : null
  let completionDate = null
  if (days != null && totalHours > 0) {
    completionDate = new Date(Date.now() + days * 86_400_000)
  }
  return { totalXp, totalHours, netGp, days, completionDate, gpIncomplete: gpPlans.length < plans.length || plans.some((p) => p.gpPartial) }
}

export function formatNum(n) {
  return Math.round(n).toLocaleString('en-US')
}

export function formatHours(h) {
  if (h == null) return '-'
  if (h < 1) return `${Math.max(Math.round(h * 60), 1)} min`
  return `${h >= 100 ? Math.round(h).toLocaleString('en-US') : Math.round(h * 10) / 10} h`
}

export function formatGp(gp) {
  if (gp == null) return 'No GP data'
  const abs = Math.abs(gp)
  const sign = gp < 0 ? '-' : '+'
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B gp`
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M gp`
  if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}K gp`
  return `${sign}${abs} gp`
}

// --- Shareable-URL encoding: ?u=name&h=3&g=Agility~6400000~13034431~agility-ardougne,... ---
// Optional extras (older links simply lack them): s = global strategy, v = gp value per hour, b = gp budget.
export function encodePlan({ username, hoursPerDay, goals, strategy, gpValue, budget, statsAt }) {
  const params = new URLSearchParams()
  if (username) params.set('u', username)
  params.set('h', String(hoursPerDay))
  params.set(
    'g',
    goals
      .map((g) => [g.skill, g.currentXp, g.targetXp, g.methodId, g.methodId === 'custom' ? g.customXpPerHour || 0 : '', (g.quests || []).join('.'), cleanOverrides(g.overrides).map((o) => `${o.fromLevel}:${o.toLevel}:${o.methodId}`).join('.')].join('~'))
      .join(','),
  )
  if (strategy && strategy !== AUTO_FAST) params.set('s', strategy)
  if (gpValue && gpValue !== DEFAULT_GP_VALUE) params.set('v', String(Math.round(gpValue)))
  if (budget) params.set('b', String(Math.round(budget)))
  // When the goals' starting stats were captured: the baseline live progress is measured from.
  const at = statsAt ? new Date(statsAt).getTime() : NaN
  if (Number.isFinite(at)) params.set('t', String(at))
  return params
}

export function decodePlan(query, validSkills) {
  const goals = String(query.g || '')
    .split(',')
    .map((chunk) => chunk.split('~'))
    .filter((p) => validSkills.includes(p[0]))
    .map(([skill, cur, tgt, methodId, custom, quests, ranges]) => ({
      skill,
      currentXp: Math.min(Math.max(parseInt(cur, 10) || 0, 0), MAX_XP),
      targetXp: Math.min(Math.max(parseInt(tgt, 10) || 0, 0), MAX_XP),
      // Links made before global strategies pinned every goal to a method; the old default (fastest) now means "follow the global strategy".
      methodId: methodId === GLOBAL_STRATEGY || methodId === AUTO_FAST ? GLOBAL_STRATEGY : methodId === 'custom' || isAuto(methodId) || getMethod(methodId) ? methodId : GLOBAL_STRATEGY,
      customXpPerHour: parseInt(custom, 10) || 0,
      quests: String(quests || '').split('.').filter((id) => getQuest(id)),
      overrides: cleanOverrides(String(ranges || '').split('.').filter(Boolean).map((r) => { const [f, t, id] = r.split(':'); return { fromLevel: f, toLevel: t, methodId: id } })).filter((o) => getMethod(o.methodId)?.skill === skill),
    }))
    .slice(0, 24)
  const hours = Math.min(Math.max(parseFloat(query.h) || 2, 0.25), 24)
  const strategy = GLOBAL_STRATEGIES.includes(query.s) ? query.s : AUTO_FAST
  const gpValue = Math.min(Math.max(parseInt(query.v, 10) || DEFAULT_GP_VALUE, 0), 1_000_000_000)
  const budget = Math.min(Math.max(parseInt(query.b, 10) || 0, 0), 100_000_000_000)
  const t = parseInt(query.t, 10)
  const statsAt = Number.isFinite(t) && t > 0 && t <= Date.now() + 86_400_000 ? new Date(t).toISOString() : null
  return { username: typeof query.u === 'string' ? query.u.slice(0, 12) : '', hoursPerDay: hours, goals, strategy, gpValue, budget: budget || null, statsAt }
}
