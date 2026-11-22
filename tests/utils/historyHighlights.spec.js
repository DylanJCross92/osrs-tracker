import { describe, expect, it } from 'vitest'
import { clusterMarks, defaultKinds, journeyPoints, skillHighlights, XP_99, XP_HALF } from '@/utils/historyHighlights'

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

describe('marks along the line', () => {
  it('groups marks that are close together into one, biggest first, and keeps far ones apart', () => {
    const items = [
      { x: 105, rank: 1, atMs: 1 },
      { x: 110, rank: 4, atMs: 2 },
      { x: 112, rank: 4, atMs: 3 },
      { x: 300, rank: 2, atMs: 4 },
    ]
    const c = clusterMarks(items, 30)
    expect(c).toHaveLength(2)
    expect(c[0].items.map((i) => i.atMs)).toEqual([3, 2, 1])
    expect(c[0].x).toBeCloseTo((105 + 110 + 112) / 3)
    expect(c[1].items).toHaveLength(1)
  })

  it('starts with the biggest moments only when there are a lot of them', () => {
    expect([...defaultKinds({ l99: 24, xp200m: 18, half: 24, xp5m: 24, xp1m: 24 })]).toEqual(['l99', 'xp200m'])
    expect([...defaultKinds({ l99: 1, half: 1, xp5m: 1, xp1m: 9 })]).toEqual(['l99', 'half', 'xp5m', 'xp1m'])
    expect([...defaultKinds({ l99: 80 })]).toEqual(['l99'])
    expect([...defaultKinds({})]).toEqual([])
  })
})
