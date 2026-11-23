import { describe, expect, it } from 'vitest'
import { combatLevel, fundingFor, hoursBetween, isFreeQuest, questsFor, unlockFor } from '@/utils/smartReasons'
import { skillStates } from '@/utils/recommendedPlans'
import { xpAtLevel } from '@/utils/planner'
import { SKILL_NAMES } from '@/utils/osrsSkills'
import { getQuest } from '@/data/quests'

const at = (levels) => skillStates(Object.fromEntries(SKILL_NAMES.map((s) => [s, { xp: xpAtLevel(levels[s] ?? levels.all ?? 1), level: levels[s] ?? levels.all ?? 1 }])))
const members = { members: true }
const free = { members: false }

describe('unlock levels', () => {
  it('finds the next level that opens a clearly faster method, with a reason that has the rates', () => {
    const u = unlockFor(at({ all: 20 }).find((s) => s.skill === 'Fishing'), members)
    expect(u).toBeTruthy()
    expect(u.to).toBeGreaterThan(20)
    expect(u.toRate).toBeGreaterThanOrEqual(u.fromRate * 1.3)
    expect(u.reason).toMatch(/xp an hour/)
    expect(u.hours).toBeGreaterThan(0)
  })
  it('does not go past a skill at 99, or outside free-to-play', () => {
    expect(unlockFor(at({ all: 99 })[0], members)).toBeNull()
    expect(unlockFor(at({ all: 20 }).find((s) => s.skill === 'Slayer'), free)).toBeNull()
  })
  it('cuts a long way to what fits in about 40 hours and says it is on the way', () => {
    const states = at({ all: 1 })
    for (const s of states) {
      const u = unlockFor(s, members)
      if (u) expect(u.hours).toBeLessThanOrEqual(40 + 0.01)
    }
  })
})

describe('quests worth doing', () => {
  it('gives quests with what they save, what they need, and says when the length is an estimate', () => {
    const rows = questsFor(at({ all: 40 }), members, new Set(), { minNet: -3 })
    expect(rows.length).toBeGreaterThan(0)
    const r = rows[0]
    expect(r.net).toBeGreaterThanOrEqual(-3)
    expect(r.estimated).toBe(true)
    expect(r.minutes).toBeGreaterThan(0)
    // only clear wins by default: whatever comes back saves more than it costs
    for (const w of questsFor(at({ all: 1 }), members)) expect(w.savedHours).toBeGreaterThan(w.minutes / 60)
    expect(r.chain[r.chain.length - 1]).toBe(r.quest.id)
  })
  it('turns a missing level into a requirement, and skips quests already finished', () => {
    const states = at({ all: 40, Magic: 40 })
    const mage = questsFor(states, members, new Set(), { minNet: -3 }).find((r) => r.quest.id === 'mage-arena-i')
    if (mage) expect(mage.unmet).toEqual([{ skill: 'Magic', need: 60, have: 40 }])
    // Finished quests are not recommended again (their whole chain is done when the quest is)
    const first = questsFor(states, members, new Set(), { minNet: -3 })
    const done = new Set(first.flatMap((r) => r.chain))
    const again = questsFor(states, members, done, { minNet: -3 }).map((r) => r.quest.id)
    for (const r of first) expect(again).not.toContain(r.quest.id)
  })
  it('free-to-play gets free quests only', () => {
    for (const r of questsFor(at({ all: 40 }), free, new Set(), { minNet: -3 })) for (const id of r.chain) expect(isFreeQuest(getQuest(id))).toBe(true)
  })
})

describe('quests need the combat level to get through them', () => {
  it('works out the game combat level', () => {
    expect(combatLevel({})).toBe(3)
    expect(combatLevel({ Attack: 99, Strength: 99, Defence: 99, Hitpoints: 99, Prayer: 99, Ranged: 99, Magic: 99 })).toBe(126)
  })
  it('keeps a low combat account away from Monkey Madness I and Dragon Slayer I, however much they would save', () => {
    const ids = questsFor(at({ all: 6 }), members, new Set(), { minNet: -100 }).map((r) => r.quest.id)
    expect(ids).not.toContain('monkey-madness-i')
    expect(ids).not.toContain('dragon-slayer-i')
    expect(ids).not.toContain('the-grand-tree')
  })
  it('gives each quest a length of at least a few minutes, and Monkey Madness I a few hours', () => {
    const mm = questsFor(at({ all: 75 }), members, new Set(), { minNet: -100 }).find((r) => r.quest.id === 'monkey-madness-i')
    expect(mm.minutes).toBeGreaterThanOrEqual(3 * 60)
  })
})

describe('funding', () => {
  it('has nothing to fund when the costly goals are small', () => {
    expect(fundingFor(at({ all: 40 }), members, [{ skill: 'Construction', netGp: -200_000 }])).toEqual([])
  })
  it('picks a skill that earns, never one of the costly ones, and says what it covers', () => {
    const out = fundingFor(at({ all: 50 }), members, [{ skill: 'Construction', netGp: -9_000_000 }, { skill: 'Prayer', netGp: -4_000_000 }])
    expect(out.length).toBeLessThanOrEqual(2)
    for (const o of out) {
      expect(['Construction', 'Prayer']).not.toContain(o.skill)
      expect(o.netGp).toBeGreaterThan(0)
      expect(o.reason).toMatch(/Construction/)
    }
  })
})

describe('hours', () => {
  it('is more for a longer way, and null for a skill with no route in the catalogue', () => {
    const s = at({ all: 1 }).find((x) => x.skill === 'Woodcutting')
    expect(hoursBetween(s, 40, members)).toBeLessThan(hoursBetween(s, 60, members))
    expect(hoursBetween(at({ all: 1 }).find((x) => x.skill === 'Attack'), 40, free)).toBeNull()
  })
})
