import { describe, expect, it } from 'vitest'
import { WEEKLY_CLAN, weeklyRaceWindow } from '../../server/src/utils/weeklyRace.js'

const iso = (d) => d.toISOString()

describe('weeklyRaceWindow', () => {
  it('runs from now to the next Monday midnight Eastern, titled for that Monday to Sunday', () => {
    // Wednesday 25 Nov 2026, 15:00 UTC = 10:00 EST. Next Monday midnight EST is 30 Nov 05:00 UTC.
    const w = weeklyRaceWindow(Date.parse('2026-11-25T15:00:00Z'))
    expect(iso(w.startsAt)).toBe('2026-11-25T15:00:00.000Z')
    expect(iso(w.endsAt)).toBe('2026-11-30T05:00:00.000Z')
    expect(w.title).toBe('Weekly XP race, Nov 25 to Nov 29')
  })
  it('starts at Monday midnight when the job runs just after it', () => {
    // Monday 30 Nov 2026 05:00:20 UTC = 00:00:20 EST.
    const w = weeklyRaceWindow(Date.parse('2026-11-30T05:00:20Z'))
    expect(iso(w.startsAt)).toBe('2026-11-30T05:00:20.000Z')
    expect(iso(w.endsAt)).toBe('2026-12-07T05:00:00.000Z')
    expect(w.title).toBe('Weekly XP race, Nov 30 to Dec 6')
  })
  it('still belongs to the old week until Eastern midnight, even when it is already Monday in UTC', () => {
    // Monday 30 Nov 03:00 UTC is still Sunday 29 Nov 22:00 EST.
    const w = weeklyRaceWindow(Date.parse('2026-11-30T03:00:00Z'))
    expect(iso(w.endsAt)).toBe('2026-11-30T05:00:00.000Z')
    expect(w.title).toBe('Weekly XP race, Nov 29 to Nov 29')
  })
  it('handles a week with a clock change (the end moves from 05:00 to 04:00 UTC)', () => {
    // Summer time began Sunday 8 Mar 2026. Wednesday 4 Mar: the week ends Monday 9 Mar at 00:00 EDT = 04:00 UTC.
    const w = weeklyRaceWindow(Date.parse('2026-03-04T15:00:00Z'))
    expect(iso(w.endsAt)).toBe('2026-03-09T04:00:00.000Z')
    expect(w.title).toBe('Weekly XP race, Mar 4 to Mar 8')
    // In summer time the next Monday midnight is 04:00 UTC too.
    expect(iso(weeklyRaceWindow(Date.parse('2026-07-15T15:00:00Z')).endsAt)).toBe('2026-07-20T04:00:00.000Z')
    // And when it falls back (Sunday 1 Nov 2026), the week ending Monday 2 Nov is at 00:00 EST = 05:00 UTC.
    expect(iso(weeklyRaceWindow(Date.parse('2026-10-28T15:00:00Z')).endsAt)).toBe('2026-11-02T05:00:00.000Z')
  })
  it('is named for the Monday when it starts on time', () => {
    expect(weeklyRaceWindow(Date.parse('2026-11-30T05:00:20Z')).title).toBe('Weekly XP race, Nov 30 to Dec 6')
    expect(weeklyRaceWindow(Date.parse('2026-11-30T05:30:00Z')).title).toBe('Weekly XP race, Nov 30 to Dec 6')
  })
  it('is always a whole week or less, and ends in the future', () => {
    for (const t of ['2026-01-01T00:00:00Z', '2026-06-15T12:34:56Z', '2026-12-31T23:59:59Z']) {
      const w = weeklyRaceWindow(Date.parse(t))
      expect(w.endsAt.getTime()).toBeGreaterThan(Date.parse(t))
      expect(w.endsAt.getTime() - w.startsAt.getTime()).toBeLessThanOrEqual(7 * 86_400_000 + 3_600_000)
    }
  })
  it('names the official clan', () => {
    expect(WEEKLY_CLAN.slug).toBe('tickgains-weekly')
  })
})
