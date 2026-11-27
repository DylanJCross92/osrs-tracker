import { ECONOMY } from '@/data/methodEconomy'
import { buyOf, priceOf, priceVersion, sellOf } from '@/utils/priceBook'
import { afterTax } from '@/utils/geTax'
import { hasTiers, rateAt } from '@/utils/methodRates'

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

/** The gp an hour for a method: the live figure when there is one, otherwise `saved` (the figure typed in trainingMethods.js). */
export function gpPerHourFor(id, xpPerHour, saved) {
  if (!ECONOMY[id]) return saved
  const v = priceVersion.value
  // A tiered method has a different rate (so different gp) at each level, so the rate is part of the key.
  const key = `${id}@${xpPerHour}`
  const hit = cache.get(key)
  if (hit && hit.v === v) return hit.value ?? saved
  const live = economyFor(id, xpPerHour)
  cache.set(key, { v, value: live ? live.gpPerHour : null })
  return live ? live.gpPerHour : saved
}

/** True when a method's figure is worked out from live prices right now. */
export const isLive = (id, xpPerHour) => !!ECONOMY[id] && economyFor(id, xpPerHour) != null

/** The price details of one item, for tooltips. */
export const priceInfoOf = (name) => priceOf(name)

/** A method's gp an hour at a level: the same as gpPerHour, except a tiered method is priced at the rate it has at that level. */
export function gpPerHourAt(method, level) {
  if (!hasTiers(method)) return method.gpPerHour
  return gpPerHourFor(method.id, rateAt(method, level), method.savedGpPerHour)
}
