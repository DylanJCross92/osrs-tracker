import { describe, expect, it } from 'vitest'
import { activityEvents } from '../../server/src/utils/activityEvents.js'

const DAY = 86_400_000
const now = Date.UTC(2026, 10, 27, 12)
const at = (daysAgo) => new Date(now - daysAgo * DAY)
const row = (daysAgo, xp, agility, id = 1) => ({ player_id: id, captured_at: at(daysAgo), overall_xp: xp, skills: { Agility: { level: agility } } })
const byId = new Map([[1, { id: 1 }], [2, { id: 2 }]])
const windowStart = now - 7 * DAY

describe('activityEvents', () => {
  it('reports a level-up and a big gain between two snapshots a few hours apart', () => {
    const events = activityEvents([row(0.5, 1_000_000, 83), row(0.1, 1_400_000, 84)], byId, windowStart)
    expect(events.map((e) => e.kind).sort()).toEqual(['gain', 'levelup'])
    expect(events.find((e) => e.kind === 'levelup')).toMatchObject({ skill: 'Agility', from: 83, to: 84 })
    expect(events.every((e) => e.days === undefined)).toBe(true)
  })

  it('still reports it when the player was last saved days ago (a manual update after a quiet spell), and says how long ago', () => {
    const events = activityEvents([row(5, 1_000_000, 83), row(0.01, 1_400_000, 84)], byId, windowStart)
    expect(events.map((e) => e.kind).sort()).toEqual(['gain', 'levelup'])
    expect(events.every((e) => e.days === 5)).toBe(true)
  })

  it('compares the first snapshot inside the window with the last one from before it', () => {
    const events = activityEvents([row(9, 1_000_000, 83), row(1, 1_500_000, 84)], byId, windowStart)
    expect(events.some((e) => e.kind === 'levelup')).toBe(true)
  })

  it('does not report old changes: the newer snapshot must be inside the window', () => {
    expect(activityEvents([row(12, 1_000_000, 83), row(9, 1_500_000, 84)], byId, windowStart)).toEqual([])
  })

  it('leaves out a gap that is too long to be a recent change', () => {
    expect(activityEvents([row(20, 1_000_000, 83), row(1, 1_500_000, 84)], byId, windowStart)).toEqual([])
    // a level-up still counts over ten days, but a gain does not count over more than a week
    const ten = activityEvents([row(10, 1_000_000, 83), row(0.5, 1_500_000, 84)], byId, windowStart)
    expect(ten.map((e) => e.kind)).toEqual(['levelup'])
  })

  it('does not mix players up, and skips players that are not in the feed', () => {
    const rows = [row(2, 1_000_000, 83, 1), row(2, 5_000_000, 50, 3), row(1, 1_050_000, 84, 1)]
    const events = activityEvents(rows, byId, windowStart)
    expect(events.map((e) => e.playerId)).toEqual([1])
    expect(events[0].kind).toBe('levelup')
  })

  it('calls a level 99 a max, with the cheer attached', () => {
    const [e] = activityEvents([row(1, 1_000_000, 98), row(0.1, 1_010_000, 99)], byId, windowStart)
    expect(e).toMatchObject({ kind: 'max', cheer: { type: 'skill_level', value: 99 } })
  })
})
