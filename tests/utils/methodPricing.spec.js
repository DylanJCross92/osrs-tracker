import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ECONOMY, ECONOMY_ITEMS } from '@/data/methodEconomy'
import { TRAINING_METHODS, getMethod } from '@/data/trainingMethods'
import { afterTax, geTax } from '@/utils/geTax'
import { afterTax as serverAfterTax, geTax as serverGeTax } from '../../server/src/utils/ge.js'
import { economyFor, gpPerHourFor, isLive } from '@/utils/methodPricing'
import { midOf, priceOf, resetPrices, setPrices, slugOf } from '@/utils/priceBook'
import { PRICE_NAMES } from '@/utils/priceNames'
import { CRYSTALS_PER_MARK, MARKS, marksPerHour } from '@/data/marksOfGrace'

beforeEach(() => resetPrices())

describe('price book', () => {
  it('looks prices up by name whatever the case, and clears them', () => {
    setPrices({ 'dragon bones': [3736, 3679, 'dragon-bones'] }, { updatedAt: '2026-11-20T00:00:00Z' })
    expect(priceOf('Dragon Bones')).toEqual({ high: 3736, low: 3679, slug: 'dragon-bones', icon: '' })
    expect(midOf('dragon bones')).toBe(3708)
    expect(slugOf('Dragon bones')).toBe('dragon-bones')
    expect(priceOf('Unknown thing')).toBeNull()
    setPrices({})
    expect(priceOf('Dragon bones')).toBeNull()
  })
  it('keeps the picture file of an item whose picture is not its name', async () => {
    const { iconOf } = await import('@/utils/priceBook')
    setPrices({ 'revenant ether': [175, 174, 'revenant-ether', 'Revenant ether 5.png'], 'dragon bones': [3736, 3679, 'dragon-bones', null] })
    expect(iconOf('Revenant ether')).toBe('Revenant ether 5.png')
    expect(iconOf('Dragon bones')).toBe('')
    expect(iconOf('Unknown')).toBe('')
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
      // A recipe made of what is done each time needs xp per action; one that only says what an hour makes (marks of grace) does not.
      if (!e.perHour) expect(e.xpPerAction, id).toBeGreaterThan(0)
      expect((e.inputs || []).length + (e.outputs || []).length + (e.perHour || []).length, id).toBeGreaterThan(0)
      for (const [name, qty] of [...(e.inputs || []), ...(e.outputs || []), ...(e.perHour || [])]) {
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
    const out = materialsForPlan({ segments: [seg('runecraft-gotr', 1_000_000, 2_000_000), seg('magic-bake-pie', 1_000_000, 2_000_000)] })
    expect(out.rows).toEqual([])
    expect(out.untracked).toEqual(['Bake Pie (Lunar)'])
  })
  it('builds a list from a recipe and flags combat supplies', async () => {
    const { materialsForPlan } = await import('@/utils/plannerTools')
    const out = materialsForPlan({ segments: [seg('cooking-sharks', 1_986_068, 1_988_168), seg('attack-crabs', 0, 1000)] })
    expect(out.totals).toEqual([{ name: 'Raw shark', qty: 10 }])
    expect(out.supplies.length).toBe(1)
  })
})

describe('price basis', () => {
  const back = async () => (await import('@/utils/priceBook')).setPriceBasis('mid')
  beforeEach(back)
  afterEach(back)
  it('prices buys and sells at the middle by default, and at instant prices when asked', async () => {
    const { buyOf, sellOf, setPriceBasis, priceBasis } = await import('@/utils/priceBook')
    setPrices({ thing: [120, 100, 'thing'], 'one sided': [null, 90, 'one-sided'] })
    expect(priceBasis.value).toBe('mid')
    expect(buyOf('thing')).toBe(110)
    expect(sellOf('thing')).toBe(110)
    setPriceBasis('instant')
    expect(buyOf('thing')).toBe(120)
    expect(sellOf('thing')).toBe(100)
    expect(buyOf('one sided')).toBe(90)
    expect(buyOf('missing')).toBeNull()
    setPriceBasis('nonsense')
    expect(priceBasis.value).toBe('mid')
  })
  it('changes the gp an hour of a recipe, and recomputes the cached figure', async () => {
    const { setPriceBasis } = await import('@/utils/priceBook')
    setPrices({ 'raw shark': [400, 380, 'raw-shark'], shark: [700, 680, 'shark'] })
    const mid = gpPerHourFor('cooking-sharks', 140000, 0)
    setPriceBasis('instant')
    const actions = 140000 / 210
    expect(economyFor('cooking-sharks', 140000).gpPerHour).toBe(Math.round(actions * (afterTax(680, 'Shark') - 400)))
    expect(gpPerHourFor('cooking-sharks', 140000, 0)).toBeLessThan(mid)
  })
})

describe('fixed hourly costs', () => {
  it('subtracts the Blast Furnace coffer fee and lists it', () => {
    setPrices({ 'iron ore': [100, 90, 'iron-ore'], 'iron bar': [200, 190, 'iron-bar'] })
    const live = economyFor('smithing-blast-iron', 75000)
    const bars = 75000 / 12.5
    expect(live.gpPerHour).toBe(Math.round(bars * (afterTax(195, 'Iron bar') - 95) - 72000))
    expect(live.lines.find((l) => l.kind === 'fee')).toMatchObject({ name: 'Blast Furnace coffer fee', total: -72000 })
  })
})

describe('every recipe', () => {
  it('belongs to a real method with a positive xp per action, and names only real item names', () => {
    const ids = new Set(TRAINING_METHODS.map((m) => m.id))
    for (const [id, e] of Object.entries(ECONOMY)) {
      expect(ids.has(id), id).toBe(true)
      if (!e.perHour) expect(e.xpPerAction, id).toBeGreaterThan(0)
      expect((e.inputs || []).length + (e.outputs || []).length + (e.perHour || []).length, id).toBeGreaterThan(0)
    }
    expect(ECONOMY_ITEMS.length).toBeGreaterThan(80)
  })
})

describe('marks of grace sold as amylase crystals', () => {
  const rooftops = ['agility-draynor', 'agility-varrock', 'agility-seers', 'agility-ardougne', 'agility-canifis']
  it('every course that drops marks has a recipe, a real method and a sane range', () => {
    const ids = new Set(TRAINING_METHODS.map((m) => m.id))
    for (const [id, m] of Object.entries(MARKS)) {
      expect(ids.has(id), id).toBe(true)
      expect(m.low, id).toBeGreaterThan(0)
      expect(m.high, id).toBeGreaterThanOrEqual(m.low)
      expect(m.high, id).toBeLessThan(25)
      expect(ECONOMY[id].perHour[0][0]).toBe('Amylase crystal')
      expect(ECONOMY[id].perHour[0][1]).toBeCloseTo(marksPerHour(id) * CRYSTALS_PER_MARK, 6)
    }
    expect(CRYSTALS_PER_MARK).toBe(10)
    expect(marksPerHour('agility-sepulchre')).toBe(0)
  })
  it('sells ten crystals a mark after the tax, for the marks an hour in the middle of the Wiki range', () => {
    setPrices({ 'amylase crystal': [270, 262, 'amylase-crystal'] })
    const m = getMethod('agility-ardougne')
    const live = economyFor('agility-ardougne', m.xpPerHour)
    const crystals = ((16 + 18.1) / 2) * 10
    expect(live.lines).toHaveLength(1)
    expect(live.lines[0]).toMatchObject({ name: 'Amylase crystal', qty: crystals, each: afterTax(266, 'Amylase crystal'), kind: 'out' })
    expect(live.gpPerHour).toBe(Math.round(crystals * afterTax(266, 'Amylase crystal')))
    expect(live.gpPerHour).toBeGreaterThan(40_000)
  })
  it('does not depend on how fast the course gives xp, and is the same marks an hour for any xp rate', () => {
    setPrices({ 'amylase crystal': [270, 262, 'amylase-crystal'] })
    expect(economyFor('agility-varrock', 10_000).gpPerHour).toBe(economyFor('agility-varrock', 50_000).gpPerHour)
  })
  it('falls back to the saved figure (0) when the crystal has no price', () => {
    resetPrices()
    expect(economyFor('agility-draynor', 9500)).toBeNull()
    expect(gpPerHourFor('agility-draynor', 9500, 0)).toBe(0)
  })
  it('pays more on a better rooftop, from Draynor up to Canifis', () => {
    setPrices({ 'amylase crystal': [270, 262, 'amylase-crystal'] })
    const gp = (id) => economyFor(id, getMethod(id).xpPerHour).gpPerHour
    expect(gp('agility-canifis')).toBeGreaterThan(gp('agility-draynor'))
    for (const id of rooftops) expect(gp(id)).toBeGreaterThan(0)
  })
})
