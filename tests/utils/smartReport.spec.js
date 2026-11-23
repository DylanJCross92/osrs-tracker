import { describe, expect, it } from 'vitest'
import { recommend } from '@/utils/smartPlanner'
import { reportContext } from '@/utils/smartReport'
import { cleanPlanContext } from '../../server/src/utils/feedback.js'
import { xpAtLevel } from '@/utils/planner'
import { SKILL_NAMES } from '@/utils/osrsSkills'

const stats = (levels) => Object.fromEntries(SKILL_NAMES.map((s) => [s, { xp: xpAtLevel(levels[s] ?? levels.all ?? 1), level: levels[s] ?? levels.all ?? 1 }]))

describe('a plan report', () => {
  it('carries the answers, the plan and what was left out, in the shape the server keeps', () => {
    const plan = recommend({ members: true, goal: 'quests', hours: 2, gp: 'some', experience: 'returning', iron: false }, stats({ all: 20, Hitpoints: 20 }))
    const ctx = reportContext(plan)
    expect(ctx.profile).toMatchObject({ members: true, goal: 'quests', hours: 2, gp: 'some' })
    expect(ctx.goals.length).toBe(plan.goals.length)
    expect(ctx.goals[0]).toMatchObject({ skill: expect.any(String), from: expect.any(Number), to: expect.any(Number) })
    // The server keeps everything the planner sends
    const kept = cleanPlanContext(ctx)
    expect(kept.goals.length).toBe(ctx.goals.length)
    expect(kept.profile.goal).toBe('quests')
    expect(kept.skipped.length).toBe(ctx.skipped.length)
  })
  it('lists the quests left out for combat, with the level they need and the level the player has', () => {
    const plan = recommend({ members: true, goal: 'quests', hours: 2, gp: 'some', experience: 'returning', iron: false }, stats({ all: 20, Hitpoints: 20 }))
    expect(plan.skippedQuests.length).toBeGreaterThan(0)
    for (const s of plan.skippedQuests) expect(s.reason).toMatch(/combat level \d+; yours is \d+/)
    expect(plan.assumed.combat).toBeGreaterThan(0)
  })
  it('never holds a name', () => {
    const plan = recommend({ members: true, goal: 'money', hours: 2, gp: 'low', experience: 'returning', iron: false }, stats({ all: 30 }))
    expect(JSON.stringify(reportContext(plan))).not.toMatch(/username|rsn|displayName/i)
  })
})
