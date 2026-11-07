import { getMethod } from '@/data/trainingMethods'

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

/**
 * Hours/gp for one skill goal with one selected method.
 * goal: { skill, currentXp, targetXp, methodId, customXpPerHour? }
 *
 * A method only counts for xp inside its own level window, so xp earned
 * before its unlock (or past its max level) is reported as `uncoveredXp`
 * instead of being silently credited at the wrong rate.
 */
export function planGoal(goal) {
  const currentXp = Math.max(Math.floor(goal.currentXp || 0), 0)
  const targetXp = Math.min(Math.floor(goal.targetXp || 0), MAX_XP)
  const remainingXp = Math.max(targetXp - currentXp, 0)
  const method = goal.methodId === 'custom' ? null : getMethod(goal.methodId)
  const xpPerHour = method ? method.xpPerHour : Math.floor(goal.customXpPerHour || 0)
  const gpPerHour = method ? method.gpPerHour : null

  const result = {
    currentXp,
    targetXp,
    remainingXp,
    method,
    xpPerHour,
    coveredXp: 0,
    uncoveredXp: 0,
    hours: null,
    netGp: null,
    warning: null,
  }
  if (remainingXp === 0) return { ...result, hours: 0, netGp: gpPerHour == null ? null : 0 }
  if (!xpPerHour) return { ...result, warning: 'Pick a training method or enter an XP/hour rate.' }

  let from = currentXp
  let to = targetXp
  if (method) {
    from = Math.max(from, xpAtLevel(method.minLevel))
    if (method.maxLevel != null) to = Math.min(to, xpAtLevel(method.maxLevel + 1))
  }
  const coveredXp = Math.max(to - from, 0)
  const uncoveredXp = remainingXp - coveredXp
  result.coveredXp = coveredXp
  result.uncoveredXp = uncoveredXp
  result.hours = coveredXp / xpPerHour
  result.netGp = gpPerHour == null ? null : Math.round(result.hours * gpPerHour)

  if (uncoveredXp > 0 && method) {
    const startsTooLow = currentXp < xpAtLevel(method.minLevel)
    result.warning = startsTooLow
      ? `${method.name} unlocks at level ${method.minLevel} — the first ${formatNum(uncoveredXp)} xp isn't included. Add another goal or method for those levels.`
      : `${method.name} stops being the right fit at level ${method.maxLevel} — the last ${formatNum(uncoveredXp)} xp isn't included.`
  }
  return result
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
  return { totalXp, totalHours, netGp, days, completionDate, gpIncomplete: gpPlans.length < plans.length }
}

export function formatNum(n) {
  return Math.round(n).toLocaleString()
}

export function formatHours(h) {
  if (h == null) return '—'
  if (h < 1) return `${Math.max(Math.round(h * 60), 1)} min`
  return `${h >= 100 ? Math.round(h) : Math.round(h * 10) / 10} h`
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
export function encodePlan({ username, hoursPerDay, goals }) {
  const params = new URLSearchParams()
  if (username) params.set('u', username)
  params.set('h', String(hoursPerDay))
  params.set(
    'g',
    goals
      .map((g) => [g.skill, g.currentXp, g.targetXp, g.methodId, g.methodId === 'custom' ? g.customXpPerHour || 0 : ''].join('~'))
      .join(','),
  )
  return params
}

export function decodePlan(query, validSkills) {
  const goals = String(query.g || '')
    .split(',')
    .map((chunk) => chunk.split('~'))
    .filter((p) => validSkills.includes(p[0]))
    .map(([skill, cur, tgt, methodId, custom]) => ({
      skill,
      currentXp: Math.min(Math.max(parseInt(cur, 10) || 0, 0), MAX_XP),
      targetXp: Math.min(Math.max(parseInt(tgt, 10) || 0, 0), MAX_XP),
      methodId: methodId === 'custom' || getMethod(methodId) ? methodId : 'custom',
      customXpPerHour: parseInt(custom, 10) || 0,
    }))
    .slice(0, 24)
  const hours = Math.min(Math.max(parseFloat(query.h) || 2, 0.25), 24)
  return { username: typeof query.u === 'string' ? query.u.slice(0, 12) : '', hoursPerDay: hours, goals }
}
