import { describe, it, expect } from 'vitest'
import { fillDailyActive } from '../../server/src/utils/dailyActive.js'

describe('fillDailyActive', () => {
  it('returns one entry per day, oldest first, ending today', () => {
    const out = fillDailyActive([], 7, '2026-11-17')
    expect(out).toHaveLength(7)
    expect(out[0].day).toBe('2026-11-11')
    expect(out[6].day).toBe('2026-11-17')
  })

  it('fills quiet days with zeros and keeps the counts of busy ones', () => {
    const out = fillDailyActive([{ day: '2026-11-16', active: '5', logins: 3, resumed: 2 }], 7, '2026-11-17')
    expect(out[5]).toEqual({ day: '2026-11-16', active: 5, logins: 3, resumed: 2 })
    expect(out[4]).toEqual({ day: '2026-11-15', active: 0, logins: 0, resumed: 0 })
  })

  it('ignores rows outside the window', () => {
    const out = fillDailyActive([{ day: '2026-01-01', active: 9, logins: 9, resumed: 9 }], 7, '2026-11-17')
    expect(out.every((d) => d.active === 0)).toBe(true)
  })
})
