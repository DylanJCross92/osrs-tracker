import { describe, expect, it } from 'vitest'
import { PAUSE_DAYS, planStartInfo } from '@/utils/planStart'
import { buildProgress } from '@/utils/plannerTools'

const day = (n) => new Date(Date.UTC(2026, 10, 1) + n * 86_400_000).toISOString()
const snap = (n, xp, other = 0) => ({ capturedAt: day(n), skills: { Agility: { xp }, Smithing: { xp: other } } })
const plan = { statsAt: day(0), goals: [{ skill: 'Agility', currentXp: 1000, targetXp: 13_034_431 }], }

describe('planStartInfo', () => {
  it('is not started while nothing has been gained in its skills, however long ago it was made', () => {
    const history = [snap(0, 1000), snap(3, 1000, 500)] // only Smithing moved
    const info = planStartInfo(plan, { history }, new Date(day(10)))
    expect(info).toMatchObject({ state: 'not-started', startedAt: null, activeDays: null, manual: false })
  })

  it('starts by itself on the first gain, counting from the snapshot before it', () => {
    const history = [snap(0, 1000), snap(4, 1000), snap(6, 5000)]
    const info = planStartInfo(plan, { history }, new Date(day(8)))
    expect(info.state).toBe('active')
    expect(info.startedAt).toBe(day(4))
    expect(info.lastGainAt).toBe(day(6))
    expect(info.activeDays).toBeCloseTo(4, 5)
  })

  it('is paused after a week without XP, and the break stops counting against the schedule', () => {
    const history = [snap(0, 1000), snap(1, 5000)]
    const info = planStartInfo(plan, { history }, new Date(day(30)))
    expect(info.state).toBe('paused')
    // 1 day to the gain, then only the first week of the 29 quiet days
    expect(info.activeDays).toBeCloseTo(1 + PAUSE_DAYS, 5)
    // the schedule does not move while it is paused
    expect(planStartInfo(plan, { history }, new Date(day(40))).activeDays).toBeCloseTo(info.activeDays, 5)
  })

  it('does not jump back as a quiet spell passes a week', () => {
    const history = [snap(0, 1000), snap(1, 5000)]
    const before = planStartInfo(plan, { history }, new Date(day(1 + PAUSE_DAYS - 0.01))).activeDays
    const after = planStartInfo(plan, { history }, new Date(day(1 + PAUSE_DAYS + 0.01))).activeDays
    expect(after - before).toBeLessThan(0.05)
  })

  it('resumes by itself on the next gain', () => {
    const history = [snap(0, 1000), snap(1, 5000), snap(20, 9000)]
    const info = planStartInfo(plan, { history }, new Date(day(21)))
    expect(info.state).toBe('active')
    expect(info.activeDays).toBeCloseTo(1 + PAUSE_DAYS + 1, 5)
  })

  it('does what the person said: start now, or hold it back even when XP is being gained', () => {
    const history = [snap(0, 1000), snap(2, 9000)]
    expect(planStartInfo({ ...plan, startHold: true }, { history }, new Date(day(5)))).toMatchObject({ state: 'not-started', manual: true })
    const started = planStartInfo({ ...plan, startedAt: day(3) }, { history }, new Date(day(5)))
    expect(started).toMatchObject({ state: 'active', startedAt: day(3), manual: true })
    expect(started.activeDays).toBeCloseTo(2, 5)
    // a start date in the future has not started yet
    expect(planStartInfo({ ...plan, startedAt: day(9) }, { history }, new Date(day(5))).state).toBe('not-started')
  })

  it('works from the newest stats alone when there is no history', () => {
    const latest = { capturedAt: day(5), skills: { Agility: { xp: 8000 } } }
    expect(planStartInfo(plan, { latest }, new Date(day(6))).state).toBe('active')
    const same = { capturedAt: day(5), skills: { Agility: { xp: 1000 } } }
    expect(planStartInfo(plan, { latest: same }, new Date(day(6))).state).toBe('not-started')
  })

  it('has nothing to say for a plan with no goals or starting point', () => {
    expect(planStartInfo({ goals: [] }, {}, new Date()).state).toBe('not-started')
    expect(planStartInfo({ goals: plan.goals }, {}, new Date()).state).toBe('not-started')
  })
})

describe('buildProgress with a start', () => {
  const goals = [{ skill: 'Agility', currentXp: 0, targetXp: 1000 }]
  const plans = [{ hours: 10 }]
  const live = [{ ...goals[0], currentXp: 0 }]
  const live10 = [{ ...goals[0], currentXp: 0 }]
  it('has no schedule for a plan that has not started', () => {
    const p = buildProgress(goals, live, plans, plans, 2, day(0), new Date(day(5)), null)
    expect(p.schedule).toBeNull()
  })
  it('uses the days actually trained instead of the days since it was made', () => {
    const p = buildProgress(goals, live10, plans, [{ hours: 10 }], 2, day(0), new Date(day(5)), 0)
    expect(p.elapsedDays).toBe(0)
    expect(p.schedule).toBe('on')
    // left out: counts from the baseline as before
    const legacy = buildProgress(goals, live10, plans, [{ hours: 10 }], 2, day(0), new Date(day(5)))
    expect(legacy.schedule).toBe('behind')
  })
})
