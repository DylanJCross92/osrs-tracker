import { describe, expect, it } from 'vitest'
import { MAX_COMBAT_LEVEL, combatLevel } from '@/utils/combat'

// The game's combat level (checked against the Wiki's examples).
describe('combat level', () => {
  it('is 3 for a new account and 126 for a maxed one', () => {
    expect(combatLevel({})).toBe(3)
    expect(combatLevel({ Attack: 99, Strength: 99, Defence: 99, Hitpoints: 99, Ranged: 99, Prayer: 99, Magic: 99 })).toBe(MAX_COMBAT_LEVEL)
  })

  it('takes the strongest of melee, ranged and magic', () => {
    // 1 Defence, 10 Hitpoints, no Prayer: base 2.75. Melee 70+70 = 45.5; ranged 90 = 0.325 * 135 = 43.9; magic 90 the same.
    expect(combatLevel({ Attack: 70, Strength: 70 })).toBe(48)
    expect(combatLevel({ Ranged: 90 })).toBe(46)
    expect(combatLevel({ Magic: 90 })).toBe(46)
    expect(combatLevel({ Attack: 70, Strength: 70, Ranged: 99 })).toBe(Math.floor(2.75 + 0.325 * Math.floor(99 * 1.5)))
  })

  it('counts half the Prayer level, rounded down', () => {
    expect(combatLevel({ Prayer: 43 })).toBe(Math.floor(0.25 * (1 + 10 + 21) + 0.325 * 2))
  })
})
