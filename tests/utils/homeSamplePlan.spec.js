import { describe, expect, it } from 'vitest'
import { SAMPLE_GOALS, buildSamplePlan } from '@/utils/homeSamplePlan'

describe('the welcome page example plan', () => {
  const start = new Date('2026-01-01T12:00:00Z')
  const plan = buildSamplePlan({ hoursPerDay: 2, start })

  it('is worked out by the planner for every sample goal', () => {
    expect(plan.rows.map((r) => r.skill)).toEqual(SAMPLE_GOALS.map((g) => g.skill))
    for (const r of plan.rows) {
      expect(r.to).toBe(99)
      expect(r.hours).toBeGreaterThan(0)
      expect(Number.isFinite(r.hours)).toBe(true)
      expect(r.method).toBeTruthy()
      expect(r.more).toBeGreaterThanOrEqual(0)
    }
  })
  it('does the goals one after another, so finish dates only move later', () => {
    const times = plan.rows.map((r) => r.done.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(times[0]).toBeGreaterThan(start.getTime())
  })
  it('adds up the hours and turns them into days at the daily pace', () => {
    expect(plan.totalHours).toBeCloseTo(plan.rows.reduce((s, r) => s + r.hours, 0), 6)
    expect(plan.days).toBe(Math.ceil(plan.totalHours / 2))
    expect(buildSamplePlan({ hoursPerDay: 4, start }).days).toBeLessThan(plan.days)
  })
})
