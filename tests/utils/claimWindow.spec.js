import { describe, it, expect } from 'vitest'
import { buildWindow, dayOptions, splitWindow } from '@/utils/claimWindow'

describe('claim window', () => {
  it('lists today, tomorrow and the days after', () => {
    const days = dayOptions(new Date(2026, 10, 14, 9, 0), 4)
    expect(days.map((d) => d.value)).toEqual(['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'])
    expect(days[0].label).toBe('Today')
    expect(days[1].label).toBe('Tomorrow')
  })
  it('builds a window in the person\'s own clock', () => {
    const w = buildWindow('2026-11-15', '18:00', '22:30')
    expect(new Date(w.onlineFrom).getHours()).toBe(18)
    expect(new Date(w.onlineUntil).getHours()).toBe(22)
    expect(new Date(w.onlineUntil).getMinutes()).toBe(30)
  })
  it('treats an end before the start as overnight', () => {
    const w = buildWindow('2026-11-15', '22:00', '01:00')
    expect(new Date(w.onlineUntil).getDate()).toBe(16)
  })
  it('returns null until all three parts are filled in', () => {
    expect(buildWindow('2026-11-15', '', '22:00')).toBeNull()
    expect(buildWindow('', '18:00', '22:00')).toBeNull()
  })
  it('round-trips through split', () => {
    const w = buildWindow('2026-11-15', '18:00', '22:00')
    expect(splitWindow(w.onlineFrom, w.onlineUntil)).toEqual({ day: '2026-11-15', from: '18:00', to: '22:00' })
    expect(splitWindow('nope', 'nope')).toBeNull()
  })
})
