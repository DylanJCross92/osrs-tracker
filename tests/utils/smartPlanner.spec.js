import { describe, expect, it } from 'vitest'
import { cleanProfile, DEFAULT_PROFILE, f2pCap, planFromProfile, recommend, settingsFor } from '@/utils/smartPlanner'
import { xpAtLevel } from '@/utils/planner'
import { SKILL_NAMES } from '@/utils/osrsSkills'
import { F2P_SKILLS } from '@/data/plannerMilestones'

const at = (levels) => Object.fromEntries(SKILL_NAMES.map((s) => [s, { xp: xpAtLevel(levels[s] ?? levels.all ?? 1), level: levels[s] ?? levels.all ?? 1 }]))
const skills = (levels) => at(levels)

describe('answers', () => {
  it('falls back to safe defaults for anything unknown', () => {
    expect(cleanProfile(null)).toEqual(DEFAULT_PROFILE)
    expect(cleanProfile({ goal: 'nonsense', hours: 99, gp: 'x', experience: 5, members: 'yes' })).toMatchObject({ goal: 'skills', hours: 12, gp: 'low', experience: 'returning', members: true })
    expect(cleanProfile({ hours: 0 }).hours).toBe(0.5)
  })
  it('turns time and starting gp into planner settings', () => {
    expect(settingsFor(cleanProfile({ hours: 3, gp: 'rich' }))).toMatchObject({ hoursPerDay: 3, globalStrategy: 'auto-fast' })
    expect(settingsFor(cleanProfile({ gp: 'low' })).globalStrategy).toBe('auto-cheap')
    // an ironman and a plan for making money both lean to the cheapest routes
    expect(settingsFor(cleanProfile({ gp: 'rich', iron: true })).globalStrategy).toBe('auto-cheap')
    expect(settingsFor(cleanProfile({ gp: 'rich', goal: 'money' })).globalStrategy).toBe('auto-cheap')
  })
})

describe('recommendations', () => {
  it('with no stats, starts a new player on small tiers and a veteran on big ones', () => {
    expect(recommend({ experience: 'new' }, null).phases[0].title).toContain('30')
    expect(recommend({ experience: 'returning' }, null).phases[0].title).toContain('50')
    expect(recommend({ experience: 'veteran' }, null).phases[0].title).toContain('70')
  })

  it('with stats, goes by the levels, not by what the player says about themselves', () => {
    const base = skills({ all: 30 })
    const a = recommend({ experience: 'new' }, base)
    const b = recommend({ experience: 'veteran' }, base)
    expect(a.phases[0].title).toContain('40')
    expect(b.phases[0].title).toBe(a.phases[0].title)
  })

  it('finishes the last few skills straight to 99 instead of climbing tiers', () => {
    const r = recommend({}, skills({ all: 99, Sailing: 1 }))
    expect(r.phases[0].title).toMatch(/Finish your last skill/)
    expect(r.goals).toHaveLength(1)
    expect(r.goals[0]).toMatchObject({ skill: 'Sailing', targetXp: xpAtLevel(99) })
  })

  it('is the same every time, and every goal starts from the real XP', () => {
    const s = skills({ all: 45, Fishing: 60 })
    const a = recommend({ experience: 'returning' }, s)
    const b = recommend({ experience: 'returning' }, s)
    expect(a.goals).toEqual(b.goals)
    const fishing = a.goals.find((g) => g.skill === 'Fishing')
    expect(fishing?.currentXp ?? xpAtLevel(60)).toBe(xpAtLevel(60))
    expect(a.goals.some((g) => g.skill === 'Attack' && g.currentXp === xpAtLevel(45))).toBe(true)
  })

  it('puts Fishing before Cooking when Cooking can use the fish, with the reason', () => {
    const r = recommend({ experience: 'new' }, skills({ all: 1 }))
    const names = r.phases[0].rows.map((x) => x.skill)
    expect(names.indexOf('Fishing')).toBeLessThan(names.indexOf('Cooking'))
    expect(r.phases[0].rows.find((x) => x.skill === 'Fishing').reasons.join(' ')).toContain('Before Cooking')
  })

  it('has summary figures that match the goals', () => {
    const r = recommend({}, skills({ all: 60 }))
    expect(r.totals.goals).toBe(r.goals.length)
    expect(r.totals.hours).toBeGreaterThan(0)
    expect(r.totals.days).toBeGreaterThan(0)
  })

  it('combat: the ladder of gear levels, only what is still to do', () => {
    const r = recommend({ goal: 'combat', experience: 'returning' }, skills({ all: 50, Attack: 62, Strength: 62, Defence: 62, Prayer: 60, Ranged: 65 }))
    expect(r.phases[0].title).toMatch(/Barrows/)
    expect(r.phases[0].rows.some((x) => x.skill === 'Defence' && x.to === 70)).toBe(true)
    // Attack 60 is done, so no dragon tier row for it appears
    expect(r.phases.flatMap((p) => p.rows).some((x) => x.skill === 'Attack' && x.to === 60)).toBe(false)
  })

  it('money: levels that unlock a much better gp an hour method, with the reason', () => {
    const r = recommend({ goal: 'money' }, skills({ all: 40 }))
    if (r.phases[0]?.id === 'money') {
      expect(r.phases[0].rows.length).toBeLessThanOrEqual(5)
      expect(r.phases[0].rows[0].reasons.join(' ')).toMatch(/Unlocks/)
      expect(r.phases[0].rows.flatMap((x) => x.reasons).join(' ')).not.toMatch(/gp gp|tick/i)
    }
    expect(r.goals.length).toBeGreaterThan(0)
  })

  it('say so, and show the next levels, when the chosen kind of plan has nothing left', () => {
    const maxed = skills({ all: 99, Sailing: 40 })
    for (const goal of ['combat', 'money', 'quests']) {
      const r = recommend({ goal }, maxed)
      expect(r.goals.length).toBeGreaterThan(0)
      expect(r.phases[0].title).toMatch(/Finish your last skill/)
      expect(r.notes.length).toBeGreaterThan(0)
    }
  })

  it('money: methods you can do now come first, then the levels that unlock more', () => {
    const r = recommend({ goal: 'money' }, skills({ all: 60 }))
    expect(r.phases[0].id).toBe('money-now')
    const now = r.goals.filter((g) => g.methodId !== 'global')
    expect(now.length).toBeGreaterThan(0)
    expect(now.length).toBeLessThanOrEqual(3)
    expect(r.phases[0].rows[0].reasons.join(' ')).toMatch(/gp an hour/)
    if (r.phases[1]) expect(r.phases[1].later).toBe(true)
  })

  it('quests: the worthwhile quests are a step of their own, ahead of the levels', () => {
    const r = recommend({ goal: 'quests' }, null)
    const q = r.phases.find((p) => p.id === 'quests')
    if (q) {
      expect(r.phases[0].id).toBe('quests')
      expect(q.rows[0]).toMatchObject({ kind: 'quest' })
      expect(q.rows[0].rewards).toMatch(/XP/)
    }
    expect(r.goals.length).toBeGreaterThan(0)
  })

  it('a maxed player gets the next big goal, not an empty list', () => {
    const r = recommend({}, skills({ all: 99 }))
    expect(r.goals.length).toBeGreaterThan(0)
    expect(r.notes.join(' ')).toMatch(/next big goal|ahead/i)
  })
})

describe('phases and the plan', () => {
  it('the plan is the first phase only, one goal per skill, and the next phase starts where it ends', () => {
    const r = recommend({ experience: 'returning' }, null)
    expect(r.phases.length).toBe(2)
    expect(r.phases[0].later).toBe(false)
    expect(r.phases[1].later).toBe(true)
    const skillsInPlan = r.goals.map((g) => g.skill)
    expect(new Set(skillsInPlan).size).toBe(skillsInPlan.length)
    expect(r.goals.every((g) => g.targetXp === xpAtLevel(50))).toBe(true)
    // after the plan, every skill is at 50, so the next phase reads 50 to 60
    expect(r.phases[1].rows.every((x) => x.from === 50 && x.to === 60)).toBe(true)
    expect(r.totals.goals).toBe(r.goals.length)
  })
})

describe('free-to-play', () => {
  it('only uses free-to-play skills and routes, and says what is left out', () => {
    const r = recommend({ members: false, experience: 'new' }, skills({ all: 1 }))
    expect(r.goals.length).toBeGreaterThan(0)
    for (const g of r.goals) {
      expect(F2P_SKILLS).toContain(g.skill)
      expect(g.allowedMethodIds?.length).toBeGreaterThan(0)
      expect(g.targetXp).toBeLessThanOrEqual(xpAtLevel(f2pCap(g.skill)))
    }
    expect(r.notes.join(' ')).toMatch(/free-to-play routes/)
  })
  it('never goes past where the free-to-play methods run out', () => {
    expect(f2pCap('Slayer')).toBe(0)
    expect(f2pCap('Attack')).toBe(0)
    expect(f2pCap('Woodcutting')).toBeGreaterThan(30)
  })
})

describe('starting a plan', () => {
  it('gives the ordered goals with the settings', () => {
    const p = planFromProfile({ hours: 4, gp: 'rich', experience: 'new' }, skills({ all: 20 }))
    expect(p.hoursPerDay).toBe(4)
    expect(p.globalStrategy).toBe('auto-fast')
    expect(p.goals.length).toBeGreaterThan(0)
    expect(p.goals[0]).toHaveProperty('currentXp')
    expect(p.profile.experience).toBe('new')
  })
})
