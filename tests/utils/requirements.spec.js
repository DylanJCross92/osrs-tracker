import { describe, expect, it } from 'vitest'
import { parseRequirementText, requirementsFor } from '@/data/methodRequirements'
import { TRAINING_METHODS, getMethod } from '@/data/trainingMethods'
import { blockedMethodIds, cleanConfirmations, confirmationFor, methodAvailability, requirementStatus } from '@/utils/requirements'
import { planGoal, xpAtLevel, AUTO_FAST } from '@/utils/planner'

describe('parseRequirementText', () => {
  it('splits levels, quests (with partial progress), gear and unlocks', () => {
    const reqs = parseRequirementText('Monkey Madness II (partial), 75 Attack, Toxic blowpipe, Ancient Magicks', 'Strength')
    expect(reqs.map((r) => [r.kind, r.label])).toEqual([
      ['quest', 'Monkey Madness II (partial)'],
      ['skill', '75 Attack'],
      ['equipment', 'Toxic blowpipe'],
      ['unlock', 'Ancient Magicks'],
    ])
    expect(reqs[0].partial).toBe(true)
    expect(reqs[1]).toMatchObject({ skill: 'Attack', level: 75 })
  })

  it('reads "Skill 30" and "Hunter level 63" forms, diaries and notes, and drops a level the method already needs', () => {
    expect(parseRequirementText('Sailing 45, partial Troubled Tortugans')[0]).toMatchObject({ kind: 'skill', skill: 'Sailing', level: 45 })
    expect(parseRequirementText('Hunter level 63')[0]).toMatchObject({ kind: 'skill', skill: 'Hunter', level: 63 })
    expect(parseRequirementText('Medium Karamja Diary')[0].kind).toBe('diary')
    expect(parseRequirementText('Combat level 100 recommended')[0].kind).toBe('note')
    expect(parseRequirementText('Prayer 30, bone shards', 'Prayer', 30).map((r) => r.kind)).toEqual(['equipment'])
  })

  it('gives every catalog requirement a stable id and a known kind', () => {
    for (const m of TRAINING_METHODS) {
      for (const r of requirementsFor(m)) {
        expect(r.id).toMatch(/^[a-z]+:[a-z0-9:'-]+$/)
        expect(['skill', 'quest', 'diary', 'equipment', 'unlock', 'note']).toContain(r.kind)
      }
    }
  })
})

describe('requirementStatus', () => {
  const skill = { id: 'skill:attack:75', kind: 'skill', skill: 'Attack', level: 75, label: '75 Attack' }
  const quest = { id: 'quest:monkey-madness-ii', kind: 'quest', label: 'Monkey Madness II' }
  const partial = { id: 'quest:monkey-madness-ii:partial', kind: 'quest', label: 'Monkey Madness II (partial)', partial: true }

  it('checks levels from tracked data, and credits levels the plan itself trains', () => {
    expect(requirementStatus(skill, { levels: { Attack: 80 } })).toBe('met')
    expect(requirementStatus(skill, { levels: { Attack: 60 } })).toBe('unmet')
    expect(requirementStatus(skill, { levels: { Attack: 60 }, planned: { Attack: 99 } })).toBe('planned')
    expect(requirementStatus(skill, { levels: null })).toBe('unknown')
  })

  it('never assumes quests or gear: they are unknown until confirmed', () => {
    expect(requirementStatus(quest, {})).toBe('unknown')
    expect(requirementStatus(quest, { confirmations: { [quest.id]: 'have' } })).toBe('met')
    expect(requirementStatus(quest, { confirmations: { [quest.id]: 'missing' } })).toBe('unmet')
    expect(requirementStatus(quest, { confirmations: { [quest.id]: 'unknown' } })).toBe('unknown')
  })

  it('counts a finished quest as covering its partial requirement', () => {
    expect(confirmationFor(partial, { [quest.id]: 'have' })).toBe('have')
    expect(confirmationFor(partial, { [quest.id]: 'missing' })).toBeNull()
  })
})

describe('methodAvailability and blocking', () => {
  const monkeys = getMethod('attack-maniacal-monkeys')

  it('is blocked only by something confirmed missing, unconfirmed otherwise', () => {
    const unsure = methodAvailability(monkeys, { levels: { Attack: 80 }, confirmations: {} })
    expect(unsure.state).toBe('unconfirmed')
    const missing = methodAvailability(monkeys, { levels: { Attack: 80 }, confirmations: { 'quest:monkey-madness-ii:partial': 'missing' } })
    expect(missing.state).toBe('blocked')
    const ready = methodAvailability(monkeys, { levels: { Attack: 80 }, confirmations: { 'quest:monkey-madness-ii:partial': 'have' } })
    expect(ready.state).toBe('available')
  })

  it('does not block on unknowns', () => {
    expect(blockedMethodIds(TRAINING_METHODS, { levels: null, confirmations: {} })).toEqual([])
    expect(blockedMethodIds(TRAINING_METHODS, { levels: null, confirmations: { 'quest:monkey-madness-ii:partial': 'missing' } })).toContain('attack-maniacal-monkeys')
  })
})

describe('planning with blocked methods', () => {
  const goal = { skill: 'Strength', currentXp: xpAtLevel(75), targetXp: xpAtLevel(90), methodId: AUTO_FAST, customXpPerHour: 0, quests: [] }
  const used = (p) => p.segments.map((s) => s.method?.id)

  it('recommends the fastest method normally and skips a blocked one when asked', () => {
    expect(used(planGoal(goal))).toContain('strength-maniacal-monkeys')
    const blocked = planGoal({ ...goal, blockedMethodIds: ['strength-maniacal-monkeys'] })
    expect(used(blocked)).not.toContain('strength-maniacal-monkeys')
    expect(blocked.hours).toBeGreaterThan(planGoal(goal).hours)
  })

  it('still covers the range when every method there is blocked (flagged, not left as a gap)', () => {
    const all = TRAINING_METHODS.filter((m) => m.skill === 'Strength').map((m) => m.id)
    const p = planGoal({ ...goal, blockedMethodIds: all })
    expect(p.complete).toBe(true)
  })

  it('always uses a method the player picked by hand', () => {
    const p = planGoal({ ...goal, methodId: 'strength-maniacal-monkeys', blockedMethodIds: ['strength-maniacal-monkeys'] })
    expect(used(p)).toContain('strength-maniacal-monkeys')
  })
})

describe('cleanConfirmations', () => {
  it('keeps only valid answers for plausible ids', () => {
    expect(cleanConfirmations({ 'quest:a': 'have', 'quest:b': 'maybe', 'BAD ID': 'have', 'unlock:x': 'unknown' })).toEqual({ 'quest:a': 'have', 'unlock:x': 'unknown' })
    expect(cleanConfirmations(null)).toEqual({})
    expect(cleanConfirmations([])).toEqual({})
  })
})
