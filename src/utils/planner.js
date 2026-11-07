import { getMethod, methodsForSkill } from '@/data/trainingMethods'

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

// Best-xp/hr catalog method usable at a given level (null if none).
function bestMethodAt(skill, level) {
  let best = null
  for (const meth of methodsForSkill(skill)) {
    if (meth.minLevel > level) continue
    if (meth.maxLevel != null && level > meth.maxLevel) continue
    if (!best || meth.xpPerHour > best.xpPerHour) best = meth
  }
  return best
}

/**
 * Fills [fromXp, toXp) with the fastest usable method at each point. The
 * range is cut at every level where any method of the skill unlocks or
 * stops being valid, so each piece uses whatever is best at that level —
 * e.g. copper -> iron -> Motherlode -> Blast Mine on the way to granite.
 * Pieces with no catalog method come back with method: null.
 */
function fillRoute(skill, fromXp, toXp) {
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
    const method = bestMethodAt(skill, levelAtXp(points[i], true))
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
 * Plans one skill goal as a route of milestones. goal: { skill, currentXp,
 * targetXp, methodId, customXpPerHour? } where methodId is the method you
 * want to end up training with. If it unlocks above your current level the
 * route first climbs to it with the fastest available methods ('prep'
 * segments), then runs the chosen method ('main') for as long as it is
 * valid, then continues with the fastest available ('post') if it caps out
 * before the target. A custom xp/hr rate is a single segment.
 */
export function planGoal(goal) {
  const currentXp = Math.max(Math.floor(goal.currentXp || 0), 0)
  const targetXp = Math.min(Math.floor(goal.targetXp || 0), MAX_XP)
  const remainingXp = Math.max(targetXp - currentXp, 0)
  const chosen = goal.methodId === 'custom' ? null : getMethod(goal.methodId)

  const result = { currentXp, targetXp, remainingXp, method: chosen, segments: [], hours: null, netGp: null, gpPartial: false, warning: null }
  if (remainingXp === 0) return { ...result, hours: 0 }

  let segments = []
  if (!chosen) {
    const rate = Math.floor(goal.customXpPerHour || 0)
    if (!rate) return { ...result, warning: 'Pick a training method or enter an XP/hour rate.' }
    segments = [{ method: { name: 'Custom rate', xpPerHour: rate, gpPerHour: null }, fromXp: currentXp, toXp: targetXp, kind: 'main' }]
  } else {
    const mainStart = xpAtLevel(chosen.minLevel)
    const mainEnd = chosen.maxLevel == null ? Infinity : xpAtLevel(chosen.maxLevel + 1)
    const prepEnd = Math.min(targetXp, mainStart)
    segments.push(...fillRoute(chosen.skill, currentXp, prepEnd).map((x) => ({ ...x, kind: 'prep' })))
    const mainFrom = Math.max(currentXp, mainStart)
    const mainTo = Math.min(targetXp, mainEnd)
    if (mainTo > mainFrom) segments.push({ method: chosen, fromXp: mainFrom, toXp: mainTo, kind: 'main' })
    if (targetXp > mainEnd) {
      segments.push(...fillRoute(chosen.skill, Math.max(mainEnd, currentXp), targetXp).map((x) => ({ ...x, kind: 'post' })))
    }
  }

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
    result.warning = `No catalog method covers levels ${gaps[0].startLevel}–${gaps[gaps.length - 1].endLevel} (${formatNum(xp)} xp) — that part isn't counted. Use a custom rate for it.`
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
  return { totalXp, totalHours, netGp, days, completionDate, gpIncomplete: gpPlans.length < plans.length || plans.some((p) => p.gpPartial) }
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
