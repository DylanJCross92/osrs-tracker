import { describe, expect, it } from 'vitest'
import { SAMPLE_LEVELS, SAMPLE_PROFILE, buildSamplePlan } from '@/utils/homeSamplePlan'

describe('the welcome page example plan', () => {
  const plan = buildSamplePlan()

  it('is the Smart Planner answer for the sample account, with a quest shortcut and skill steps that each say why', () => {
    expect(plan.quests.length).toBeGreaterThanOrEqual(1)
    expect(plan.quests[0].title).toBeTruthy()
    expect(plan.steps.length).toBeGreaterThanOrEqual(3)
    for (const s of plan.steps) {
      expect(s.to).toBeGreaterThan(s.from)
      expect(s.reason.length).toBeGreaterThan(10)
      expect(s.time).toMatch(/^\d+ (min|h)$/)
    }
  })
  it('summarises the whole plan', () => {
    expect(plan.goals).toBeGreaterThan(plan.steps.length - 1)
    expect(plan.hours).toBeGreaterThan(0)
    expect(plan.days).toBeGreaterThanOrEqual(1)
    expect(plan.netGp === null || Number.isFinite(plan.netGp)).toBe(true)
  })
  it('is the same every time, so the page does not flicker between loads', () => {
    expect(buildSamplePlan()).toEqual(plan)
    expect(SAMPLE_PROFILE.members).toBe(true)
    expect(Object.keys(SAMPLE_LEVELS).length).toBeGreaterThan(20)
  })
})
