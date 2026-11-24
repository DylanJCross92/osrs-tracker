import { describe, expect, it } from 'vitest'
import { getMethod } from '@/data/trainingMethods'
import { methodsForSkill } from '@/data/trainingMethods'
import { planGoal, xpAtLevel } from '@/utils/planner'

describe('Gemstone Crab rates', () => {
  it('rise with level in three steps that do not overlap, for each melee skill', () => {
    for (const skill of ['attack', 'strength', 'defence']) {
      const [low, mid, high] = ['gemstone-crab', 'gemstone-crab-mid', 'gemstone-crab-high'].map((id) => getMethod(`${skill}-${id}`))
      expect(low.maxLevel + 1).toBe(mid.minLevel)
      expect(mid.maxLevel + 1).toBe(high.minLevel)
      expect(high.maxLevel).toBeNull()
      expect(low.xpPerHour).toBeLessThan(mid.xpPerHour)
      expect(mid.xpPerHour).toBeLessThan(high.xpPerHour)
      // A strong account should see the 75K-110K a player expects, not the rate of a level 40.
      expect(high.xpPerHour).toBeGreaterThanOrEqual(75000)
      expect(high.xpPerHour).toBeLessThanOrEqual(110000)
    }
  })

  it('every melee skill lists the three', () => {
    expect(methodsForSkill('Strength').filter((m) => m.id.startsWith('strength-gemstone-crab')).length).toBe(3)
  })

  it('keeps the planner finite with them in the catalogue', () => {
    const plan = planGoal({ skill: 'Strength', currentXp: xpAtLevel(30), targetXp: xpAtLevel(99), methodId: 'auto-fast' })
    expect(Number.isFinite(plan.hours)).toBe(true)
  })
})
