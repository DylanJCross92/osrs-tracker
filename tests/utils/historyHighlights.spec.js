import { describe, expect, it } from 'vitest'
import { skillHighlights, skillRows, XP_99, XP_HALF } from '@/utils/historyHighlights'

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

describe('skill rows', () => {
  const snaps = [
    { capturedAt: '2026-01-01T12:00:00Z', overallXp: 1, skills: { Agility: { xp: 5_000_000 }, Mining: { xp: 100 }, Cooking: { xp: 100 } } },
    { capturedAt: '2026-02-01T12:00:00Z', overallXp: 2, skills: { Agility: { xp: XP_99 }, Mining: { xp: 1_500_000 }, Cooking: { xp: 100 } } },
    { capturedAt: '2026-03-01T12:00:00Z', overallXp: 3, skills: { Agility: { xp: XP_99 }, Mining: { xp: XP_99 }, Cooking: { xp: 100 } } },
    { capturedAt: '2026-04-01T12:00:00Z', overallXp: 4, skills: { Agility: { xp: 200_000_000 }, Mining: { xp: XP_99 }, Cooking: { xp: 100 } } },
  ]
  it('has a row for each skill at 99, in the order the 99s came, with its start and 200M', () => {
    const { events, before } = skillHighlights(snaps, ['Agility', 'Mining', 'Cooking'])
    const rows = skillRows(events, before)
    expect(rows.map((r) => r.skill)).toEqual(['Agility', 'Mining'])
    expect(rows[0].t99).toBe(new Date('2026-02-01T12:00:00Z').getTime())
    expect(rows[0].t200).toBe(new Date('2026-04-01T12:00:00Z').getTime())
    expect(rows[1]).toMatchObject({ start: new Date('2026-02-01T12:00:00Z').getTime(), t99: new Date('2026-03-01T12:00:00Z').getTime(), t200: undefined })
  })

  it('puts a skill that was already 99 when tracking began first, with no date', () => {
    const { events, before } = skillHighlights([{ capturedAt: '2026-01-01T00:00:00Z', overallXp: 1, skills: { Agility: { xp: XP_99 }, Mining: { xp: 1 } } }, { capturedAt: '2026-02-01T00:00:00Z', overallXp: 2, skills: { Agility: { xp: XP_99 }, Mining: { xp: XP_99 } } }], ['Agility', 'Mining'])
    const rows = skillRows(events, before)
    expect(rows.map((r) => [r.skill, r.t99 === null])).toEqual([['Agility', true], ['Mining', false]])
  })
})
