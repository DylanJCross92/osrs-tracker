import { describe, it, expect, vi } from 'vitest'
import { formatXp, formatSignedXp, xpForSkill, levelForSkill, xpGain } from '@/utils/osrsSkills'

describe('formatXp', () => {
  it('compacts millions with 2 decimals under 10M, 1 decimal at/above', () => {
    expect(formatXp(4_200_000)).toBe('4.2M')
    expect(formatXp(12_345_678)).toBe('12.3M')
  })

  it('compacts billions with 2 decimals', () => {
    expect(formatXp(3_746_000_000)).toBe('3.75B')
    expect(formatXp(1_000_000_000)).toBe('1B')
  })

  it('compacts thousands with 1 decimal', () => {
    expect(formatXp(12_000)).toBe('12K')
    expect(formatXp(12_500)).toBe('12.5K')
  })

  it('leaves small numbers as-is', () => {
    expect(formatXp(850)).toBe('850')
    expect(formatXp(0)).toBe('0')
  })
})

describe('formatSignedXp', () => {
  it('signs a gain and a loss, and leaves zero unsigned', () => {
    expect(formatSignedXp(50_000)).toBe('+50K')
    expect(formatSignedXp(-50_000)).toBe('-50K')
    expect(formatSignedXp(0)).toBe('0')
  })
})

describe('xpForSkill / levelForSkill', () => {
  const snapshot = { overallXp: 1000, overallLevel: 10, skills: { Attack: { xp: 500, level: 5, rank: 100 } } }

  it('reads the overall totals for "Overall"', () => {
    expect(xpForSkill(snapshot, 'Overall')).toBe(1000)
    expect(levelForSkill(snapshot, 'Overall')).toBe(10)
  })

  it('reads a named skill out of the skills map', () => {
    expect(xpForSkill(snapshot, 'Attack')).toBe(500)
    expect(levelForSkill(snapshot, 'Attack')).toBe(5)
  })

  it('defaults a missing skill to 0 xp / level 1', () => {
    expect(xpForSkill(snapshot, 'Magic')).toBe(0)
    expect(levelForSkill(snapshot, 'Magic')).toBe(1)
  })
})

describe('xpGain', () => {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const snapshots = [
    { capturedAt: new Date(now - 40 * day).toISOString(), overallXp: 1000, skills: {} },
    { capturedAt: new Date(now - 10 * day).toISOString(), overallXp: 1500, skills: {} },
    { capturedAt: new Date(now - 2 * day).toISOString(), overallXp: 1800, skills: {} },
    { capturedAt: new Date(now).toISOString(), overallXp: 2000, skills: {} },
  ]

  it('"all" diffs the very first snapshot against the latest', () => {
    expect(xpGain(snapshots, 'Overall', 'all')).toBe(1000)
  })

  it('"week" starts from the newest snapshot from before the window (the state at its start)', () => {
    // The snapshot 10 days back is the newest one before the 7-game-day window, so it is the starting state.
    expect(xpGain(snapshots, 'Overall', 'week')).toBe(500)
  })

  it('falls back to the first snapshot when the window predates all data', () => {
    expect(xpGain(snapshots, 'Overall', 'month')).toBe(1000)
  })

  it('returns 0 for an empty history', () => {
    expect(xpGain([], 'Overall', 'day')).toBe(0)
  })
})

describe('xpGain over the last 30 game days', () => {
  const NOW = Date.UTC(2026, 10, 23, 14, 54)
  const at = (iso, xp) => ({ capturedAt: new Date(iso).toISOString(), overallXp: xp, skills: {} })
  // The window starts at 6 AM Eastern (11:00 UTC) on Tue 24 Oct, 29 days before the current game day began, not 30 x 24 hours back.
  const snaps = [at('2026-10-20T00:00:00Z', 100), at('2026-10-24T02:00:00Z', 400), at('2026-10-25T20:00:00Z', 900), at('2026-11-20T19:00:00Z', 1500)]
  it('counts from the last snapshot before the 6 AM edge thirty game days back', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    try {
      expect(xpGain(snaps, 'Overall', 'month')).toBe(1100)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('xpGain over the last 7 game days', () => {
  // Monday 23 Nov 2026, 9:54 AM Eastern. The window starts at 6 AM Eastern on Tue 17 Nov (11:00 UTC), not 7 x 24 hours back.
  const NOW = Date.UTC(2026, 10, 23, 14, 54)
  const at = (iso, xp) => ({ capturedAt: new Date(iso).toISOString(), overallXp: xp, skills: {} })
  const snaps = [at('2026-11-15T23:42:00Z', 100), at('2026-11-16T05:00:00Z', 300), at('2026-11-16T20:40:00Z', 900), at('2026-11-17T02:38:00Z', 1000), at('2026-11-20T19:00:00Z', 1130)]
  it('counts from the last snapshot before the 6 AM edge seven game days back, so the day before it is not in the week', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    try {
      expect(xpGain(snaps, 'Overall', 'week')).toBe(130)
    } finally {
      vi.useRealTimers()
    }
  })
})
