import { describe, expect, it } from 'vitest'
import { buildMaxTotal } from '@/utils/builds'
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

  it('has goals left for a maxed player: virtual levels and 200M XP', () => {
    const maxed = Object.fromEntries(SKILL_NAMES.map((n) => [n, { xp: xpAtLevel(99), level: 99 }]))
    const ids = recommendedPlans(maxed).map((p) => p.id)
    expect(ids).toEqual(['virtual-126', 'xp-200m'])
    expect(recommendedPlans(stats({ Mining: 60 })).map((p) => p.id)).not.toContain('virtual-126')
  })
})

describe('featuredPlans', () => {
  it('leads with all skills to 70, combat to 99 and max account for a new player', async () => {
    const { featuredPlans } = await import('@/utils/recommendedPlans')
    const featured = featuredPlans(recommendedPlans(null))
    expect(featured.map((p) => p.id)).toEqual(['all-70', 'combat-99', 'all-99'])
  })

  it('fills the gaps with the nearest other plans when a featured one is already done', async () => {
    const { featuredPlans } = await import('@/utils/recommendedPlans')
    const levels = Object.fromEntries(SKILL_NAMES.map((s) => [s, 75]))
    const featured = featuredPlans(recommendedPlans(stats(levels)))
    expect(featured).toHaveLength(3)
    expect(featured.map((p) => p.id)).not.toContain('all-70')
    expect(new Set(featured.map((p) => p.id)).size).toBe(3)
  })
})

describe('groupedPlans', () => {
  it('splits skill goals from total level goals and caps each group', async () => {
    const { groupedPlans, MODAL_CAP } = await import('@/utils/recommendedPlans')
    const all = recommendedPlans(null)
    const g = groupedPlans(all)
    expect(g.skills.every((p) => p.kind !== 'total')).toBe(true)
    expect(g.totals.every((p) => p.kind === 'total')).toBe(true)
    expect(g.totals.length).toBeLessThanOrEqual(MODAL_CAP)
    expect(g.skills.length).toBeLessThanOrEqual(MODAL_CAP)
  })

  it('keeps the nearest and the furthest total level plan when it has to cut', async () => {
    const { groupedPlans } = await import('@/utils/recommendedPlans')
    const totals = recommendedPlans(null).filter((p) => p.kind === 'total')
    const g = groupedPlans(recommendedPlans(null))
    expect(g.totals[0].id).toBe(totals[0].id)
    expect(g.totals.at(-1).id).toBe(totals.at(-1).id)
    expect(new Set(g.totals.map((p) => p.id)).size).toBe(g.totals.length)
  })
})

describe('plans for a build', () => {
  const plan = (plans, id) => plans.find((p) => p.id === id)
  it('a skiller is never given a combat skill, and max means every skill a skiller can train', () => {
    const plans = recommendedPlans(null, 'skiller')
    const locked = ['Attack', 'Strength', 'Defence', 'Ranged', 'Prayer', 'Magic', 'Slayer', 'Hitpoints']
    for (const p of plans) for (const g of p.goals) expect(locked, `${p.id} ${g.skill}`).not.toContain(g.skill)
    expect(plan(plans, 'combat-99')).toBeUndefined()
    expect(plan(plans, 'all-99').title).toBe('Max your skiller: every skill to 99')
    expect(plan(plans, 'all-99').skillCount).toBe(SKILL_NAMES.length - 8)
    expect(plan(plans, 'all-99').description).toContain('Combat skills and Slayer stay locked')
  })
  it('the max total of a skiller is the most its skills can reach', () => {
    const totals = recommendedPlans(null, 'skiller').filter((p) => p.kind === 'total')
    expect(totals.at(-1).title).toMatch(/^Max total level/)
    expect(totals.at(-1).targetTotal).toBe(buildMaxTotal('skiller'))
    expect(totals.every((p) => p.targetTotal <= buildMaxTotal('skiller'))).toBe(true)
    expect(buildMaxTotal('skiller')).toBeLessThan(MAX_TOTAL)
  })
  it('a pure never trains Defence and stops Prayer at 52', () => {
    const plans = recommendedPlans(null, 'pure')
    const all99 = plan(plans, 'all-99')
    expect(all99.goals.find((g) => g.skill === 'Defence')).toBeUndefined()
    expect(all99.goals.find((g) => g.skill === 'Prayer').targetXp).toBe(xpAtLevel(52))
    expect(all99.goals.find((g) => g.skill === 'Strength').targetXp).toBe(xpAtLevel(99))
    const combat = plan(plans, 'combat-99')
    expect(combat.title).toBe('Pure combat skills')
    expect(combat.goals.map((g) => g.skill)).not.toContain('Defence')
  })
  it('a zerker takes Defence to 45', () => {
    const goals = plan(recommendedPlans(null, 'zerker'), 'all-99').goals
    expect(goals.find((g) => g.skill === 'Defence').targetXp).toBe(xpAtLevel(45))
  })
  it('a plain account gets the same plans as before', () => {
    expect(recommendedPlans(null, 'main').map((p) => p.id)).toEqual(recommendedPlans(null).map((p) => p.id))
    expect(plan(recommendedPlans(null, 'main'), 'all-99').title).toBe('Max your account: all skills to 99')
  })
  it('totalLevelPlan stops at the cap and refuses a total the build cannot reach', () => {
    expect(totalLevelPlan(skillStates(null), buildMaxTotal('skiller') + 1, 'skiller')).toBeNull()
    const goals = totalLevelPlan(skillStates(null), buildMaxTotal('pure'), 'pure')
    expect(goals.find((g) => g.skill === 'Defence')).toBeUndefined()
    expect(goals.find((g) => g.skill === 'Prayer').targetXp).toBe(xpAtLevel(52))
  })
})
