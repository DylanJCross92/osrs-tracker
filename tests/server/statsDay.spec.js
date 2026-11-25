import { describe, expect, it } from 'vitest'
import { SQL_STATS_TODAY, sqlStatsDay, statsDay } from '../../server/src/utils/statsDay.js'
import { buildJourney } from '../../server/src/utils/journeys.js'

describe('statsDay', () => {
  it('cuts the day at midnight Eastern, not UTC', () => {
    // Wednesday Nov 25 2026, 8:44 PM EST is already Thursday in UTC.
    expect(statsDay('2026-11-26T01:44:00Z')).toBe('2026-11-25')
    expect(statsDay('2026-11-26T04:59:59Z')).toBe('2026-11-25') // 11:59:59 PM EST
    expect(statsDay('2026-11-26T05:00:00Z')).toBe('2026-11-26') // midnight EST
  })
  it('follows daylight saving: midnight is 4 hours from UTC in summer', () => {
    expect(statsDay('2026-07-02T03:59:59Z')).toBe('2026-07-01')
    expect(statsDay('2026-07-02T04:00:00Z')).toBe('2026-07-02')
  })
  it('gives a day for a number of milliseconds too', () => {
    expect(statsDay(Date.parse('2026-01-02T01:00:00Z'))).toBe('2026-01-01')
  })
  it('builds the same cut for the database', () => {
    expect(SQL_STATS_TODAY).toContain('America/New_York')
    expect(sqlStatsDay('created_at')).toBe("((created_at) AT TIME ZONE 'America/New_York')::date")
  })
})

describe('journey days', () => {
  it('counts a late-evening event on the Eastern day it happened', () => {
    const rows = [
      { at: '2026-11-26T01:44:00Z', name: 'a', props: {} }, // 8:44 PM Wed in New York
      { at: '2026-11-26T05:30:00Z', name: 'b', props: {} }, // 12:30 AM Thu
    ]
    const j = buildJourney(rows, 3, '2026-11-26')
    expect(j.daily).toEqual([{ day: '2026-11-24', n: 0 }, { day: '2026-11-25', n: 1 }, { day: '2026-11-26', n: 1 }])
  })
})
