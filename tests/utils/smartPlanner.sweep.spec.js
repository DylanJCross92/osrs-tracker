import { describe, expect, it } from 'vitest'
import { HARDCORE_SKILLS, recommend } from '@/utils/smartPlanner'
import { methodsForSkill } from '@/data/trainingMethods'
import { F2P_SKILLS, F2P_METHOD_IDS } from '@/data/plannerMilestones'
import { combatLevel } from '@/utils/smartReasons'
import { xpAtLevel } from '@/utils/planner'
import { SKILL_NAMES } from '@/utils/osrsSkills'

// The Smart Planner against many different players and answers. Whatever the input, a plan must be sane: finite numbers, one goal per
// skill, real targets, the right kind of methods, free-to-play kept free, inside the gp the player said they have (or saying why not).

const stats = (levels) => Object.fromEntries(SKILL_NAMES.map((s) => [s, { xp: xpAtLevel(levels[s] ?? levels.all ?? 1), level: levels[s] ?? levels.all ?? 1 }]))

// Level sets that stand for the kinds of account people bring. The last two are real-looking accounts (a few skills ahead, the rest low).
const PLAYERS = {
  fresh: stats({ all: 1, Hitpoints: 10 }),
  low: stats({ all: 20, Hitpoints: 20 }),
  mid: stats({ all: 50 }),
  high: stats({ all: 80 }),
  nearMax: stats({ all: 98, Sailing: 60 }),
  oneGap: stats({ all: 99, Fletching: 45 }),
  lopsidedMage: stats({ all: 5, Magic: 80, Hitpoints: 40 }),
  lopsidedMelee: stats({ all: 5, Attack: 75, Strength: 75, Defence: 70, Hitpoints: 75 }),
  f2pMid: stats({ all: 40, Slayer: 1, Farming: 1, Hunter: 1, Herblore: 1, Agility: 1, Thieving: 1, Fletching: 1, Construction: 1, Magic: 1 }),
  skewedReal: stats({ all: 12, Agility: 97, Hitpoints: 11, Smithing: 29, Woodcutting: 15, Cooking: 8 }),
  mixedReal: stats({ all: 60, Fishing: 90, Mining: 85, Runecraft: 30, Prayer: 43, Magic: 70, Hitpoints: 65 }),
}
const GOALS = ['skills', 'money', 'combat', 'quests', 'afk', 'hardcore']
const GP = { low: 1_000_000, some: 10_000_000, good: 100_000_000, rich: Infinity }
const levelsOf = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.level]))

function check(label, profile, skillsIn, r, problems) {
  const ok = (cond, msg) => {
    if (!cond) problems.push(`${label}: ${msg}`)
  }
  // When nothing of the asked kind is left the plan says so and shows what is next; the kind-of-method and 99 limits are for the asked plan.
  const fallback = r.notes.some((n) => /what's next instead|next big goal/i.test(n))
  // Numbers
  ok(Number.isFinite(r.totals.hours), 'hours is not a number')
  ok(Number.isFinite(r.totals.netGp ?? 0), 'gp is not a number')
  // One goal per skill, real targets, nothing past 99
  const seen = new Set()
  for (const g of r.goals) {
    ok(!seen.has(g.skill), `${g.skill} twice`)
    seen.add(g.skill)
    ok(g.targetXp > g.currentXp, `${g.skill} target is not above its start`)
    ok(fallback || g.targetXp <= xpAtLevel(99), `${g.skill} goes past 99`)
    ok(g.currentXp === skillsIn[g.skill].xp, `${g.skill} does not start from the player's xp`)
  }
  // Every row says why
  for (const p of r.phases) for (const row of p.rows) ok((row.reasons || []).length > 0, `${row.skill || row.title} has no reason`)
  // Free-to-play stays free
  if (!profile.members) {
    for (const g of r.goals) {
      ok(F2P_SKILLS.includes(g.skill), `${g.skill} is a members skill`)
      for (const id of g.allowedMethodIds || []) ok(F2P_METHOD_IDS.has(id), `${id} is a members method`)
    }
  }
  // The kind of method the goal asked for
  if (profile.goal === 'afk' && !fallback) for (const g of r.goals) for (const id of g.allowedMethodIds || []) ok(['AFK', 'Low'].includes(methodsForSkill(g.skill).find((m) => m.id === id).intensity), `${id} is not AFK or low effort`)
  if (profile.goal === 'hardcore' && !fallback) {
    for (const g of r.goals) {
      ok(HARDCORE_SKILLS.includes(g.skill), `${g.skill} is not a hardcore skill`)
      for (const id of g.allowedMethodIds || []) ok(['High', 'Medium'].includes(methodsForSkill(g.skill).find((m) => m.id === id).intensity), `${id} is not hands-on`)
    }
  }
  // A plan for making money does not lose money
  if (profile.goal === 'money' && !fallback) ok(r.totals.netGp == null || r.totals.netGp >= 0, `a money plan costs ${Math.round(-r.totals.netGp / 1e6)}M`)
  // Quests: none twice
  const quests = r.phases.flatMap((p) => p.rows.filter((x) => x.kind === 'quest'))
  ok(new Set(quests.map((q) => q.id)).size === quests.length, 'a quest twice')
  // The gp answer: inside it, or a note says why not (money plans and ironmen are measured differently)
  const budget = GP[profile.gp]
  if (profile.goal !== 'money' && !profile.iron && Number.isFinite(budget) && r.totals.netGp != null) {
    const inside = r.totals.netGp >= -budget
    const explained = r.notes.some((n) => /gp you can spend|budget|cheapest route/i.test(n))
    ok(inside || explained, `costs ${Math.round(-r.totals.netGp / 1e6)}M against ${budget / 1e6}M with no note`)
  }
}

describe('Smart Planner sweep', () => {
  it('is sane for every kind of player, goal and set of answers', () => {
    let runs = 0
    const problems = []
    const started = Date.now()
    for (const [name, s] of Object.entries(PLAYERS)) {
      for (const goal of GOALS) {
        for (const members of [true, false]) {
          for (const gp of Object.keys(GP)) {
            const profile = { members, goal, hours: 2, gp, experience: 'returning', iron: false }
            const label = `${name}/${goal}/${members ? 'p2p' : 'f2p'}/${gp}`
            const r = recommend(profile, s)
            runs++
            check(label, r.profile, s, r, problems)
          }
        }
      }
    }
    // The answers that change less: ironman, hours and experience, on a few accounts
    for (const name of ['fresh', 'mid', 'skewedReal']) {
      for (const goal of GOALS) {
        for (const hours of [0.5, 12]) {
          for (const experience of ['new', 'veteran']) {
            const profile = { members: true, goal, hours, gp: 'some', experience, iron: true }
            const r = recommend(profile, PLAYERS[name])
            runs++
            check(`${name}/${goal}/iron/${hours}h/${experience}`, r.profile, PLAYERS[name], r, problems)
          }
        }
      }
    }
    // A broad sweep should stay quick: the planner runs on every answer someone changes.
    expect(Date.now() - started, `${runs} plans`).toBeLessThan(60_000)
    // Every problem at once, with a few of each kind, so one run shows what needs fixing.
    const kinds = new Map()
    for (const m of problems) {
      const k = m.replace(/^[^:]*: /, '').replace(/\d+M against \d+M/, 'N against M').replace(/[A-Z][a-z]+ (has no reason|twice|goes past 99)/, '$1').replace(/^costs.*/, 'costs more than the budget with no note')
      kinds.set(k, [...(kinds.get(k) || []), m])
    }
    const summary = [...kinds].map(([k, list]) => `${list.length} x ${k} (e.g. ${list[0]})`)
    expect(summary).toEqual([])
  })

  it('gives the same plan for the same answers', () => {
    for (const name of ['mid', 'skewedReal']) {
      for (const goal of GOALS) {
        const profile = { members: true, goal, hours: 3, gp: 'some', experience: 'returning', iron: false }
        expect(recommend(profile, PLAYERS[name]).goals, `${name}/${goal}`).toEqual(recommend(profile, PLAYERS[name]).goals)
      }
    }
  })

  it('keeps quests whose fights need more combat than the account has out of every plan', () => {
    const s = PLAYERS.fresh
    expect(combatLevel(levelsOf(s))).toBeLessThan(10)
    for (const goal of GOALS) {
      const r = recommend({ members: true, goal, hours: 2, gp: 'rich', experience: 'returning', iron: false }, s)
      const ids = r.phases.flatMap((p) => p.rows.filter((x) => x.kind === 'quest').map((x) => x.id))
      for (const id of ['monkey-madness-i', 'dragon-slayer-i', 'the-grand-tree']) expect(ids, `${goal}: ${id}`).not.toContain(id)
    }
  })

  it('gives a maxed account the next big goal and says so, never a plan that is already done', () => {
    const maxed = stats({ all: 99 })
    for (const goal of GOALS) {
      const r = recommend({ members: true, goal, hours: 2, gp: 'rich', experience: 'veteran', iron: false }, maxed)
      for (const g of r.goals) expect(g.targetXp, `${goal}: ${g.skill}`).toBeGreaterThan(g.currentXp)
      if (r.goals.length) expect(r.notes.join(' '), `${goal}`).toMatch(/next big goal/)
    }
  })

  it('makes a money plan worth following: more than a couple of skills for under an hour', () => {
    for (const name of ['low', 'mid', 'high']) {
      const r = recommend({ members: true, goal: 'money', hours: 2, gp: 'low', experience: 'returning', iron: false }, PLAYERS[name])
      expect(r.totals.hours, `${name}`).toBeGreaterThanOrEqual(2 * 7)
    }
  })
})
