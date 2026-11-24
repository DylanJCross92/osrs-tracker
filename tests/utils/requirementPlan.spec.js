import { describe, expect, it } from 'vitest'
import { diaryRequirements, goalsForLevels, planQuery, questRequirements } from '@/utils/requirementPlan'
import { decodePlan, xpAtLevel } from '@/utils/planner'
import { SKILL_NAMES } from '@/utils/osrsSkills'
import { diaryId } from '@/data/diaryIds'

describe('levels a quest needs', () => {
  it("adds up Legends' Quest and the quests it needs first", () => {
    const r = questRequirements("legends'-quest", {})
    // Its own levels and those of the quests before it (Heroes' Quest needs Cooking 53, Fishing 53, Herblore 25 and Mining 50 and so on).
    expect(r.skills.Agility).toBeGreaterThanOrEqual(50)
    expect(r.skills.Strength).toBeGreaterThanOrEqual(50)
    expect(Object.keys(r.skills).every((s) => SKILL_NAMES.includes(s))).toBe(true)
    expect(r.quests.length).toBeGreaterThan(3)
    expect(r.qp).toBeGreaterThan(100)
  })

  it('leaves out a quest that is done, and what only it asked for', () => {
    const all = questRequirements("legends'-quest", {})
    const some = questRequirements("legends'-quest", { "quest:heroes'-quest": 'have' })
    expect(some.quests).not.toContain("Heroes' Quest")
    expect(Object.keys(some.skills).length).toBeLessThanOrEqual(Object.keys(all.skills).length)
    for (const [skill, level] of Object.entries(some.skills)) expect(level).toBeLessThanOrEqual(all.skills[skill])
  })
})

describe('levels a diary tier needs', () => {
  it('include the tiers below that are not done, and the quests of all of them', () => {
    const hard = diaryRequirements(diaryId('ardougne', 'hard'), {})
    const easyAlone = diaryRequirements(diaryId('ardougne', 'easy'), {})
    expect(Object.keys(hard.skills).length).toBeGreaterThan(Object.keys(easyAlone.skills).length)
    expect(hard.skills.Thieving).toBeGreaterThanOrEqual(72)
    expect(hard.quests.length).toBeGreaterThan(0)
    const withLower = diaryRequirements(diaryId('ardougne', 'hard'), { [diaryId('ardougne', 'medium')]: 'have' })
    expect(withLower.skills.Thieving).toBeGreaterThanOrEqual(72)
  })
})

describe('goals for levels', () => {
  it('starts from level 1 without a player, or from their XP, and skips levels they have', () => {
    const skills = { Mining: 50, Smithing: 40, Magic: 20 }
    const fresh = goalsForLevels(skills, null)
    expect(fresh.map((g) => g.skill).sort()).toEqual(['Magic', 'Mining', 'Smithing'])
    expect(fresh.every((g) => g.currentXp === 0)).toBe(true)
    const own = goalsForLevels(skills, { Mining: xpAtLevel(60), Smithing: xpAtLevel(30), Magic: xpAtLevel(20) })
    expect(own.map((g) => g.skill)).toEqual(['Smithing'])
    expect(own[0]).toMatchObject({ currentXp: xpAtLevel(30), targetXp: xpAtLevel(40) })
    // Biggest jump first.
    expect(fresh[0].skill).toBe('Mining')
  })

  it('make an address the planner reads back as the same goals', () => {
    const goals = goalsForLevels({ Mining: 50, Smithing: 40 }, { Mining: xpAtLevel(10) })
    const back = decodePlan(planQuery({ goals, username: 'Zezima' }), SKILL_NAMES)
    expect(back.username).toBe('Zezima')
    expect(back.goals.map((g) => [g.skill, g.currentXp, g.targetXp])).toEqual(goals.map((g) => [g.skill, g.currentXp, g.targetXp]))
  })
})
