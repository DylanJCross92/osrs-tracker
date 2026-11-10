import { describe, it, expect } from 'vitest'
import { computeRecords, skillRecordKey } from '../../server/src/utils/records.js'

// Snapshots at noon Eastern (16:00 UTC in winter) so every one falls inside the game day of its own date.
const at = (day, hour = 17) => `${day}T${String(hour).padStart(2, '0')}:00:00Z`
const snap = (day, overallXp, skills, hour) => ({
  capturedAt: at(day, hour),
  overallXp,
  overallLevel: 100,
  skills: Object.fromEntries(Object.entries(skills).map(([k, [xp, level]]) => [k, { xp, level }])),
})
const NOW = Date.parse(at('2026-01-10'))

// Gains: Jan 2 = +1000 (Attack), Jan 3 = +3000 (Attack 2000 + Cooking 1000, one level), Jan 4 = nothing,
// Jan 5 = +500, Jan 6 = +500, Jan 7 = +500, Jan 8 = +100 ... then quiet until Jan 10.
const ROWS = [
  snap('2026-01-01', 10_000, { Attack: [5000, 40], Cooking: [5000, 40] }),
  snap('2026-01-02', 11_000, { Attack: [6000, 40], Cooking: [5000, 40] }),
  snap('2026-01-03', 14_000, { Attack: [8000, 41], Cooking: [6000, 40] }),
  snap('2026-01-05', 14_500, { Attack: [8500, 41], Cooking: [6000, 40] }),
  snap('2026-01-06', 15_000, { Attack: [9000, 41], Cooking: [6000, 40] }),
  snap('2026-01-07', 15_500, { Attack: [9500, 41], Cooking: [6000, 40] }),
  snap('2026-01-08', 15_600, { Attack: [9600, 41], Cooking: [6000, 40] }),
]
const by = (res, key) => res.records.find((r) => r.key === key)

describe('computeRecords', () => {
  const res = computeRecords(ROWS, { now: NOW })

  it('finds the biggest day and what drove it', () => {
    const r = by(res, 'best-day')
    expect(r.value).toBe(3000)
    expect(r.end).toBe('2026-01-03')
    expect(r.detail).toEqual({ skill: 'Attack', xp: 2000, kind: 'top-skill' })
  })

  it('finds the longest streak of days with XP, not counting a quiet day in between', () => {
    const r = by(res, 'longest-streak')
    expect(r.value).toBe(4) // Jan 5, 6, 7, 8
    expect(r.start).toBe('2026-01-05')
    expect(r.end).toBe('2026-01-08')
    expect(r.current.value).toBe(0)
  })

  it('finds the biggest 7 day stretch and locks the 30 day one until there is enough history', () => {
    expect(by(res, 'best-week').value).toBe(5600) // Jan 2 through Jan 8
    const month = by(res, 'best-month')
    expect(month.locked).toBe(true)
    expect(month.unlockHint).toMatch(/30 days/)
  })

  it('records the most levels and most skills in one day', () => {
    expect(by(res, 'most-levels-day').value).toBe(1)
    expect(by(res, 'most-skills-day').value).toBe(2)
  })

  it('keeps a best day for each skill, biggest first', () => {
    const skills = res.records.filter((r) => r.group === 'skill')
    expect(skills.map((r) => r.skill)).toEqual(['Attack', 'Cooking'])
    expect(by(res, skillRecordKey('Attack')).value).toBe(2000)
  })

  it('reports how close today is to each record', () => {
    const r = by(res, 'best-day')
    expect(r.current.value).toBe(0)
    expect(r.pct).toBe(0)
    const live = computeRecords([...ROWS, snap('2026-01-10', 16_600, { Attack: [10_600, 41], Cooking: [6000, 40] })], { now: NOW })
    expect(by(live, 'best-day').current.value).toBe(1000)
    expect(by(live, 'best-day').pct).toBeCloseTo(1000 / 3000)
  })

  it('a day beating the old record becomes the record and is flagged as fresh', () => {
    const live = computeRecords([...ROWS, snap('2026-01-10', 20_000, { Attack: [14_000, 42], Cooking: [6000, 40] })], { now: NOW })
    const r = by(live, 'best-day')
    expect(r.value).toBe(4400)
    expect(r.end).toBe('2026-01-10')
    expect(r.pct).toBe(1)
    expect(r.fresh).toBe(true)
  })

  it('ignores history imported from before the player was added', () => {
    const rows = [snap('2025-06-01', 1_000, { Attack: [1000, 10] }), snap('2025-12-01', 90_000, { Attack: [90_000, 60] }), ...ROWS]
    const withCreated = computeRecords(rows, { createdAt: at('2026-01-01', 16), now: NOW })
    expect(by(withCreated, 'best-day').value).toBe(3000)
  })

  it('words each record as one phrase for sharing', () => {
    expect(by(res, 'best-day').headline).toBe('3K XP in a single day')
    expect(by(res, 'longest-streak').headline).toBe('4 days in a row')
    expect(by(res, skillRecordKey('Attack')).headline).toBe('2K Attack XP in a single day')
  })

  it('has nothing to show before there are two snapshots', () => {
    expect(computeRecords([ROWS[0]], { now: NOW }).records).toEqual([])
    expect(computeRecords([], { now: NOW }).records).toEqual([])
  })
})
