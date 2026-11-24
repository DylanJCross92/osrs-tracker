import { describe, expect, it } from 'vitest'
import { combatLevelFromSkills } from '../../server/src/utils/combat.js'
import { combatLevel } from '../../src/utils/combat.js'

const wrap = (levels) => Object.fromEntries(Object.entries(levels).map(([k, v]) => [k, { level: v }]))

describe('server combat level', () => {
  it('matches the site formula', () => {
    const sets = [
      { Attack: 1, Strength: 1, Defence: 1, Hitpoints: 10, Ranged: 1, Prayer: 1, Magic: 1 },
      { Attack: 99, Strength: 99, Defence: 99, Hitpoints: 99, Ranged: 99, Prayer: 99, Magic: 99 },
      { Attack: 60, Strength: 70, Defence: 50, Hitpoints: 65, Ranged: 80, Prayer: 43, Magic: 75 },
      { Attack: 1, Strength: 1, Defence: 1, Hitpoints: 10, Ranged: 1, Prayer: 1, Magic: 99 },
    ]
    for (const s of sets) expect(combatLevelFromSkills(wrap(s))).toBe(combatLevel(s))
    expect(combatLevelFromSkills(wrap(sets[1]))).toBe(126)
  })
  it('gives null when nothing is known', () => {
    expect(combatLevelFromSkills(null)).toBeNull()
    expect(combatLevelFromSkills({})).toBeNull()
  })
})
