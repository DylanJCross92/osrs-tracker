import { describe, expect, it } from 'vitest'
import { dayLabels, fillCounts, growthItems, mergeFeed } from '../../server/src/utils/siteOverview.js'

describe('fillCounts', () => {
  it('gives one count per day, oldest first, zero on quiet days', () => {
    expect(fillCounts([{ day: '2026-01-09', n: 2 }, { day: '2026-01-10', n: 3 }], 4, '2026-01-10')).toEqual([0, 0, 2, 3])
  })
  it('adds rows that share a day and ignores days outside the window', () => {
    expect(fillCounts([{ day: '2026-01-10', n: 1 }, { day: '2026-01-10', n: 4 }, { day: '2025-12-01', n: 9 }], 2, '2026-01-10')).toEqual([0, 5])
  })
})

describe('dayLabels', () => {
  it('lines up with the counts', () => {
    expect(dayLabels(3, '2026-03-01')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01'])
  })
})

describe('growthItems', () => {
  it('reports the total, how many were added in the window and a count per day', () => {
    const defs = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]
    const out = growthItems(defs, { a: 10 }, [{ key: 'a', day: '2026-01-10', n: 2 }, { key: 'a', day: '2026-01-09', n: 1 }, { key: 'b', day: '2026-01-10', n: 7 }], 3, '2026-01-10')
    expect(out[0]).toEqual({ key: 'a', label: 'A', total: 10, added: 3, daily: [0, 1, 2] })
    expect(out[1]).toMatchObject({ total: 0, added: 7, daily: [0, 0, 7] })
  })
})

describe('mergeFeed', () => {
  it('puts the newest first across lists, cuts to the limit and drops entries with no time', () => {
    const out = mergeFeed(
      [[{ at: '2026-01-01T10:00:00Z', kind: 'player', text: 'a' }], [{ at: '2026-01-02T10:00:00Z', kind: 'account', text: 'b' }, { at: null, kind: 'x', text: 'c' }, { at: 'junk', kind: 'x', text: 'd' }]],
      5,
    )
    expect(out.map((e) => e.text)).toEqual(['b', 'a'])
    expect(out[0].at).toBe('2026-01-02T10:00:00.000Z')
  })
})
