import { describe, expect, it } from 'vitest'
import { assignLanes, journeyPoints, skillHighlights, XP_99, XP_HALF } from '@/utils/historyHighlights'

const snap = (day, agilityXp, overallXp = agilityXp) => ({ capturedAt: `2026-01-${String(day).padStart(2, '0')}T12:00:00Z`, overallXp, skills: { Agility: { xp: agilityXp } } })

describe('history highlights', () => {
  it('dates each moment by the first snapshot that has the XP', () => {
    const { events, before } = skillHighlights([snap(1, 500_000), snap(2, 1_200_000), snap(3, 5_100_000), snap(4, XP_HALF + 1), snap(5, XP_99)], ['Agility'])
    expect(before).toEqual([])
    const by = Object.fromEntries(events.map((e) => [e.kind, e.at.slice(8, 10)]))
    expect(by).toEqual({ xp1m: '02', xp5m: '03', half: '04', l99: '05' })
    // newest first
    expect(events.map((e) => e.kind)).toEqual(['l99', 'half', 'xp5m', 'xp1m'])
  })

  it('puts what was already reached in the first snapshot apart, with no date', () => {
    const { events, before } = skillHighlights([snap(1, 7_000_000), snap(2, XP_99)], ['Agility'])
    expect(before.map((b) => b.kind).sort()).toEqual(['half', 'xp1m', 'xp5m'])
    expect(events.map((e) => e.kind)).toEqual(['l99'])
  })

  it('says when the day is only known to be within a gap between two snapshots', () => {
    const { events } = skillHighlights([snap(1, 900_000), snap(9, 1_100_000)], ['Agility'])
    expect(events[0]).toMatchObject({ kind: 'xp1m', gap: true })
    const close = skillHighlights([snap(1, 900_000), snap(2, 1_100_000)], ['Agility']).events[0]
    expect(close.gap).toBe(false)
  })

  it('has the total XP of the account at the time, and nothing for skills never reached', () => {
    const { events } = skillHighlights([snap(1, 0, 100), snap(2, 1_000_000, 4_000_000)], ['Agility', 'Mining'])
    expect(events).toHaveLength(1)
    expect(events[0].totalXp).toBe(4_000_000)
  })
})

describe('journey line', () => {
  it('never goes down and keeps the first and last points when thinned', () => {
    const snaps = Array.from({ length: 1000 }, (_, i) => snap((i % 28) + 1, i * 100, i === 500 ? 10 : i * 1000))
    const pts = journeyPoints(snaps, 100)
    expect(pts).toHaveLength(100)
    for (let i = 1; i < pts.length; i++) expect(pts[i].y).toBeGreaterThanOrEqual(pts[i - 1].y)
    expect(pts[pts.length - 1].y).toBe(999_000)
  })
})

describe('lanes for marks', () => {
  it('puts marks that would overlap in different lanes, and reuses a lane once there is room', () => {
    const { lanes, count } = assignLanes([10, 14, 18, 60, 64], 20)
    expect(lanes).toEqual([0, 1, 2, 0, 1])
    expect(count).toBe(3)
  })
})
