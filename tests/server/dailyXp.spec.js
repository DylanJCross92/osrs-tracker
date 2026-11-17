import { describe, it, expect } from 'vitest'
import { fillDailyXp } from '../../server/src/utils/dailyXp.js'

describe('fillDailyXp', () => {
  it('returns one entry per day, oldest first, ending today', () => {
    const out = fillDailyXp([{ day: '2026-01-09', xp: '500', players: '3' }, { day: '2026-01-10', xp: 80, players: 1 }], 4, '2026-01-10')
    expect(out.map((d) => d.day)).toEqual(['2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10'])
    expect(out.map((d) => d.xp)).toEqual([0, 0, 500, 80])
    expect(out[2].players).toBe(3)
  })
  it('puts zeros on quiet days and ignores days outside the window', () => {
    const out = fillDailyXp([{ day: '2025-12-01', xp: 999, players: 9 }], 3, '2026-01-10')
    expect(out.every((d) => d.xp === 0 && d.players === 0)).toBe(true)
  })
  it('works across a month end', () => {
    expect(fillDailyXp([], 3, '2026-03-01').map((d) => d.day)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01'])
  })
})
