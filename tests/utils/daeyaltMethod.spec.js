import { describe, expect, it } from 'vitest'
import { AUTO_FAST, planGoal, xpAtLevel } from '@/utils/planner'
import { TRAINING_METHODS } from '@/data/trainingMethods'
import { hoursForXp } from '@/utils/methodRates'
import { requirementsFor } from '@/data/methodRequirements'
import { methodIconSrc } from '@/data/methodIcons'

const method = TRAINING_METHODS.find((m) => m.id === 'runecraft-daeyalt-ourania')

describe('Daeyalt essence at Ourania', () => {
  it('is a Runecraft method with a picture, and no gp figure it cannot back up', () => {
    expect(method).toMatchObject({ skill: 'Runecraft', minLevel: 1, intensity: 'Medium', gpPerHour: null })
    expect(methodIconSrc(method)).toBe('/icons/methods/death_rune.png')
    // Slower than Ourania with bought essence, so the fastest route never picks it by itself.
    const ourania = TRAINING_METHODS.find((m) => m.id === 'runecraft-ourania')
    expect(method.xpPerHour).toBeLessThan(ourania.xpPerHour)
    expect(method.xpPerHour / ourania.xpPerHour).toBeGreaterThan(0.7)
  })

  it('asks for the mine and the quest, as things the planner can check and the player can confirm', () => {
    const items = requirementsFor(method)
    const text = items.map((i) => `${i.kind}:${i.label}`).join(' | ')
    expect(text).toMatch(/quest:Sins of the Father/)
    expect(items.some((i) => i.kind === 'skill' && /Mining/.test(i.label) && /60/.test(i.label))).toBe(true)
    expect(items.some((i) => i.kind === 'skill' && /Magic/.test(i.label))).toBe(true)
  })

  it('can be picked by hand for a range of levels, and the route still adds up', () => {
    const base = { skill: 'Runecraft', currentXp: xpAtLevel(60), targetXp: xpAtLevel(80), methodId: AUTO_FAST, customXpPerHour: 0, quests: [] }
    const auto = planGoal(base)
    expect(auto.segments.some((s) => s.method?.id === method.id)).toBe(false)
    const plan = planGoal({ ...base, overrides: [{ fromLevel: 60, toLevel: 70, methodId: method.id }] })
    const manual = plan.segments.filter((s) => s.kind === 'manual')
    expect(manual).toHaveLength(1)
    expect(manual[0].method.id).toBe(method.id)
    // its rate rises with level, so the hours are worked out level by level
    expect(manual[0].hours).toBeCloseTo(hoursForXp(method, xpAtLevel(60), xpAtLevel(70)))
    expect(plan.segments.reduce((t, s) => t + s.xp, 0)).toBe(xpAtLevel(80) - xpAtLevel(60))
  })
})
