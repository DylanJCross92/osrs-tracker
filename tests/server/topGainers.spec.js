import { describe, it, expect } from 'vitest'
import { pickTopGainer, summarizeTopGainer, tenureOf, topGainerHeadline } from '../../server/src/utils/topGainers.js'

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

describe('tenureOf', () => {
  it('words hours and days, singular and plural', () => {
    expect(tenureOf('hours', 5).text).toBe('5 hours')
    expect(tenureOf('hours', 1).text).toBe('1 hour')
    expect(tenureOf('days', 1).text).toBe('1 day')
    expect(tenureOf('days', 1200).text).toBe('1,200 days')
  })
  it('rounds down and calls under an hour "<1 hour"', () => {
    expect(tenureOf('hours', 2.9).value).toBe(2)
    expect(tenureOf('hours', 0.4)).toMatchObject({ value: 0, display: '<1' })
    expect(tenureOf('hours', 0.4).display).toBe('<1')
  })
})

describe('how long the current lead has lasted', () => {
  const NOW = Date.parse('2026-01-10T15:00:00Z')
  const ago = (hours) => new Date(NOW - hours * 3_600_000).toISOString()
  const row = (day, xp, since) => ({ day, xp, since })

  it('is in hours while the lead is under a day old', () => {
    const s = summarizeTopGainer([row('2026-01-10', 500, ago(5.5))], '2026-01-10', NOW)
    expect(s.tenure).toMatchObject({ unit: 'hours', value: 5, text: '5 hours' })
    expect(s.headline.text).toBe('5 hours')
  })
  it('keeps the total days as the headline for a player with history, and the hours as the current lead', () => {
    const s = summarizeTopGainer([row('2026-01-03', 9), row('2026-01-10', 500, ago(3))], '2026-01-10', NOW)
    expect(s.tenure.text).toBe('3 hours')
    expect(s.headline.text).toBe('2 days')
  })
  it('switches to days once the lead has run across days', () => {
    const s = summarizeTopGainer([row('2026-01-09', 9), row('2026-01-10', 500, ago(2))], '2026-01-10', NOW)
    expect(s.tenure).toMatchObject({ unit: 'days', value: 2 })
    expect(s.headline.text).toBe('2 days')
  })
  it('falls back to days when the start of the lead is not known', () => {
    expect(summarizeTopGainer([row('2026-01-10', 500)], '2026-01-10', NOW).tenure.text).toBe('1 day')
  })
  it('has no tenure when they are not leading now', () => {
    expect(summarizeTopGainer([row('2026-01-09', 500, ago(30))], '2026-01-10', NOW).tenure).toBeNull()
  })
})

describe('topGainerHeadline', () => {
  it('says day or days, or hours', () => {
    expect(topGainerHeadline({ days: 1 })).toBe('1 day as top gainer')
    expect(topGainerHeadline({ days: 12 })).toBe('12 days as top gainer')
    expect(topGainerHeadline({ days: 1200 })).toBe('1,200 days as top gainer')
    expect(topGainerHeadline({ days: 1, headline: tenureOf('hours', 3) })).toBe('3 hours as top gainer')
  })
})

describe('pickTopGainer by period', () => {
  const players = [
    { id: 1, gains: { day: { xp: 5_000, topSkill: 'Mining' }, h24: { xp: 50_000, topSkill: 'Fishing' } } },
    { id: 2, gains: { day: { xp: 90_000, topSkill: 'Cooking' }, h24: { xp: 60_000, topSkill: 'Cooking' } } },
    { id: 3, gains: { day: null, h24: null } },
  ]
  it('picks the leader of today (6 AM to 6 AM) by default and of the last 24 hours when asked', () => {
    expect(pickTopGainer(players).player.id).toBe(2)
    expect(pickTopGainer(players, 'h24')).toMatchObject({ player: { id: 2 }, xp: 60_000, topSkill: 'Cooking' })
    const early = [{ id: 1, gains: { day: { xp: 100, topSkill: 'Mining' }, h24: { xp: 900_000, topSkill: 'Fishing' } } }, { id: 2, gains: { day: { xp: 400, topSkill: 'Cooking' }, h24: { xp: 3_000, topSkill: 'Cooking' } } }]
    // just after 6 AM the game day has barely started, but the 24 hours still show who has been gaining
    expect(pickTopGainer(early).player.id).toBe(2)
    expect(pickTopGainer(early, 'h24').player.id).toBe(1)
  })
  it('is null when nobody has gained', () => {
    expect(pickTopGainer([{ id: 1, gains: { h24: { xp: 0 } } }], 'h24')).toBeNull()
  })
})
