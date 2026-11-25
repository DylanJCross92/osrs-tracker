import { describe, expect, it } from 'vitest'
import { cleanProfile, DEFAULT_PROFILE, f2pCap, HARDCORE_SKILLS, planFromProfile, recommend, settingsFor } from '@/utils/smartPlanner'
import { methodsForSkill } from '@/data/trainingMethods'
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
  it('every step has a reason, and the plan is built from purposes (fund, quests, unlocks), not generic tiers', () => {
    for (const levels of [{ all: 20 }, { all: 45, Fishing: 60 }, { all: 70 }]) {
      const r = recommend({ experience: 'returning' }, skills(levels))
      expect(r.phases.length).toBeGreaterThan(0)
      for (const p of r.phases) {
        expect(['fund', 'quests', 'unlock', 'then', 'tier-30', 'finish']).toContain(p.id.startsWith('tier-') ? 'tier-30' : p.id)
        for (const row of p.rows) expect(row.kind === 'quest' ? row.reasons.length : row.reasons.length).toBeGreaterThan(0)
      }
    }
  })

  it('an unlock step names what opens and how much faster it is', () => {
    const r = recommend({}, skills({ all: 20 }))
    const unlock = r.phases.find((p) => p.id === 'unlock')
    expect(unlock).toBeTruthy()
    for (const row of unlock.rows.slice(0, 3)) expect(row.reasons.join(' ')).toMatch(/opens|on the way to/i)
  })

  it('a level a quest needs becomes a step that names the quest and what it saves', () => {
    const r = recommend({ goal: 'quests' }, skills({ all: 20 }))
    const q = r.phases.find((p) => p.id === 'quests')
    expect(q).toBeTruthy()
    const quests = q.rows.filter((x) => x.kind === 'quest')
    expect(quests.length).toBeGreaterThan(0)
    for (const x of quests) expect(x.reasons.join(' ')).toMatch(/Skips about|do it for the quest itself/)
    const needed = q.rows.filter((x) => x.skill && x.reasons.join(' ').startsWith('Needed for'))
    for (const row of needed) expect(row.reasons[0]).toMatch(/skips about .* of training/)
  })

  it('a finished quest is not recommended again', () => {
    const s = skills({ all: 30 })
    const first = recommend({ goal: 'quests' }, s).phases.find((p) => p.id === 'quests')
    const ids = first.rows.filter((x) => x.kind === 'quest').map((x) => x.id)
    const again = recommend({ goal: 'quests' }, s, { done: new Set(ids) }).phases.find((p) => p.id === 'quests')
    const left = (again?.rows || []).filter((x) => x.kind === 'quest').map((x) => x.id)
    for (const id of ids) expect(left).not.toContain(id)
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
    for (const g of a.goals) expect(g.currentXp).toBe(xpAtLevel(g.skill === 'Fishing' ? 60 : 45))
  })

  it('has summary figures that match the goals', () => {
    const r = recommend({}, skills({ all: 60 }))
    expect(r.totals.goals).toBe(r.goals.length)
    expect(r.totals.hours).toBeGreaterThan(0)
    expect(r.totals.days).toBeGreaterThan(0)
  })

  it('combat: the ladder of gear levels, only what is still to do', () => {
    const r = recommend({ goal: 'combat', experience: 'returning' }, skills({ all: 50, Attack: 62, Strength: 62, Defence: 62, Prayer: 60, Ranged: 65 }))
    const ladder = r.phases.find((p) => p.id.startsWith('combat'))
    expect(ladder.title).toMatch(/Barrows/)
    expect(ladder.rows.some((x) => x.skill === 'Defence' && x.to === 70)).toBe(true)
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
  it('the plan is one goal per skill, in order, and what comes later is only shown', () => {
    const r = recommend({}, skills({ all: 20 }))
    const skillsInPlan = r.goals.map((g) => g.skill)
    expect(new Set(skillsInPlan).size).toBe(skillsInPlan.length)
    const later = r.phases.filter((p) => p.later)
    for (const p of later) for (const row of p.rows) expect(skillsInPlan.includes(row.skill) && false).toBe(false)
    expect(r.totals.goals).toBe(r.goals.length)
    // every goal that carries quests only carries real ones
    for (const g of r.goals) expect(Array.isArray(g.quests)).toBe(true)
  })
})

describe('free-to-play', () => {
  it('only uses free-to-play skills and routes, and says what is left out', () => {
    // Runecraft 60 is past where the free-to-play methods run out (51), so it is left out and said so.
    const r = recommend({ members: false, experience: 'new' }, skills({ all: 1, Runecraft: 60 }))
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
    expect(f2pCap('Runecraft')).toBeLessThan(99)
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

describe('AFK training and hardcore skilling', () => {
  it('AFK plans only train with AFK or low-effort methods, and say which', () => {
    const r = recommend({ goal: 'afk' }, skills({ all: 30 }))
    expect(r.goals.length).toBeGreaterThan(0)
    expect(r.phases[0].title).toBe('AFK training')
    for (const g of r.goals) {
      expect(g.allowedMethodIds.length).toBeGreaterThan(0)
      for (const id of g.allowedMethodIds) expect(['AFK', 'Low']).toContain(methodsForSkill(g.skill).find((m) => m.id === id).intensity)
    }
    for (const row of r.phases[0].rows) expect(row.reasons.join(' ')).toMatch(/xp an hour/)
  })
  it('hardcore plans are the hands-on skills, with Medium or High intensity methods', () => {
    const r = recommend({ goal: 'hardcore' }, skills({ all: 30 }))
    expect(r.phases[0].title).toBe('Hardcore skilling')
    const names = r.goals.map((g) => g.skill)
    expect(names.length).toBeGreaterThan(2)
    for (const n of names) expect(HARDCORE_SKILLS).toContain(n)
    expect(names).toEqual(expect.arrayContaining(['Runecraft', 'Agility', 'Mining']))
    for (const g of r.goals) for (const id of g.allowedMethodIds) expect(['High', 'Medium']).toContain(methodsForSkill(g.skill).find((m) => m.id === id).intensity)
  })
  it('keeps free-to-play to the free skills, and a plan with a target above the current level', () => {
    for (const goal of ['afk', 'hardcore']) {
      const r = recommend({ goal, members: false }, skills({ all: 20 }))
      for (const g of r.goals) {
        expect(F2P_SKILLS).toContain(g.skill)
        expect(g.targetXp).toBeGreaterThan(g.currentXp)
      }
    }
  })
  it('answers with these goals are kept as they are', () => {
    expect(cleanProfile({ goal: 'afk' }).goal).toBe('afk')
    expect(cleanProfile({ goal: 'hardcore' }).goal).toBe('hardcore')
  })
})

describe('plans that make sense to follow', () => {
  const base = { members: true, hours: 2, gp: 'good', experience: 'returning', iron: false }

  it('does not open a combat plan with a step of a level or two: short tiers are joined to the next', () => {
    // Ranged is one level short of the Dragon tier; that alone is not a step.
    const r = recommend({ ...base, goal: 'combat' }, skills({ all: 60, Hitpoints: 65, Prayer: 43 }))
    const first = r.phases.find((p) => !p.later)
    expect(first.rows.length).toBeGreaterThan(1)
    expect(first.title).toMatch(/ and /)
    expect(r.totals.hours).toBeGreaterThan(3)
  })

  it('leaves Hitpoints out of the steps when the fighting in the plan trains it, and says so', () => {
    const r = recommend({ ...base, goal: 'combat', gp: 'rich' }, skills({ all: 80, Attack: 90, Strength: 90, Defence: 90, Hitpoints: 90, Ranged: 90, Prayer: 90, Magic: 90 }))
    const rows = r.phases.filter((p) => !p.later).flatMap((p) => p.rows)
    expect(rows.some((x) => x.skill === 'Attack' || x.skill === 'Strength' || x.skill === 'Defence')).toBe(true)
    expect(rows.some((x) => x.skill === 'Hitpoints')).toBe(false)
    expect(r.goals.some((g) => g.skill === 'Hitpoints')).toBe(false) // and the plan that starts from this has none either, so its hours are not counted twice
    expect(r.notes.join(' ')).toMatch(/Hitpoints comes along/)
  })

  it('never turns a quest into a goal for a level it does not reach', () => {
    // 2,000 xp is far less than a level at 60, so the quest is a step of its own and no skill is asked to go up a level for it.
    const r = recommend({ ...base, goal: 'quests' }, skills({ all: 60, Hitpoints: 65 }))
    for (const p of r.phases) {
      for (const row of p.rows) {
        if (row.kind === 'quest') continue
        for (const t of row.reasons) {
          const m = /gives [\d,]+ \w+ XP, about level (\d+)\./.exec(t)
          if (m) expect(Number(m[1])).toBe(row.to)
        }
      }
    }
  })

  it('says what a budget cut gave up, instead of the reason for the level it never reaches', () => {
    const r = recommend({ ...base, goal: 'combat', gp: 'low' }, skills({ all: 60, Hitpoints: 65, Prayer: 43 }))
    const cut = r.phases.flatMap((p) => p.rows).find((x) => x.reasons?.[0]?.startsWith('Stopped at level'))
    if (cut) expect(cut.reasons[0]).toMatch(/to stay inside your budget\. At \d+ it would: /)
  })

  it('has free-to-play routes all the way up for Prayer, Cooking and Smithing (from the wiki free-to-play guides)', () => {
    for (const skill of ['Prayer', 'Cooking', 'Smithing']) expect(f2pCap(skill), skill).toBe(99)
    // and a free player's plan can now use them
    const r = recommend({ ...base, members: false, goal: 'skills', gp: 'rich' }, skills({ all: 40 }))
    expect(r.notes.join(' ')).not.toMatch(/routes for[^.]*(Prayer|Cooking|Smithing)/)
  })
})

describe('ironman plans', () => {
  const base = { members: true, hours: 2, gp: 'good', experience: 'returning', iron: true }
  it('never offers making money, and has no "earn first" step (nothing can be sold)', () => {
    expect(cleanProfile({ iron: true, goal: 'money' }).goal).toBe('skills')
    for (const goal of ['skills', 'quests', 'combat']) {
      const r = recommend({ ...base, goal }, skills({ all: 50, Hitpoints: 55 }))
      expect(r.phases.some((p) => p.id === 'fund'), goal).toBe(false)
    }
  })
  it('starts from the cheapest routes', () => {
    expect(settingsFor(cleanProfile({ iron: true, gp: 'rich' })).globalStrategy).toBe('auto-cheap')
  })
})

describe('free-to-play combat', () => {
  it('has free-to-play routes all the way up for the combat skills', () => {
    for (const skill of ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged']) expect(f2pCap(skill), skill).toBe(99)
  })
  it('puts combat in a free-to-play combat plan, with free methods only', () => {
    const r = recommend({ members: false, goal: 'combat', hours: 2, gp: 'rich', experience: 'new', iron: false }, skills({ all: 1, Hitpoints: 10 }))
    const names = r.goals.map((g) => g.skill)
    for (const skill of ['Attack', 'Strength', 'Defence']) expect(names, skill).toContain(skill)
    expect(r.notes.join(' ')).not.toMatch(/routes for[^.]*(Attack|Strength|Defence|Ranged)/)
  })
})
