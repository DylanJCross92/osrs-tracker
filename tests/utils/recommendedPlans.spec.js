import { describe, expect, it } from 'vitest'
import { MAX_TOTAL, levelPlan, recommendedPlans, skillStates, suggestedPlans, totalLevelPlan } from '@/utils/recommendedPlans'
import { SKILL_NAMES } from '@/utils/osrsSkills'
import { levelAtXp, xpAtLevel } from '@/utils/planner'

const stats = (levels) => Object.fromEntries(SKILL_NAMES.map((s) => [s, { xp: xpAtLevel(levels[s] ?? 1), level: levels[s] ?? 1 }]))
const totalAfter = (states, goals) => {
  const target = Object.fromEntries(goals.map((g) => [g.skill, levelAtXp(g.targetXp)]))
  return states.reduce((sum, s) => sum + (target[s.skill] ?? s.level), 0)
}

describe('skillStates', () => {
  it('treats a missing or unranked skill as untrained (Hitpoints starts at 10)', () => {
    const states = skillStates({ Mining: { xp: -1 }, Attack: { xp: 5000 } })
    expect(states.find((s) => s.skill === 'Mining').level).toBe(1)
    expect(states.find((s) => s.skill === 'Hitpoints').level).toBe(10)
    expect(states.find((s) => s.skill === 'Attack').xp).toBe(5000)
    expect(states).toHaveLength(SKILL_NAMES.length)
  })
})

describe('level plans', () => {
  const states = skillStates(stats({ Mining: 95, Attack: 80, Magic: 50, Hitpoints: 90 }))

  it('only include skills still below the level, quickest wins first', () => {
    const goals = levelPlan(states, 90)
    const names = goals.map((g) => g.skill)
    expect(names).not.toContain('Mining')
    expect(names).not.toContain('Hitpoints')
    expect(names).toContain('Attack')
    const remaining = goals.map((g) => g.targetXp - g.currentXp)
    expect([...remaining].sort((a, b) => a - b)).toEqual(remaining)
    for (const g of goals) expect(g.targetXp).toBe(xpAtLevel(90))
  })

  it('can be limited to some skills', () => {
    expect(levelPlan(states, 99, ['Attack', 'Magic']).map((g) => g.skill).sort()).toEqual(['Attack', 'Magic'])
  })
})

describe('totalLevelPlan', () => {
  it('reaches exactly the target total and nothing past it', () => {
    const states = skillStates(stats({}))
    const now = states.reduce((s, x) => s + x.level, 0)
    const goals = totalLevelPlan(states, now + 60)
    expect(totalAfter(states, goals)).toBe(now + 60)
  })

  it('takes the cheapest levels first (never more XP than raising the lowest skills evenly)', () => {
    const states = skillStates(stats({ Attack: 60, Strength: 60, Defence: 60, Mining: 99, Magic: 40 }))
    const now = states.reduce((s, x) => s + x.level, 0)
    const goals = totalLevelPlan(states, now + 30)
    const greedyXp = goals.reduce((sum, g) => sum + (g.targetXp - g.currentXp), 0)
    // Putting all 30 levels into one skill is always dearer than spreading them by cost.
    const oneSkill = xpAtLevel(40 + 30) - xpAtLevel(40)
    expect(greedyXp).toBeLessThanOrEqual(oneSkill)
  })

  it('returns null when the target is already met or impossible', () => {
    const states = skillStates(stats({}))
    expect(totalLevelPlan(states, 10)).toBeNull()
    expect(totalLevelPlan(states, MAX_TOTAL + 1)).toBeNull()
  })

  it('a max total takes every skill to 99', () => {
    const goals = totalLevelPlan(skillStates(stats({})), MAX_TOTAL)
    expect(goals).toHaveLength(SKILL_NAMES.length)
    for (const g of goals) expect(g.targetXp).toBe(xpAtLevel(99))
  })
})

describe('recommendedPlans', () => {
  it('offers all-skills plans, combat and total levels for a new player', () => {
    const ids = recommendedPlans(null).map((p) => p.id)
    expect(ids).toEqual(expect.arrayContaining(['all-70', 'all-80', 'all-90', 'all-99', 'combat-99', 'total-1500', 'total-2000']))
  })

  it('leaves out plans the player has already finished and totals they have passed', () => {
    const levels = Object.fromEntries(SKILL_NAMES.map((s) => [s, 85]))
    const plans = recommendedPlans(stats(levels))
    const ids = plans.map((p) => p.id)
    expect(ids).not.toContain('all-70')
    expect(ids).not.toContain('all-80')
    expect(ids).toContain('all-90')
    expect(ids).not.toContain('total-1500') // 24 skills x 85 = 2040
    expect(ids).toContain('total-2100')
  })

  it('gives every plan goals shaped like planner goals, with the totals filled in', () => {
    for (const p of recommendedPlans(stats({ Mining: 50 }))) {
      expect(p.skillCount).toBe(p.goals.length)
      expect(p.xpNeeded).toBeGreaterThan(0)
      for (const g of p.goals) {
        expect(g).toMatchObject({ methodId: 'global', quests: [] })
        expect(g.targetXp).toBeGreaterThan(g.currentXp)
      }
    }
  })

  it('suggests a short mixed list for players who already have plans', () => {
    const list = suggestedPlans(recommendedPlans(stats({ Mining: 60 })), 4)
    expect(list).toHaveLength(4)
    expect(new Set(list.map((p) => p.id)).size).toBe(4)
    expect(list.some((p) => p.kind === 'total')).toBe(true)
  })
})
