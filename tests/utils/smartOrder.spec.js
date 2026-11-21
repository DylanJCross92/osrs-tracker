import { describe, expect, it } from 'vitest'
import { smartOrder } from '@/utils/smartOrder'
import { xpAtLevel } from '@/utils/planner'

// A goal from level `from` to level `to`, and the planner's result for it (hours, and gp earned or spent in total).
const goal = (skill, from, to, hours, gph = 0) => ({
  g: { skill, currentXp: xpAtLevel(from), targetXp: xpAtLevel(to) },
  p: { hours, netGp: gph * hours, remainingXp: xpAtLevel(to) - xpAtLevel(from) },
})
const run = (...list) => smartOrder(list.map((x) => x.g), list.map((x) => x.p))

describe('the suggested training order', () => {
  it('trains Fishing before Cooking when Cooking can use the fish, and says why', () => {
    const r = run(goal('Cooking', 40, 90, 100), goal('Fishing', 50, 90, 100))
    expect(r.order).toEqual(['Fishing', 'Cooking'])
    expect(r.changed).toBe(true)
    expect(r.reasons.Fishing[0]).toContain('Before Cooking')
    expect(r.reasons.Fishing[0]).toContain('raw fish cost nothing')
  })
  it('drops a synergy the player no longer needs: with Fishing already high there is nothing to gain', () => {
    const r = run(goal('Cooking', 40, 90, 60), goal('Fishing', 80, 99, 100))
    // No Fishing to Cooking help, so the shorter skill goes first.
    expect(r.order).toEqual(['Cooking', 'Fishing'])
    expect(r.reasons.Fishing.join(' ')).not.toContain('Before Cooking')
  })
  it('only uses a synergy when the target level reaches where it helps', () => {
    // Cooking only goes to level 20, before cooked fish matter.
    const r = run(goal('Cooking', 1, 20, 5), goal('Fishing', 1, 60, 60))
    expect(r.reasons.Fishing.join(' ')).not.toContain('Before Cooking')
  })
  it('puts what earns gp before the skills that cost the most, once the plan has real costs', () => {
    const r = run(goal('Construction', 50, 90, 80, -900_000), goal('Mining', 60, 90, 80, 250_000))
    expect(r.order).toEqual(['Mining', 'Construction'])
    expect(r.reasons.Mining.join(' ')).toContain('helps pay for Construction')
    expect(r.reasons.Construction.join(' ')).toContain('comes after what earns gp')
  })
  it('ignores gp when nothing in the plan costs much', () => {
    const r = run(goal('Smithing', 50, 70, 40, -10_000), goal('Woodcutting', 50, 60, 10, 20_000))
    expect(r.reasons.Woodcutting.join(' ')).not.toContain('helps pay')
  })
  it('lets Prayer to 70 come before melee and Construction to 75 before Prayer', () => {
    const melee = run(goal('Strength', 70, 99, 100), goal('Prayer', 40, 77, 100))
    expect(melee.order).toEqual(['Prayer', 'Strength'])
    expect(melee.reasons.Prayer[0]).toContain('Piety')
    const altar = run(goal('Prayer', 50, 80, 100), goal('Construction', 60, 80, 100))
    expect(altar.order.indexOf('Construction')).toBeLessThan(altar.order.indexOf('Prayer'))
  })
  it('keeps skills that are already done at the front and leaves a good order alone', () => {
    const done = { g: { skill: 'Attack', currentXp: xpAtLevel(99), targetXp: xpAtLevel(99) }, p: { hours: 0, netGp: 0, remainingXp: 0 } }
    const r = run(goal('Fishing', 50, 90, 100), goal('Cooking', 40, 90, 100), done)
    expect(r.order[0]).toBe('Attack')
    expect(r.reasons.Attack).toEqual(['Already done.'])
    const again = smartOrder(r.order.map((s) => [done, goal('Fishing', 50, 90, 100), goal('Cooking', 40, 90, 100)].find((x) => x.g.skill === s).g), r.order.map((s) => [done, goal('Fishing', 50, 90, 100), goal('Cooking', 40, 90, 100)].find((x) => x.g.skill === s).p))
    expect(again.changed).toBe(false)
  })
  it('puts the quickest skills early and the longest grind last when nothing else decides', () => {
    const r = run(goal('Hunter', 1, 99, 400), goal('Agility', 80, 99, 30), goal('Thieving', 70, 99, 120))
    expect(r.order).toEqual(['Agility', 'Thieving', 'Hunter'])
    expect(r.reasons.Hunter[0]).toContain('longest grind')
    expect(r.reasons.Agility[0]).toContain('Quick to finish')
  })
})
