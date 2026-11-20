import { beforeEach, describe, expect, it } from 'vitest'
import { ECONOMY, ECONOMY_ITEMS } from '@/data/methodEconomy'
import { TRAINING_METHODS, getMethod } from '@/data/trainingMethods'
import { afterTax, geTax } from '@/utils/geTax'
import { afterTax as serverAfterTax, geTax as serverGeTax } from '../../server/src/utils/ge.js'
import { economyFor, gpPerHourFor, isLive } from '@/utils/methodPricing'
import { midOf, priceOf, resetPrices, setPrices, slugOf } from '@/utils/priceBook'
import { PRICE_NAMES } from '@/utils/priceNames'

beforeEach(() => resetPrices())

describe('price book', () => {
  it('looks prices up by name whatever the case, and clears them', () => {
    setPrices({ 'dragon bones': [3736, 3679, 'dragon-bones'] }, { updatedAt: '2026-11-20T00:00:00Z' })
    expect(priceOf('Dragon Bones')).toEqual({ high: 3736, low: 3679, slug: 'dragon-bones' })
    expect(midOf('dragon bones')).toBe(3708)
    expect(slugOf('Dragon bones')).toBe('dragon-bones')
    expect(priceOf('Unknown thing')).toBeNull()
    setPrices({})
    expect(priceOf('Dragon bones')).toBeNull()
  })
  it('uses the one price there is', () => {
    setPrices({ thing: [null, 90, 'thing'] })
    expect(midOf('thing')).toBe(90)
  })
})

describe('tax copy', () => {
  it('matches the server rules', () => {
    for (const price of [0, 1, 49, 50, 999, 3783, 1_000_000, 2_000_000_000]) {
      for (const name of ['', 'Dragon bones', 'Old school bond', 'Camelot teleport']) {
        expect(geTax(price, name)).toBe(serverGeTax(price, name))
        expect(afterTax(price, name)).toBe(serverAfterTax(price, name))
      }
    }
  })
})

describe('live gp an hour', () => {
  it('works out what an altar costs from the bones price', () => {
    setPrices({ 'dragon bones': [3800, 3700, 'dragon-bones'] })
    const m = getMethod('prayer-dragon')
    const live = economyFor('prayer-dragon', m.xpPerHour)
    const bones = m.xpPerHour / 252
    expect(live.actionsPerHour).toBeCloseTo(bones, 5)
    expect(live.gpPerHour).toBe(-Math.round(bones * 3750))
    expect(live.lines).toEqual([{ name: 'Dragon bones', qty: bones, each: 3750, total: -Math.round(bones * 3750), kind: 'in' }])
  })
  it('sells what is made after tax and subtracts what is used', () => {
    setPrices({ 'raw shark': [400, 380, 'raw-shark'], shark: [700, 680, 'shark'] })
    const live = economyFor('cooking-sharks', 140000)
    const actions = 140000 / 210
    expect(live.gpPerHour).toBe(Math.round(actions * (afterTax(690, 'Shark') - 390)))
  })
  it('has no live figure when the method has no recipe or an item has no price', () => {
    expect(economyFor('attack-crabs', 35000)).toBeNull()
    setPrices({ 'raw shark': [400, 380, 'raw-shark'] })
    expect(economyFor('cooking-sharks', 140000)).toBeNull()
    expect(isLive('cooking-sharks', 140000)).toBe(false)
  })
  it('falls back to the saved figure, and follows the prices when they load or change', () => {
    const m = getMethod('prayer-dragon')
    expect(m.gpPerHour).toBe(m.savedGpPerHour)
    setPrices({ 'dragon bones': [3800, 3700, 'dragon-bones'] })
    expect(m.gpPerHour).toBe(-Math.round((m.xpPerHour / 252) * 3750))
    setPrices({ 'dragon bones': [7600, 7400, 'dragon-bones'] })
    expect(m.gpPerHour).toBe(-Math.round((m.xpPerHour / 252) * 7500))
    resetPrices()
    expect(m.gpPerHour).toBe(m.savedGpPerHour)
  })
  it('leaves methods without a recipe alone', () => {
    expect(gpPerHourFor('attack-crabs', 35000, 0)).toBe(0)
    expect(gpPerHourFor('farming-trees', 2_400_000, -14_800_000)).toBe(-14_800_000)
  })
})

describe('the recipes', () => {
  it('belong to real methods with sane numbers', () => {
    const ids = new Set(TRAINING_METHODS.map((m) => m.id))
    for (const [id, e] of Object.entries(ECONOMY)) {
      expect(ids.has(id), id).toBe(true)
      expect(e.xpPerAction, id).toBeGreaterThan(0)
      expect((e.inputs || []).length + (e.outputs || []).length, id).toBeGreaterThan(0)
      for (const [name, qty] of [...(e.inputs || []), ...(e.outputs || [])]) {
        expect(typeof name).toBe('string')
        expect(qty).toBeGreaterThan(0)
      }
    }
  })
  it('ask for every item they use, once', () => {
    expect(new Set(ECONOMY_ITEMS).size).toBe(ECONOMY_ITEMS.length)
    for (const n of ECONOMY_ITEMS) expect(PRICE_NAMES).toContain(n)
    expect(PRICE_NAMES.length).toBeLessThan(400)
  })
})

describe('what a plan needs to buy', () => {
  const seg = (id, fromXp, toXp) => ({ method: getMethod(id), fromXp, toXp })
  it('lists the essence for the whole stretch of a rune method, not only the start', async () => {
    const { materialsForPlan } = await import('@/utils/plannerTools')
    const out = materialsForPlan({ segments: [seg('runecraft-astral-double', 6_000_000, 6_000_870)] })
    expect(out.totals).toHaveLength(1)
    expect(out.totals[0].name).toBe('Pure essence')
    expect(out.totals[0].qty).toBeGreaterThanOrEqual(100)
    expect(out.totals[0].qty).toBeLessThanOrEqual(101)
    expect(out.untracked).toEqual([])
  })
  it('does not call a method with unknown materials item-free', async () => {
    const { materialsForPlan } = await import('@/utils/plannerTools')
    const out = materialsForPlan({ segments: [seg('runecraft-gotr', 1_000_000, 2_000_000), seg('magic-tan-leather', 1_000_000, 2_000_000)] })
    expect(out.rows).toEqual([])
    expect(out.untracked).toEqual(['Tan Leather (Lunar)'])
  })
  it('builds a list from a recipe and flags combat supplies', async () => {
    const { materialsForPlan } = await import('@/utils/plannerTools')
    const out = materialsForPlan({ segments: [seg('cooking-sharks', 1_986_068, 1_988_168), seg('attack-crabs', 0, 1000)] })
    expect(out.totals).toEqual([{ name: 'Raw shark', qty: 10 }])
    expect(out.supplies.length).toBe(1)
  })
})
