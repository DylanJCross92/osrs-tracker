import { describe, it, expect } from 'vitest'
import { pickTopGainer, summarizeTopGainer, topGainerHeadline } from '../../server/src/utils/topGainers.js'

const player = (id, xp, topSkill = 'Mining') => ({ id, gains: { day: xp == null ? null : { xp, topSkill } } })

describe('pickTopGainer', () => {
  it('picks the player with the most XP today', () => {
    expect(pickTopGainer([player(1, 500), player(2, 900), player(3, 100)]).player.id).toBe(2)
  })
  it('returns the XP and top skill', () => {
    expect(pickTopGainer([player(1, 500, 'Fishing')])).toMatchObject({ xp: 500, topSkill: 'Fishing' })
  })
  it('is null while nobody has gained XP', () => {
    expect(pickTopGainer([player(1, 0), player(2, null)])).toBeNull()
    expect(pickTopGainer([])).toBeNull()
  })
  it('keeps the first of a tie', () => {
    expect(pickTopGainer([player(1, 700), player(2, 700)]).player.id).toBe(1)
  })
})

describe('summarizeTopGainer', () => {
  const row = (day, xp) => ({ day, xp })
  it('is zero days for no rows', () => {
    expect(summarizeTopGainer([], '2026-01-10')).toEqual({ days: 0 })
  })
  it('counts days, the best day and the first and last day', () => {
    const s = summarizeTopGainer([row('2026-01-08', 100), row('2026-01-03', 900), row('2026-01-05', 400)], '2026-01-10')
    expect(s).toMatchObject({ days: 3, bestXp: 900, bestDay: '2026-01-03', firstDay: '2026-01-03', lastDay: '2026-01-08' })
  })
  it('works out the current run and the longest run', () => {
    const s = summarizeTopGainer([row('2026-01-01', 1), row('2026-01-02', 1), row('2026-01-03', 1), row('2026-01-08', 1), row('2026-01-09', 1)], '2026-01-10')
    expect(s.longest).toBe(3)
    expect(s.streak).toBe(2)
  })
  it('does not break the run for a day still in progress', () => {
    expect(summarizeTopGainer([row('2026-01-08', 1), row('2026-01-09', 1)], '2026-01-10').streak).toBe(2)
    expect(summarizeTopGainer([row('2026-01-09', 1), row('2026-01-10', 1)], '2026-01-10')).toMatchObject({ streak: 2, leadingNow: true })
  })
  it('has no current run once a full day has been missed', () => {
    const s = summarizeTopGainer([row('2026-01-05', 1), row('2026-01-06', 1)], '2026-01-10')
    expect(s.streak).toBe(0)
    expect(s.leadingNow).toBe(false)
  })
})

describe('topGainerHeadline', () => {
  it('says day or days', () => {
    expect(topGainerHeadline({ days: 1 })).toBe('1 day as top gainer')
    expect(topGainerHeadline({ days: 12 })).toBe('12 days as top gainer')
    expect(topGainerHeadline({ days: 1200 })).toBe('1,200 days as top gainer')
  })
})
