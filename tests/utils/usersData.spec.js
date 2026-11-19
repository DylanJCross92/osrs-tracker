import { describe, expect, it } from 'vitest'
import { activityLevel, filterUsers, usersSummary } from '@/components/admin/users/usersData'

const acct = (o = {}) => ({ id: 1, email: 'a@x.com', createdAt: '2026-01-01T00:00:00Z', verifiedAt: null, lastSeen: null, players: [], pending: 0, steps: 0, activeDays: 0, team: false, ...o })

describe('activityLevel', () => {
  it('scales with how many days of the range the account was active', () => {
    expect(activityLevel(acct({ activeDays: 0 }), 30).level).toBe('quiet')
    expect(activityLevel(acct({ activeDays: 3 }), 30).level).toBe('light')
    expect(activityLevel(acct({ activeDays: 5 }), 30).level).toBe('regular')
    expect(activityLevel(acct({ activeDays: 12 }), 30).level).toBe('high')
    expect(activityLevel(acct({ activeDays: 3 }), 7).level).toBe('high')
  })
  it('labels team accounts instead of judging them', () => {
    expect(activityLevel(acct({ team: true, activeDays: 20 }), 30)).toMatchObject({ level: 'team', share: 0 })
  })
  it('keeps the meter between 0 and 1', () => {
    expect(activityLevel(acct({ activeDays: 99 }), 30).share).toBe(1)
  })
})

describe('usersSummary', () => {
  it('counts confirmed emails, claimed players, waiting claims and active accounts', () => {
    const s = usersSummary(
      [acct({ verifiedAt: 'x', players: ['Zezima'], activeDays: 2 }), acct({ id: 2, pending: 1 }), acct({ id: 3, team: true, verifiedAt: 'x', activeDays: 4 }), acct({ id: 4 })],
      30,
    )
    expect(s).toMatchObject({ total: 4, verified: 2, verifiedPct: '50%', claimed: 1, claimedPct: '25%', waiting: 1, active: 1 })
  })
  it('does not divide by zero', () => {
    expect(usersSummary([], 30)).toMatchObject({ total: 0, verifiedPct: '-', activePct: '-' })
  })
})

describe('filterUsers', () => {
  const list = [
    acct({ id: 1, email: 'old@x.com', lastSeen: '2026-11-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', verifiedAt: 'x', players: ['Zezima'], activeDays: 9, steps: 40 }),
    acct({ id: 2, email: 'new@x.com', lastSeen: '2026-11-18T00:00:00Z', createdAt: '2026-11-17T00:00:00Z' }),
    acct({ id: 3, email: 'mid@x.com', lastSeen: '2026-11-10T00:00:00Z', createdAt: '2026-06-01T00:00:00Z', verifiedAt: 'x', activeDays: 2, steps: 5 }),
  ]
  const ids = (o) => filterUsers(list, o).map((a) => a.id)
  it('sorts by last seen, sign up or activity', () => {
    expect(ids({ sort: 'seen' })).toEqual([2, 3, 1])
    expect(ids({ sort: 'joined' })).toEqual([2, 3, 1])
    expect(ids({ sort: 'active' })).toEqual([1, 3, 2])
  })
  it('filters by confirmation, claims and activity', () => {
    expect(ids({ filter: 'unverified' })).toEqual([2])
    expect(ids({ filter: 'claimed' })).toEqual([1])
    expect(ids({ filter: 'noclaim' })).toEqual([2, 3])
    expect(ids({ filter: 'active' })).toEqual([3, 1])
    expect(ids({ filter: 'quiet' })).toEqual([2])
  })
  it('searches emails and claimed player names', () => {
    expect(ids({ query: 'MID@' })).toEqual([3])
    expect(ids({ query: 'zez' })).toEqual([1])
  })
})
