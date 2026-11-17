import { describe, it, expect } from 'vitest'
import { playersByDay } from '../../server/src/utils/dailyPlayers.js'

// Noon Eastern (17:00 UTC in winter) so each instant falls inside the game day of its own date.
const at = (day) => `${day}T17:00:00Z`

describe('playersByDay', () => {
  it('counts the running total at the end of each day, oldest first, ending today', () => {
    const out = playersByDay([at('2026-01-05'), at('2026-01-08'), at('2026-01-08'), at('2026-01-10')], 4, '2026-01-10')
    expect(out.map((d) => d.day)).toEqual(['2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10'])
    expect(out.map((d) => d.total)).toEqual([1, 3, 3, 4])
    expect(out.map((d) => d.added)).toEqual([0, 2, 0, 1])
  })
  it('starts the window with everyone added before it', () => {
    const out = playersByDay([at('2025-06-01'), at('2025-07-01'), at('2026-01-10')], 3, '2026-01-10')
    expect(out.map((d) => d.total)).toEqual([2, 2, 3])
  })
  it('is a flat line when nobody joined', () => {
    expect(playersByDay([at('2020-01-01')], 5, '2026-01-10').every((d) => d.total === 1 && d.added === 0)).toBe(true)
  })
  it('handles no players at all', () => {
    expect(playersByDay([], 3, '2026-01-10').map((d) => d.total)).toEqual([0, 0, 0])
  })
  it('puts a player added before 6 AM on the previous game day', () => {
    // 09:00 UTC is 4 AM Eastern, still the previous day's game day.
    const out = playersByDay(['2026-01-10T09:00:00Z'], 2, '2026-01-10')
    expect(out.map((d) => d.added)).toEqual([1, 0])
  })
})
