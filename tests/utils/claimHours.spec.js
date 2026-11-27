import { describe, expect, it } from 'vitest'
import { CLAIM_HOURS, hoursText, withinClaimHours } from '@/utils/claimHours'
import { noticeKind } from '@/utils/noticeView'

describe('claim hours', () => {
  it('reads as 8:00 AM to 11:00 PM EST', () => {
    expect(hoursText()).toBe('8:00 AM to 11:00 PM EST')
  })
  it('is inside the hours from 8am up to 11pm Eastern', () => {
    // Nov 27 2026 is standard time (UTC-5)
    expect(withinClaimHours(new Date('2026-11-27T12:59:00Z'))).toBe(false) // 7:59 am
    expect(withinClaimHours(new Date('2026-11-27T13:00:00Z'))).toBe(true) // 8:00 am
    expect(withinClaimHours(new Date('2026-11-28T03:59:00Z'))).toBe(true) // 10:59 pm
    expect(withinClaimHours(new Date('2026-11-28T04:00:00Z'))).toBe(false) // 11:00 pm
  })
  it('follows daylight saving, because the zone is Eastern and not a fixed offset', () => {
    expect(withinClaimHours(new Date('2026-07-15T12:00:00Z'))).toBe(true) // 8:00 am EDT
    expect(withinClaimHours(new Date('2026-07-15T11:59:00Z'))).toBe(false)
    expect(CLAIM_HOURS.zone).toBe('America/New_York')
  })
  it('has a bell icon for the online-now ping, with a Review action', () => {
    expect(noticeKind('claim_ping').action).toBe('Review')
  })
})

import { timeOptions } from '@/utils/claimWindow'
describe('timeOptions', () => {
  it('lists every half hour of the day with 12-hour labels', () => {
    const t = timeOptions()
    expect(t).toHaveLength(48)
    expect(t[0]).toEqual({ value: '00:00', label: '12:00 AM' })
    expect(t[17]).toEqual({ value: '08:30', label: '8:30 AM' })
    expect(t[47]).toEqual({ value: '23:30', label: '11:30 PM' })
  })
  it('keeps a saved time that is between two half hours', () => {
    const t = timeOptions('18:05')
    expect(t).toHaveLength(49)
    expect(t.find((o) => o.value === '18:05').label).toBe('6:05 PM')
  })
})

import { closesIn, pingWaitLeft } from '@/utils/claimWindow'
describe('open claim reminder helpers', () => {
  const now = new Date('2026-11-27T12:00:00Z')
  it('counts the minutes until another ping is allowed', () => {
    expect(pingWaitLeft(null, now)).toBe(0)
    expect(pingWaitLeft('2026-11-27T11:45:00Z', now)).toBe(15)
    expect(pingWaitLeft('2026-11-27T11:00:00Z', now)).toBe(0)
  })
  it('says when a claim closes', () => {
    expect(closesIn('2026-12-10T12:00:00Z', now)).toBe('in 13 days')
    expect(closesIn('2026-11-28T12:00:00Z', now)).toBe('in 1 day')
    expect(closesIn('2026-11-27T20:00:00Z', now)).toBe('in under a day')
    expect(closesIn('2026-11-27T11:00:00Z', now)).toBe('now')
  })
})
