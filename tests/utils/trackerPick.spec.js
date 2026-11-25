import { describe, expect, it } from 'vitest'
import { nextForPlan, suggestNext } from '@/utils/trackerSuggestions'
import { trackerPick } from '@/utils/trackerPick'
import { xpAtLevel } from '@/utils/planner'
import { SKILL_NAMES } from '@/utils/osrsSkills'
import { QUEST_LIST } from '@/data/questList'

const stats = (levels) => Object.fromEntries(SKILL_NAMES.map((s) => [s, { xp: xpAtLevel(levels[s] ?? levels.all ?? 1), level: levels[s] ?? levels.all ?? 1 }]))
const levelsOf = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.level]))
const goal = (skill, from, to) => ({ skill, currentXp: xpAtLevel(from), targetXp: xpAtLevel(to), methodId: 'global', customXpPerHour: 0, quests: [] })

describe('next quest for the plan being worked on', () => {
  const latest = { skills: stats({ all: 50, Hitpoints: 50 }) }

  it('picks a quest that pays XP into the plan, and says what it saves', () => {
    const pick = nextForPlan({}, levelsOf(latest.skills), { goals: [goal('Agility', 50, 70), goal('Thieving', 50, 70), goal('Slayer', 50, 70)], strategy: 'auto-fast', planName: 'My plan' })
    expect(pick).toBeTruthy()
    expect(pick.source).toBe('plan')
    expect(pick.planName).toBe('My plan')
    expect(pick.saved + pick.need).toBeGreaterThan(0)
    expect(pick.why.length).toBeGreaterThan(10)
  })

  it('never suggests a quest that is already done, or one the player cannot start yet', () => {
    const goals = [goal('Agility', 50, 70), goal('Thieving', 50, 70), goal('Slayer', 50, 70), goal('Hunter', 50, 70), goal('Farming', 50, 70)]
    const first = nextForPlan({}, levelsOf(latest.skills), { goals, strategy: 'auto-fast' })
    const done = { [first.id]: 'have' }
    const second = nextForPlan(done, levelsOf(latest.skills), { goals, strategy: 'auto-fast' })
    expect(second?.id).not.toBe(first.id)
    expect(['ready', 'almost']).toContain(first.status)
  })

  it('has nothing to say for a plan with nothing left to do', () => {
    expect(nextForPlan({}, levelsOf(latest.skills), { goals: [goal('Smithing', 70, 70)], strategy: 'auto-fast' })).toBeNull()
    expect(nextForPlan({}, null, { goals: [], strategy: 'auto-fast' })).toBeNull()
  })

  it('ignores quests whose XP the plan has no use for', () => {
    // A plan only for Slayer: a quest that pays Smithing is not "for the plan".
    const pick = nextForPlan({}, levelsOf(latest.skills), { goals: [goal('Slayer', 50, 60)], strategy: 'auto-fast' })
    if (pick) expect(`${pick.why}`).toMatch(/Slayer/)
  })
})

describe('what the dashboard shows', () => {
  const latest = { skills: stats({ all: 50 }) }
  const plan = { name: 'Skills to 70', goals: [goal('Agility', 50, 70), goal('Thieving', 50, 70), goal('Hunter', 50, 70)], statsAt: new Date().toISOString(), globalStrategy: 'auto-fast', hoursPerDay: 2 }

  it('uses the plan being worked on, and falls back to the best thing to do next', () => {
    const tracked = { plan, status: { tracked: true, progress: { complete: false } }, latest }
    const pick = trackerPick({ rows: [tracked], latest, confirmations: {} })
    expect(pick).toBeTruthy()
    // A plan that is not tracked (no player linked) cannot be judged, so it is the general suggestion.
    const general = trackerPick({ rows: [{ plan, status: { tracked: false }, latest: null }], latest, confirmations: {} })
    expect(general.source).toBe('general')
    expect(general.name).toBe(suggestNext({}, levelsOf(latest.skills), { limit: 1 })[0].name)
  })

  it('still suggests something with no plans and no player', () => {
    const pick = trackerPick({ rows: [], latest: null, confirmations: {} })
    expect(pick?.source).toBe('general')
  })
})

describe('a free-to-play account is only pointed at free quests', () => {
  it('for the general pick and for a plan', () => {
    const free = new Set(QUEST_LIST.filter((q) => q.type === 'F').map((q) => q.slug))
    const latest = { skills: stats({ all: 60, Hitpoints: 60 }) }
    const general = trackerPick({ rows: [], latest, members: false })
    expect(general && free.has(general.slug)).toBe(true)
    const pick = nextForPlan({}, levelsOf(latest.skills), { goals: [goal('Attack', 50, 70), goal('Strength', 50, 70), goal('Magic', 50, 70)], members: false })
    if (pick) expect(free.has(pick.slug)).toBe(true)
  })
})
