import { describe, it, expect } from 'vitest'
import { formatXp, formatSignedXp, xpForSkill, levelForSkill, xpGain } from '@/utils/osrsSkills'

describe('formatXp', () => {
  it('compacts millions with 2 decimals under 10M, 1 decimal at/above', () => {
    expect(formatXp(4_200_000)).toBe('4.2M')
    expect(formatXp(12_345_678)).toBe('12.3M')
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

  it('"week" uses the oldest snapshot still inside the trailing window', () => {
    expect(xpGain(snapshots, 'Overall', 'week')).toBe(200)
  })

  it('falls back to the first snapshot when the window predates all data', () => {
    expect(xpGain(snapshots, 'Overall', 'month')).toBe(500)
  })

  it('returns 0 for an empty history', () => {
    expect(xpGain([], 'Overall', 'day')).toBe(0)
  })
})
