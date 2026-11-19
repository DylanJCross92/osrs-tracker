import { describe, it, expect } from 'vitest'
import { cleanGoalInput, cleanPlanInput, goalProgress, goalTitle, goalTargetXp, planSummary, targetFromXp, xpAtLevel } from '../../server/src/utils/goals.js'

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

describe('targetFromXp', () => {
  it('uses a level when the XP is exactly a level, otherwise an XP goal', () => {
    expect(targetFromXp(13_034_431)).toEqual({ type: 'level', target: 99 })
    expect(targetFromXp(xpAtLevel(70))).toEqual({ type: 'level', target: 70 })
    expect(targetFromXp(50_000_000)).toEqual({ type: 'xp', target: 50_000_000 })
    expect(targetFromXp(xpAtLevel(80) + 1)).toEqual({ type: 'xp', target: xpAtLevel(80) + 1 })
  })
})

describe('cleanPlanInput', () => {
  const good = { planId: 'plan-1_a', name: '  Max cape  ', goals: [{ skill: 'Agility', targetXp: 13_034_431 }, { skill: 'Mining', targetXp: 25_000_000 }] }
  it('cleans a plan into goals in plan order', () => {
    expect(cleanPlanInput(good)).toEqual({
      planId: 'plan-1_a',
      name: 'Max cape',
      goals: [{ skill: 'Agility', type: 'level', target: 99 }, { skill: 'Mining', type: 'xp', target: 25_000_000 }],
    })
  })
  it('keeps one goal per skill', () => {
    const p = cleanPlanInput({ ...good, goals: [good.goals[0], { skill: 'Agility', targetXp: xpAtLevel(80) }] })
    expect(p.goals).toHaveLength(1)
  })
  it('gives an unnamed plan a name', () => {
    expect(cleanPlanInput({ ...good, name: '   ' }).name).toBe('Training plan')
  })
  it('refuses what is not a real plan', () => {
    expect(cleanPlanInput(null)).toBeNull()
    expect(cleanPlanInput({ ...good, planId: 'bad id!' })).toBeNull()
    expect(cleanPlanInput({ ...good, goals: [] })).toBeNull()
    expect(cleanPlanInput({ ...good, goals: [{ skill: 'Cooking-ish', targetXp: 100 }] })).toBeNull()
    expect(cleanPlanInput({ ...good, goals: [{ skill: 'Agility', targetXp: 999_999_999 }] })).toBeNull()
    expect(cleanPlanInput({ ...good, goals: Array.from({ length: 31 }, () => good.goals[0]) })).toBeNull()
  })
})

describe('planSummary', () => {
  it('adds up the XP gained toward every target', () => {
    const goals = [{ targetXp: 100, currentXp: 50, reached: false }, { targetXp: 100, currentXp: 120, reached: true }, { targetXp: 200, currentXp: 0, reached: false }]
    expect(planSummary(goals)).toEqual({ percent: 37, reached: 1, count: 3 })
  })
  it('handles a plan with nothing in it', () => {
    expect(planSummary([])).toEqual({ percent: 0, reached: 0, count: 0 })
  })
})
