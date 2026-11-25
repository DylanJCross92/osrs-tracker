import { describe, expect, it } from 'vitest'
import { recommend, planFromProfile } from '@/utils/smartPlanner'
import { cleanProfile } from '@/utils/smartProfile'
import { SKILL_NAMES } from '@/utils/osrsSkills'
import { xpAtLevel } from '@/utils/planner'

const at = (levels) => Object.fromEntries(SKILL_NAMES.map((s) => [s, { xp: xpAtLevel(levels[s] ?? levels.all ?? 1), level: levels[s] ?? levels.all ?? 1 }]))
const goalsOf = (rec) => rec.goals
const COMBAT = ['Attack', 'Strength', 'Defence', 'Ranged', 'Prayer', 'Magic', 'Slayer', 'Hitpoints']
const GOALS = ['skills', 'money', 'quests', 'afk', 'hardcore']

describe('the Smart Planner and a level 3 skiller', () => {
  it('never plans a combat skill or Slayer, whatever the goal', () => {
    for (const goal of GOALS) {
      const rec = recommend({ build: 'skiller', goal, experience: 'returning' }, at({ all: 20 }))
      expect(rec.phases.length, goal).toBeGreaterThan(0)
      for (const g of goalsOf(rec)) expect(COMBAT, `${goal} ${g.skill}`).not.toContain(g.skill)
      for (const p of rec.phases) for (const row of p.rows || []) if (row.skill) expect(COMBAT, `${goal} row ${row.skill}`).not.toContain(row.skill)
    }
  })
  it('a skiller who asked for combat gets the skills plan instead', () => {
    expect(cleanProfile({ build: 'skiller', goal: 'combat' }).goal).toBe('skills')
    expect(cleanProfile({ build: 'main', goal: 'combat' }).goal).toBe('combat')
    expect(cleanProfile({ build: 'pure', goal: 'combat' }).goal).toBe('combat')
  })
  it('never plans a method that a skiller cannot use', () => {
    const rec = recommend({ build: 'skiller', goal: 'money' }, at({ all: 40 }))
    for (const g of goalsOf(rec)) if (g.allowedMethodIds) expect(g.allowedMethodIds).not.toContain('runecraft-ourania')
  })
})

describe('the Smart Planner and a pure', () => {
  it('never trains Defence and holds Prayer at 52', () => {
    for (const goal of ['skills', 'combat']) {
      const rec = recommend({ build: 'pure', goal, experience: 'returning' }, at({ all: 30 }))
      for (const g of goalsOf(rec)) {
        expect(g.skill, goal).not.toBe('Defence')
        if (g.skill === 'Prayer') expect(g.targetXp).toBeLessThanOrEqual(xpAtLevel(52))
      }
    }
  })
})

describe('the Smart Planner and a zerker', () => {
  it('stops Defence at 45', () => {
    const rec = recommend({ build: 'zerker', goal: 'combat' }, at({ all: 30 }))
    for (const g of goalsOf(rec)) if (g.skill === 'Defence') expect(g.targetXp).toBeLessThanOrEqual(xpAtLevel(45))
  })
})

describe('a plan from the answers', () => {
  it('keeps the build and the ironman kind in the answers', () => {
    expect(cleanProfile({ build: 'pure', iron: true, ironKind: 'hardcore' })).toMatchObject({ build: 'pure', iron: true, ironKind: 'hardcore' })
    expect(cleanProfile({ build: 'wizard', ironKind: 'nope' })).toMatchObject({ build: 'main', ironKind: 'standard' })
  })
  it('a plain account is unchanged', () => {
    const plain = recommend({ goal: 'skills' }, at({ all: 40 }))
    const main = recommend({ goal: 'skills', build: 'main' }, at({ all: 40 }))
    expect(main.phases.map((p) => p.id)).toEqual(plain.phases.map((p) => p.id))
    expect(typeof planFromProfile).toBe('function')
  })
})
