import { describe, expect, it } from 'vitest'
import { buildTimeline, categoryOfSkill } from '@/utils/plannerTools'
import { xpAtLevel } from '@/utils/planner'

// A plan shaped like planGoal's output: a single segment at a flat rate is enough for timeline maths.
const plan = (startLevel, targetLevel, xpPerHour) => {
  const startXp = xpAtLevel(startLevel)
  const targetXp = xpAtLevel(targetLevel)
  const hours = Math.max(0, (targetXp - startXp) / xpPerHour)
  return { startXp, targetXp, hours, netGp: 0, segments: [{ fromXp: startXp, toXp: targetXp, hours }] }
}
const start = new Date('2027-01-01T00:00:00Z')

describe('buildTimeline', () => {
  it('places skills one after another and positions them in hours', () => {
    const t = buildTimeline([{ skill: 'Mining' }, { skill: 'Attack' }], [plan(1, 99, 100_000), plan(1, 99, 100_000)], 2, start)
    expect(t.entries[0].startHours).toBe(0)
    expect(t.entries[1].startHours).toBeCloseTo(t.entries[0].endHours)
    expect(t.totalHours).toBeCloseTo(t.entries[1].endHours)
  })

  it('puts level milestones on each entry and categorises skills', () => {
    const t = buildTimeline([{ skill: 'Mining' }], [plan(1, 99, 100_000)], 2, start)
    expect(t.entries[0].milestones.at(-1).level).toBe(99)
    expect(categoryOfSkill('Magic')).toBe('combat')
    expect(categoryOfSkill('Mining')).toBe('gathering')
  })
})
