import { beforeEach, describe, expect, it } from 'vitest'
import { claimPlanEvent } from '@/utils/planEvents'

describe('claimPlanEvent', () => {
  beforeEach(() => localStorage.clear())
  const noon = new Date('2026-11-11T17:00:00Z').getTime()

  it('counts a view once per day per plan, and again the next day', () => {
    expect(claimPlanEvent('abc123xyz', 'view', noon)).toBe(true)
    expect(claimPlanEvent('abc123xyz', 'view', noon + 60_000)).toBe(false)
    expect(claimPlanEvent('other12345', 'view', noon)).toBe(true)
    expect(claimPlanEvent('abc123xyz', 'view', noon + 86_400_000)).toBe(true)
  })

  it('counts a use only once for a plan, ever', () => {
    expect(claimPlanEvent('abc123xyz', 'use', noon)).toBe(true)
    expect(claimPlanEvent('abc123xyz', 'use', noon + 10 * 86_400_000)).toBe(false)
    // A view is a separate thing from a use.
    expect(claimPlanEvent('abc123xyz', 'view', noon)).toBe(true)
  })

  it('ignores unknown events and empty slugs', () => {
    expect(claimPlanEvent('', 'view', noon)).toBe(false)
    expect(claimPlanEvent('abc123xyz', 'click', noon)).toBe(false)
  })
})
