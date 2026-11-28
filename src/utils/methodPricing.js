import { ECONOMY } from '@/data/methodEconomy'
import { buyOf, priceOf, priceVersion, sellOf } from '@/utils/priceBook'
import { afterTax } from '@/utils/geTax'
import { gpRateAt, hasTiers, rateAt } from '@/utils/methodRates'

// A method's gp an hour from live Grand Exchange prices (see data/methodEconomy.js): what it makes sold after tax, minus what it uses up,
// for every action in an hour, plus any fixed cost per hour. Prices are the middle price, or instant buy and sell (see priceBook.js). null when the method has no recipe or an item has no price,
// so the figure typed in trainingMethods.js is used instead.

/**
 * { gpPerHour, actionsPerHour, lines: [{ name, qty, each, total, kind: 'in' | 'out' }] } for a method id and its xp an hour, or null.
 * `qty` and `total` are per hour. Outputs are counted after the tax, so `each` for an output is what the seller keeps.
 */
export function economyFor(id, xpPerHour) {
  const e = ECONOMY[id]
  if (!e || !(xpPerHour > 0)) return null
  const actions = e.xpPerAction > 0 ? xpPerHour / e.xpPerAction : 0
  const lines = []
  let gp = 0
  for (const [name, qty] of e.outputs || []) {
    const sell = sellOf(name)
    if (sell == null) return null
    const each = afterTax(sell, name)
    lines.push({ name, qty: qty * actions, each, total: Math.round(qty * actions * each), kind: 'out' })
    gp += qty * actions * each
  }
  // Made every hour whatever the xp (marks of grace turned into amylase crystals), sold after tax.
  for (const [name, qty, detail] of e.perHour || []) {
    const sell = sellOf(name)
    if (sell == null) return null
    const each = afterTax(sell, name)
    lines.push({ name, qty, each, total: Math.round(qty * each), kind: 'out', ...(detail ? { detail } : {}) })
    gp += qty * each
  }
  for (const [name, qty] of e.inputs || []) {
    const buy = buyOf(name)
    if (buy == null) return null
    lines.push({ name, qty: qty * actions, each: buy, total: -Math.round(qty * actions * buy), kind: 'in' })
    gp -= qty * actions * buy
  }
  // A fixed cost for every hour (a fee the method always pays), not tied to an item price.
  if (e.hourlyFee) {
    lines.push({ name: e.hourlyFee.label, qty: 1, each: e.hourlyFee.gp, total: -e.hourlyFee.gp, kind: 'fee' })
    gp -= e.hourlyFee.gp
  }
  return { gpPerHour: Math.round(gp), actionsPerHour: actions, lines, note: e.note || '' }
}

// A method's figure is asked for many times while a plan is worked out, so it is kept until the prices change.
const cache = new Map()

// The live gp an hour of a method with a recipe at an xp rate, or null when it has none or a price is missing.
function liveGp(id, xpPerHour) {
  const v = priceVersion.value
  // A tiered method has a different rate (so different gp) at each level, so the rate is part of the key.
  const key = `${id}@${xpPerHour}`
  const hit = cache.get(key)
  if (hit && hit.v === v) return hit.value
  const live = economyFor(id, xpPerHour)
  const value = live ? live.gpPerHour : null
  cache.set(key, { v, value })
  return value
}

/** The gp an hour for a method: the live figure when there is one, otherwise `saved` (the figure typed in trainingMethods.js). */
export function gpPerHourFor(id, xpPerHour, saved) {
  if (!ECONOMY[id]) return saved
  return liveGp(id, xpPerHour) ?? saved
}

/** True when a method's figure is worked out from live prices right now. */
export const isLive = (id, xpPerHour) => !!ECONOMY[id] && economyFor(id, xpPerHour) != null

/** The price details of one item, for tooltips. */
export const priceInfoOf = (name) => priceOf(name)

/**
 * A method's gp an hour at a level: the same as gpPerHour, except a tiered method is priced at the rate it has at that level. A method with
 * a recipe is worked out from live prices at that rate. For one with a typed-in figure (which is for the method's average pace), gp follows
 * the xp rate: loot and supplies are used per action, so a faster level means proportionally more of both.
 */
export function gpPerHourAt(method, level) {
  if (!hasTiers(method)) return method.gpPerHour
  // A method with its own gp by level (data/trainingMethods.js `gpRates`) uses that, not the xp rate.
  const own = gpRateAt(method, level)
  if (own != null) return own
  const rate = rateAt(method, level)
  const live = ECONOMY[method.id] ? liveGp(method.id, rate) : null
  if (live != null) return live
  const saved = method.savedGpPerHour
  return saved == null || !(method.xpPerHour > 0) ? saved : Math.round((saved * rate) / method.xpPerHour)
}
