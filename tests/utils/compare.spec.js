import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { dailyXp, activeDays, currentStreak, compareSkills, compareHeadline, skillLeads, trackedSnapshots } from '@/utils/compare'

// Fixed "now": Wednesday 2026-03-18 15:00 UTC, which is 11:00 AM Eastern, so the current game day is 2026-03-18.
const NOW = Date.UTC(2026, 2, 18, 15, 0, 0)
const at = (daysAgo, hourUtc = 15) => new Date(Date.UTC(2026, 2, 18 - daysAgo, hourUtc, 0, 0)).toISOString()
const snap = (capturedAt, overallXp, extra = {}) => ({
  capturedAt,
  overallXp,
  overallLevel: 1000,
  overallRank: 100_000,
  skills: { Attack: { xp: overallXp, level: 90, rank: 5000 } },
  ...extra,
})

describe('dailyXp', () => {
  it('credits each snapshot gain to its own game day and returns n days oldest first', () => {
    const snaps = [snap(at(3), 1000), snap(at(2), 1500), snap(at(0), 2500)]
    const days = dailyXp(snaps, 4, NOW)
    expect(days).toHaveLength(4)
    expect(days.map((d) => d.xp)).toEqual([0, 500, 0, 1000])
  })

  it('returns all zeros when there are no snapshots in the window', () => {
    expect(dailyXp([snap(at(40), 1000)], 7, NOW).every((d) => d.xp === 0)).toBe(true)
    expect(dailyXp([], 7, NOW).every((d) => d.xp === 0)).toBe(true)
  })
})

describe('activeDays and currentStreak', () => {
  const snaps = [snap(at(5), 100), snap(at(4), 200), snap(at(3), 300), snap(at(2), 400), snap(at(1), 500)]
  it('counts days with gains', () => {
    expect(activeDays(snaps, 30, NOW)).toBe(4)
  })

  it('does not break a streak when today has no gains yet', () => {
    expect(currentStreak(snaps, NOW)).toBe(4)
  })

  it('includes today when it has gains', () => {
    expect(currentStreak([...snaps, snap(at(0), 600)], NOW)).toBe(5)
  })

  it('is 0 after a missed full day', () => {
    expect(currentStreak([snap(at(5), 100), snap(at(4), 200)], NOW)).toBe(0)
  })
})

describe('compareSkills and compareHeadline', () => {
  // The gain functions measure windows from the real clock, so pin it to the fixtures' "now".
  beforeAll(() => vi.useFakeTimers({ now: NOW, toFake: ['Date'] }))
  afterAll(() => vi.useRealTimers())
  const a = [snap(at(8), 1000), snap(at(0), 6000)]
  const b = [snap(at(8), 1000), snap(at(0), 3000)]
  const latestA = { ...a[1], overallRank: 50_000 }
  const latestB = { ...b[1], overallRank: 80_000 }

  it('marks the bigger gainer as the winner per skill', () => {
    const rows = compareSkills(a, b, latestA, latestB, 'week')
    const overall = rows.find((r) => r.skill === 'Overall')
    expect(overall.a.gain).toBe(5000)
    expect(overall.b.gain).toBe(2000)
    expect(overall.winner).toBe('a')
    expect(rows).toHaveLength(25)
  })

  it('leaves a tie without a winner', () => {
    const rows = compareSkills(a, a, latestA, latestA, 'week')
    expect(rows.every((r) => r.winner === null)).toBe(true)
  })

  it('treats a lower overall rank as leading', () => {
    const rows = compareHeadline(a, b, latestA, latestB, 'week')
    expect(rows.find((r) => r.key === 'rank').winner).toBe('a')
    expect(rows.find((r) => r.key === 'gain').winner).toBe('a')
  })

  it('counts skill leads without Overall', () => {
    const rows = compareSkills(a, b, latestA, latestB, 'week')
    // Only Attack carries XP in these fixtures, so A leads exactly one skill and Overall is not counted.
    expect(skillLeads(rows)).toEqual({ a: 1, b: 0 })
  })
})

describe('trackedSnapshots', () => {
  it('drops imported history from before the player was added, but never returns an empty list', () => {
    const player = { createdAt: at(2) }
    const list = [snap(at(30), 1), snap(at(1), 2)]
    expect(trackedSnapshots(player, list)).toHaveLength(1)
    expect(trackedSnapshots({ createdAt: at(0) }, [snap(at(30), 1)])).toHaveLength(1)
  })
})

import { barShare, roundsWon, topGainSkill, bestDay, sortSkillRows } from '@/utils/compare'

describe('bar, score and highlight helpers', () => {
  it('scales bars against the bigger side and gives lower rank the full bar', () => {
    expect(barShare({ key: 'gain', a: 50, b: 100 })).toEqual({ a: 0.5, b: 1 })
    expect(barShare({ key: 'gain', a: 0, b: 0 })).toEqual({ a: 0, b: 0 })
    expect(barShare({ key: 'rankMove', a: -5, b: 10 })).toEqual({ a: 0, b: 1 })
    expect(barShare({ key: 'rank', a: 100, b: 400 })).toEqual({ a: 1, b: 0.25 })
  })

  it('counts rounds won per side', () => {
    expect(roundsWon([{ winner: 'a' }, { winner: 'a' }, { winner: 'b' }, { winner: null }])).toEqual({ a: 2, b: 1, total: 4 })
  })

  it('finds each side top gain skill and ignores Overall', () => {
    const rows = [
      { skill: 'Overall', a: { gain: 900 }, b: { gain: 5 } },
      { skill: 'Attack', a: { gain: 100 }, b: { gain: 0 } },
      { skill: 'Magic', a: { gain: 300 }, b: { gain: 50 } },
    ]
    expect(topGainSkill(rows, 'a')).toEqual({ skill: 'Magic', gain: 300 })
    expect(topGainSkill(rows, 'b')).toEqual({ skill: 'Magic', gain: 50 })
    expect(topGainSkill([{ skill: 'Attack', a: { gain: 0 }, b: { gain: 0 } }], 'a')).toBeNull()
  })

  it('picks the biggest game day in range', () => {
    const snaps = [snap(at(4), 100), snap(at(3), 400), snap(at(2), 500)]
    const best = bestDay(snaps, 30, NOW)
    expect(best.xp).toBe(300)
  })

  it('sorts skill rows and separates idle skills', () => {
    const rows = [
      { skill: 'Overall', a: { gain: 9 }, b: { gain: 9 } },
      { skill: 'Attack', a: { gain: 10 }, b: { gain: 10 } },
      { skill: 'Magic', a: { gain: 500 }, b: { gain: 100 } },
      { skill: 'Prayer', a: { gain: 0 }, b: { gain: 0 } },
      { skill: 'Mining', a: { gain: 5 }, b: { gain: 400 } },
    ]
    expect(sortSkillRows(rows, 'total').active.map((r) => r.skill)).toEqual(['Magic', 'Mining', 'Attack'])
    expect(sortSkillRows(rows, 'gap').active.map((r) => r.skill)).toEqual(['Magic', 'Mining', 'Attack'])
    expect(sortSkillRows(rows, 'skill').active.map((r) => r.skill)).toEqual(['Attack', 'Magic', 'Mining'])
    expect(sortSkillRows(rows).idle.map((r) => r.skill)).toEqual(['Prayer'])
  })
})
