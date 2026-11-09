import { describe, it, expect } from 'vitest'
import { SKILL_INFO, SKILL_BY_SLUG } from '@/data/skillInfo'
import { goalsForSkill, findGoal, buildGoalContent, allGoalPages } from '@/data/calculatorGoals'

describe('calculator goal pages', () => {
  it('offers Hitpoints goals from level 10', () => {
    const slugs = goalsForSkill(SKILL_BY_SLUG.hitpoints).map((g) => g.slug)
    expect(slugs).toContain('10-to-99')
    expect(slugs).not.toContain('1-to-99')
  })

  it('only finds goals a skill offers', () => {
    expect(findGoal(SKILL_BY_SLUG.agility, '1-to-99')).toMatchObject({ from: 1, to: 99 })
    expect(findGoal(SKILL_BY_SLUG.agility, '5-to-6')).toBeNull()
    expect(findGoal(SKILL_BY_SLUG.agility, '1-TO-99')).toMatchObject({ slug: '1-to-99' })
  })

  it('builds every page fully, with unique paths and titles', () => {
    const pages = allGoalPages()
    const expected = SKILL_INFO.reduce((n, i) => n + goalsForSkill(i).length, 0)
    expect(pages.length).toBe(expected)
    expect(new Set(pages.map((p) => p.path)).size).toBe(pages.length)
    expect(new Set(pages.map((p) => p.title)).size).toBe(pages.length)
    for (const p of pages) {
      expect(p.routes.length).toBeGreaterThanOrEqual(3)
      expect(p.faq.length).toBeGreaterThanOrEqual(4)
      expect(p.milestones.at(-1).level).toBe(p.to)
      expect(p.description.length).toBeLessThanOrEqual(200)
      expect(JSON.stringify(p)).not.toContain('—')
    }
  })

  it('computes the XP for 1 to 99 from the game table', () => {
    const page = buildGoalContent(SKILL_BY_SLUG.agility, 1, 99)
    expect(page.xp).toBe(13_034_431)
    expect(page.faq[0].a).toContain('13,034,431')
  })
})
