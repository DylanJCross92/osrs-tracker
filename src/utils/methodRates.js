// XP rates that change with level. A method can carry `rates: [[fromLevel, xpPerHour], ...]` (ascending), a step table taken from
// the wiki's own sample levels: from that level up (to the next entry) that rate applies. A method without `rates` has one rate,
// its `xpPerHour`. For a tiered method `xpPerHour` is the average over its level range (see averageRate), so anything that has no
// level to hand still gets a sensible single number.
import { levelAtXp, xpAtLevel } from '@/utils/xpLevels'

export const hasTiers = (method) => Array.isArray(method?.rates) && method.rates.length > 0

// A method can also carry `gpRates: [[fromLevel, gpPerHour], ...]` when its profit climbs with level on its own, faster than its xp does
// (Motherlode Mine finds rarer ore as you level). The same kind of step table; without it gp follows the xp rate.
export const hasGpTiers = (method) => Array.isArray(method?.gpRates) && method.gpRates.length > 0

/** The gp an hour in force at a level from the method's gpRates, or null when it has none. */
export function gpRateAt(method, level) {
  if (!hasGpTiers(method)) return null
  let gp = method.gpRates[0][1]
  for (const [from, v] of method.gpRates) if (level >= from) gp = v
  return gp
}

/** The rate in force at a level: the last tier that has started, or the first tier's rate before any has. */
export function rateAt(method, level) {
  if (!hasTiers(method)) return method.xpPerHour
  let rate = method.rates[0][1]
  for (const [from, xph] of method.rates) if (level >= from) rate = xph
  return rate
}

/** Where a method's levels end as xp: the level cap (or level 99 when it has none). */
const endXpOf = (minLevel, maxLevel) => (maxLevel == null ? xpAtLevel(99) : xpAtLevel(maxLevel + 1))

/** [{ fromXp, toXp, rate }]: [fromXp, toXp) cut where the rate steps. One piece for a method with a single rate. */
export function ratePieces(method, fromXp, toXp) {
  if (!(toXp > fromXp)) return []
  if (!hasTiers(method)) return [{ fromXp, toXp, rate: method.xpPerHour }]
  const cuts = new Set([fromXp, toXp])
  // Cut where the xp rate steps, and where the gp rate steps (the xp rate stays the same across that cut).
  for (const [from] of [...method.rates, ...(method.gpRates || [])]) {
    const at = xpAtLevel(from)
    if (at > fromXp && at < toXp) cuts.add(at)
  }
  const points = [...cuts].sort((a, b) => a - b)
  const pieces = []
  for (let i = 0; i < points.length - 1; i++) pieces.push({ fromXp: points[i], toXp: points[i + 1], rate: rateAt(method, levelAtXp(points[i], true)) })
  return pieces
}

/** Hours to gain [fromXp, toXp) with a method, tier by tier. null when the method has no rate. */
export function hoursForXp(method, fromXp, toXp) {
  const pieces = ratePieces(method, fromXp, toXp)
  if (!pieces.length || pieces.some((p) => !(p.rate > 0))) return null
  return pieces.reduce((sum, p) => sum + (p.toXp - p.fromXp) / p.rate, 0)
}

/** The average rate over a level range for a list of tiers: the xp gained divided by the hours it takes. */
export function averageRate(rates, minLevel, maxLevel) {
  const from = xpAtLevel(minLevel)
  const to = endXpOf(minLevel, maxLevel)
  if (!(to > from)) return rates[0][1]
  const hours = ratePieces({ xpPerHour: rates[0][1], rates }, from, to).reduce((sum, p) => sum + (p.toXp - p.fromXp) / p.rate, 0)
  return Math.round((to - from) / hours)
}

/** The average gp an hour over a method's own levels, from its two step tables: the gp earned divided by the hours it takes. */
export function averageGpRate(rates, gpRates, minLevel, maxLevel) {
  const from = xpAtLevel(minLevel)
  const to = endXpOf(minLevel, maxLevel)
  const m = { xpPerHour: rates[0][1], rates, gpRates }
  let hours = 0
  let gp = 0
  for (const p of ratePieces(m, from, to)) {
    const h = (p.toXp - p.fromXp) / p.rate
    hours += h
    gp += h * gpRateAt(m, levelAtXp(p.fromXp, true))
  }
  return hours > 0 ? Math.round(gp / hours) : gpRates[0][1]
}

/** The tiers that fall inside the method's own levels: [{ level, rate }]. */
export function rateSteps(method) {
  if (!hasTiers(method)) return []
  const last = method.maxLevel == null ? 99 : method.maxLevel
  const steps = method.rates.filter(([from]) => from <= last).map(([level, rate]) => ({ level: Math.max(level, method.minLevel), rate }))
  // Several tiers can start at or below the first level of the method: only the last of them is in force there.
  return steps.filter((s, i) => i === steps.length - 1 || steps[i + 1].level > s.level)
}

/** The steps worth showing as a short ladder: all of them when there are few, else the first, the last and an even spread between (at most `max`). */
export function ladderSteps(method, max = 6) {
  const steps = rateSteps(method)
  if (steps.length <= max) return steps
  const picked = new Set()
  for (let i = 0; i < max; i++) picked.add(Math.round((i * (steps.length - 1)) / (max - 1)))
  return steps.filter((_, i) => picked.has(i))
}

/** How a method's xp an hour reads where there is room for one figure: '85K-220K' for a tiered method, '125,000' otherwise. */
export function rateLabel(method) {
  return hasTiers(method) ? rateRange(method).text : Number(method.xpPerHour).toLocaleString('en-US')
}

/** The same range for the levels a step of a plan covers (reaching toLevel), or '' when the rate does not change across them. */
export function stepRangeText(method, fromLevel, toLevel) {
  if (!hasTiers(method)) return ''
  const r = rateRangeBetween(method, fromLevel, Math.max(toLevel - 1, fromLevel))
  return r.min === r.max ? '' : r.text
}

/**
 * The method of a finished plan segment, for showing its gp breakdown: a tiered method at the segment's own average xp an hour and the gp
 * an hour that comes out of the segment (gp is linear in the rate, so the average rate gives the same total). Others are returned as they are.
 */
export function segmentMethod(seg) {
  const m = seg?.method
  if (!hasTiers(m) || !seg.hours) return m
  return { ...m, xpPerHour: seg.xpPerHour, gpPerHour: seg.netGp == null ? m.gpPerHour : seg.netGp / seg.hours }
}

/** 98,050 -> '98K', 1,250 -> '1.3K', 800 -> '800'. */
export function shortRate(n) {
  if (n >= 100_000) return `${Math.round(n / 1000)}K`
  if (n >= 1000) return `${+(n / 1000).toFixed(1)}K`
  return String(Math.round(n))
}

/** { min, max, text } for a method's rates inside its level range: '85K-220K', or just '125K' when it has one. */
export function rateRange(method) {
  const steps = rateSteps(method)
  const rates = steps.length ? steps.map((s) => s.rate) : [method.xpPerHour]
  const min = Math.min(...rates)
  const max = Math.max(...rates)
  return { min, max, text: min === max ? shortRate(min) : `${shortRate(min)}-${shortRate(max)}` }
}

/** Where a range [fromLevel, toLevel] of levels sits inside the method's rates: the rates in force across it (for the picker). */
export function rateRangeBetween(method, fromLevel, toLevel) {
  if (!hasTiers(method)) return { min: method.xpPerHour, max: method.xpPerHour, text: shortRate(method.xpPerHour) }
  const lo = Math.max(fromLevel, method.minLevel)
  const hi = Math.min(toLevel, method.maxLevel ?? 99)
  const rates = [rateAt(method, lo), ...method.rates.filter(([l]) => l > lo && l <= hi).map(([, r]) => r)]
  const min = Math.min(...rates)
  const max = Math.max(...rates)
  return { min, max, text: min === max ? shortRate(min) : `${shortRate(min)}-${shortRate(max)}` }
}

/** The average rate over levels fromLevel to toLevel (reaching toLevel), counting only the levels the method covers. Falls back to xpPerHour. */
export function averageBetween(method, fromLevel, toLevel) {
  if (!hasTiers(method)) return method.xpPerHour
  const from = xpAtLevel(Math.max(fromLevel, method.minLevel))
  const to = Math.min(xpAtLevel(toLevel), endXpOf(method.minLevel, method.maxLevel === null ? null : method.maxLevel))
  const hours = to > from ? hoursForXp(method, from, to) : null
  return hours ? (to - from) / hours : method.xpPerHour
}
