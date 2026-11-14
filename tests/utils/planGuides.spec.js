import { describe, it, expect } from 'vitest'
import { GUIDE_DEFS, allPlanGuides, buildPlanGuide, guideDef, guidePath } from '@/data/planGuides'
import { decodePlan } from '@/utils/planner'
import { SKILL_NAMES } from '@/utils/osrsSkills'
import { buildXpTable } from '@/data/xpTable'
import { xpAtLevel } from '@/utils/planner'

describe('plan guides', () => {
  const guides = allPlanGuides()
  it('builds a complete page for every plan it lists', () => {
    expect(guides.map((g) => g.slug)).toEqual(GUIDE_DEFS.map((d) => d.slug))
  })
  it('has real numbers, a title with the brand and unique paths', () => {
    for (const g of guides) {
      expect(g.totalXp).toBeGreaterThan(0)
      expect(g.totalHours).toBeGreaterThan(0)
      expect(g.title.endsWith('| TickGains')).toBe(true)
      expect(g.path).toBe(guidePath(g.slug))
      expect(g.skills.length).toBe(g.skillCount)
      expect(g.faq.length).toBeGreaterThanOrEqual(4)
    }
    expect(new Set(guides.map((g) => g.path)).size).toBe(guides.length)
  })
  it('the max cape plan is 99 in every skill', () => {
    const max = guides.find((g) => g.slug === 'max-cape')
    expect(max.skillCount).toBe(SKILL_NAMES.length)
    expect(max.skills.every((s) => s.to === 99)).toBe(true)
    // Every skill starts at level 1 (Hitpoints at 10), so the XP is the whole table.
    expect(max.totalXp).toBe(SKILL_NAMES.length * xpAtLevel(99) - xpAtLevel(10) + xpAtLevel(1))
  })
  it('bigger goals take more time than smaller ones', () => {
    const hours = (slug) => guides.find((g) => g.slug === slug).totalHours
    expect(hours('max-cape')).toBeGreaterThan(hours('all-90s'))
    expect(hours('all-90s')).toBeGreaterThan(hours('all-80s'))
    expect(hours('all-80s')).toBeGreaterThan(hours('all-70s'))
    expect(hours('total-level-2200')).toBeGreaterThan(hours('total-level-2000'))
  })
  it('opens the planner with the whole plan filled in, in the format Share makes', () => {
    const max = guides.find((g) => g.slug === 'max-cape')
    const url = new URL(max.plannerHref, 'https://tickgains.com')
    expect(url.pathname).toBe('/planner')
    expect(url.searchParams.get('from')).toBe('share')
    expect(url.searchParams.has('u')).toBe(false)
    const decoded = decodePlan(Object.fromEntries(url.searchParams), SKILL_NAMES)
    expect(decoded.goals).toHaveLength(max.skillCount)
    expect(decoded.goals.every((g) => g.targetXp === xpAtLevel(99))).toBe(true)
  })
  it('looks guides up by slug and rejects unknown ones', () => {
    expect(guideDef('MAX-CAPE')?.slug).toBe('max-cape')
    expect(guideDef('nope')).toBeNull()
    expect(buildPlanGuide(guideDef('combat-99s')).skillCount).toBe(7)
  })
})

describe('xp table', () => {
  const t = buildXpTable()
  it('has a row for every level up to 126, matching the planner table', () => {
    expect(t.rows).toHaveLength(126)
    expect(t.rows[98]).toMatchObject({ level: 99, xp: 13034431, toNext: 1356729 })
    expect(t.rows[0]).toMatchObject({ level: 1, xp: 0, toNext: 83 })
    expect(t.rows[125].toNext).toBeNull()
  })
  it('puts the facts people search for in the answers', () => {
    const all = t.faq.map((f) => f.a).join(' ')
    expect(all).toContain('13,034,431')
    expect(all).toContain('200,000,000')
    expect(t.title).toContain('OSRS XP Table')
  })
})

describe('plan guide order', () => {
  it('lists the shortest training first, and the planner link follows the same order', () => {
    const max = allPlanGuides().find((g) => g.slug === 'max-cape')
    const hours = max.skills.map((s) => s.hours)
    expect(hours).toEqual([...hours].sort((a, b) => a - b))
    const url = new URL(max.plannerHref, 'https://tickgains.com')
    const decoded = decodePlan(Object.fromEntries(url.searchParams), SKILL_NAMES)
    expect(decoded.goals.map((g) => g.skill)).toEqual(max.skills.map((s) => s.skill))
  })
})
