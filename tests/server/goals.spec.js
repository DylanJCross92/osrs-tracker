import { describe, it, expect } from 'vitest'
import { cleanGoalInput, goalProgress, goalTitle, goalTargetXp, xpAtLevel } from '../../server/src/utils/goals.js'

describe('xp table', () => {
  it('matches the game', () => {
    expect(xpAtLevel(2)).toBe(83)
    expect(xpAtLevel(99)).toBe(13_034_431)
    expect(xpAtLevel(126)).toBe(188_884_740)
  })
})

describe('cleanGoalInput', () => {
  it('accepts a skill with a level or xp target', () => {
    expect(cleanGoalInput({ skill: 'Mining', type: 'level', target: 99 })).toEqual({ skill: 'Mining', type: 'level', target: 99 })
    expect(cleanGoalInput({ skill: 'Magic', type: 'xp', target: '50000000' })).toEqual({ skill: 'Magic', type: 'xp', target: 50_000_000 })
  })
  it('rejects anything else', () => {
    for (const bad of [null, {}, { skill: 'Nope', type: 'level', target: 99 }, { skill: 'Mining', type: 'level', target: 1 }, { skill: 'Mining', type: 'level', target: 127 }, { skill: 'Mining', type: 'xp', target: 200_000_001 }, { skill: 'Mining', type: 'xp', target: 0 }, { skill: 'Mining', type: 'rank', target: 5 }, { skill: 'Mining', type: 'level', target: 'abc' }]) expect(cleanGoalInput(bad)).toBeNull()
  })
})

describe('goalProgress', () => {
  const g = { skill: 'Mining', type: 'level', target: 99 }
  it('reports a title and the xp needed', () => {
    expect(goalTitle(g)).toBe('99 Mining')
    expect(goalTitle({ skill: 'Magic', type: 'xp', target: 50_000_000 })).toBe('50M Magic XP')
    expect(goalTargetXp(g)).toBe(13_034_431)
  })
  it('works out percent, remaining and reached', () => {
    expect(goalProgress(g, 6_517_216)).toMatchObject({ percent: 50, remainingXp: 6_517_215, reached: false })
    expect(goalProgress(g, 13_034_431)).toMatchObject({ percent: 100, remainingXp: 0, reached: true })
    expect(goalProgress(g, 20_000_000).percent).toBe(100)
    expect(goalProgress(g, undefined).percent).toBe(0)
  })
})
