import { describe, expect, it } from 'vitest'
import { ago, compact, lastDays, niceMax } from '../../src/components/admin/stats/statsFormat.js'

describe('niceMax', () => {
  it.each([[0, 4], [3, 4], [7, 8], [80, 80], [81, 100], [100, 100], [130, 200], [1240, 2000]])('%s -> %s', (max, top) => expect(niceMax(max)).toBe(top))
  it('never cuts off the data', () => {
    for (const m of [5, 9, 17, 99, 101, 333, 4999, 12345, 2_600_000]) expect(niceMax(m)).toBeGreaterThanOrEqual(m)
  })
})

describe('compact', () => {
  it('shortens big numbers', () => {
    expect([compact(950), compact(1234), compact(25_000), compact(2_500_000), compact(3_100_000_000)]).toEqual(['950', '1.2k', '25k', '2.5M', '3.1B'])
  })
})

describe('lastDays', () => {
  it('ends on the given UTC day', () => {
    expect(lastDays(3, Date.UTC(2026, 0, 2, 23, 59))).toEqual(['2025-12-31', '2026-01-01', '2026-01-02'])
  })
})

describe('ago', () => {
  const now = Date.parse('2026-01-10T12:00:00Z')
  it('speaks in minutes, hours and days', () => {
    expect([ago('2026-01-10T11:59:50Z', now), ago('2026-01-10T11:55:00Z', now), ago('2026-01-10T09:00:00Z', now), ago('2026-01-08T12:00:00Z', now)]).toEqual(['just now', '5 min ago', '3 h ago', '2 d ago'])
  })
})
