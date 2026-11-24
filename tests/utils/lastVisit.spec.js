import { describe, expect, it } from 'vitest'
import { MIN_GAP_MS, awayText, readVisit, sinceLastVisit, writeVisit, xpMap } from '@/utils/lastVisit'

const H = 3_600_000
const now = Date.UTC(2026, 10, 24, 12, 0, 0)
const prev = { at: now - 30 * H, xp: { 'oo jake': 226_000_000, lyrlc: 316_000_000 } }
const players = [
  { username: 'oo Jake', displayName: 'oo Jake', overallXp: 227_500_000 },
  { username: 'lyrlc', displayName: 'lyrlc', overallXp: 316_000_000 },
  { username: 'newbie', displayName: 'Newbie', overallXp: 1_000_000 },
]

describe('since you were last here', () => {
  it('reports the XP gained and the milestones reached since, biggest first, and leaves out those who did nothing', () => {
    const events = [
      { username: 'oo Jake', title: '99 Attack', at: new Date(now - 5 * H).toISOString() },
      { username: 'oo Jake', title: '99 Strength', at: new Date(now - 100 * H).toISOString() },
    ]
    const r = sinceLastVisit(prev, players, events, now)
    expect(r.rows.map((x) => x.username)).toEqual(['oo Jake'])
    expect(r.rows[0]).toMatchObject({ gain: 1_500_000, milestones: ['99 Attack'] })
    expect(r.total).toBe(1_500_000)
  })

  it('has nothing to say on a first visit, a short break, or when nothing changed', () => {
    expect(sinceLastVisit(null, players, [], now)).toBeNull()
    expect(sinceLastVisit({ ...prev, at: now - MIN_GAP_MS + 1000 }, players, [], now)).toBeNull()
    expect(sinceLastVisit({ at: now - 30 * H, xp: { 'oo jake': 227_500_000 } }, players, [], now)).toBeNull()
  })

  it('skips a player followed since the last visit, since there is nothing to compare with', () => {
    const r = sinceLastVisit(prev, players, [], now)
    expect(r.rows.map((x) => x.username)).not.toContain('newbie')
  })

  it('puts a player with a new milestone first', () => {
    const r = sinceLastVisit(
      { ...prev, xp: { ...prev.xp, lyrlc: 315_999_000 } },
      players,
      [{ username: 'lyrlc', title: '1B XP', at: new Date(now - H).toISOString() }],
      now,
    )
    expect(r.rows[0].username).toBe('lyrlc')
  })

  it('is remembered in storage and read back, ignoring damage', () => {
    const m = new Map()
    const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }
    expect(readVisit(storage)).toBeNull()
    writeVisit({ at: 5, xp: xpMap([{ username: 'A B', overallXp: 9 }, { username: 'x', overallXp: null }]) }, storage)
    expect(readVisit(storage)).toEqual({ at: 5, xp: { 'a b': 9 } })
    m.set('tickgains-last-visit', '{bad')
    expect(readVisit(storage)).toBeNull()
  })

  it('says how long ago', () => {
    expect(awayText(now - 5 * H, now)).toBe('5 hours ago')
    expect(awayText(now - 30 * H, now)).toBe('yesterday')
    expect(awayText(now - 100 * H, now)).toBe('4 days ago')
  })
})
