import { ECONOMY } from '@/data/methodEconomy'
import { midOf, priceOf, priceVersion } from '@/utils/priceBook'
import { afterTax } from '@/utils/geTax'

// A method's gp an hour from live Grand Exchange prices (see data/methodEconomy.js): what it makes sold at the middle price after tax,
// minus what it uses up at the middle price, for every action in an hour. null when the method has no recipe or an item has no price,
// so the figure typed in trainingMethods.js is used instead.

/**
 * { gpPerHour, actionsPerHour, lines: [{ name, qty, each, total, kind: 'in' | 'out' }] } for a method id and its xp an hour, or null.
 * `qty` and `total` are per hour. Outputs are counted after the tax, so `each` for an output is what the seller keeps.
 */
export function economyFor(id, xpPerHour) {
  const e = ECONOMY[id]
  if (!e || !(xpPerHour > 0)) return null
  const actions = xpPerHour / e.xpPerAction
  const lines = []
  let gp = 0
  for (const [name, qty] of e.outputs || []) {
    const mid = midOf(name)
    if (mid == null) return null
    const each = afterTax(mid, name)
    lines.push({ name, qty: qty * actions, each, total: Math.round(qty * actions * each), kind: 'out' })
    gp += qty * actions * each
  }
  for (const [name, qty] of e.inputs || []) {
    const mid = midOf(name)
    if (mid == null) return null
    lines.push({ name, qty: qty * actions, each: mid, total: -Math.round(qty * actions * mid), kind: 'in' })
    gp -= qty * actions * mid
  }
  return { gpPerHour: Math.round(gp), actionsPerHour: actions, lines, note: e.note || '' }
}

// A method's figure is asked for many times while a plan is worked out, so it is kept until the prices change.
const cache = new Map()

/** The gp an hour for a method: the live figure when there is one, otherwise `saved` (the figure typed in trainingMethods.js). */
export function gpPerHourFor(id, xpPerHour, saved) {
  if (!ECONOMY[id]) return saved
  const v = priceVersion.value
  const hit = cache.get(id)
  if (hit && hit.v === v) return hit.value ?? saved
  const live = economyFor(id, xpPerHour)
  cache.set(id, { v, value: live ? live.gpPerHour : null })
  return live ? live.gpPerHour : saved
}

/** True when a method's figure is worked out from live prices right now. */
export const isLive = (id, xpPerHour) => !!ECONOMY[id] && economyFor(id, xpPerHour) != null

/** The price details of one item, for tooltips. */
export const priceInfoOf = (name) => priceOf(name)
