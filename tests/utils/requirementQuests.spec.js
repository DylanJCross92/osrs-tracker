import { describe, expect, it } from 'vitest'
import { TRAINING_METHODS } from '@/data/trainingMethods'
import { requirementsFor } from '@/data/methodRequirements'
import { REQUIREMENT_QUESTS } from '@/data/requirementQuests'
import { QUEST_LIST } from '@/data/questList'
import { MET, UNKNOWN, methodAvailability, questsBehind, requirementStatus, routeFlag } from '@/utils/requirements'

const all = TRAINING_METHODS.flatMap((m) => requirementsFor(m).map((r) => ({ m, r })))
const find = (id) => all.find((x) => x.r.id === id)

describe('quests behind items and unlocks', () => {
  it('only names quests that exist, for requirements that a method really has', () => {
    const names = new Set(QUEST_LIST.map((q) => q.name))
    for (const [id, v] of Object.entries(REQUIREMENT_QUESTS)) {
      expect(find(id), `${id} is not needed by any method`).toBeTruthy()
      for (const x of v.quests) expect(names.has(x.name), `${x.name} is not a known quest`).toBe(true)
    }
  })

  it('shows Family Crest for the gauntlets and Sleeping Giants stays a plain quest', () => {
    expect(find('equipment:goldsmith-gauntlets').r.quests.map((x) => x.label)).toEqual(['Family Crest'])
    expect(find('equipment:cooking-gauntlets').r.quests.map((x) => x.label)).toEqual(['Family Crest'])
    const giants = all.find((x) => x.r.kind === 'quest' && x.r.label === 'Sleeping Giants')
    expect(giants.r.quests).toBeUndefined()
  })

  it('counts an unlock as covered once its quests are done, but not an item', () => {
    const lunar = find('unlock:lunar-spellbook').r
    expect(requirementStatus(lunar, { confirmations: {} })).toBe(UNKNOWN)
    expect(requirementStatus(lunar, { confirmations: { 'quest:lunar-diplomacy': 'have' } })).toBe(MET)
    const gauntlets = find('equipment:goldsmith-gauntlets').r
    expect(requirementStatus(gauntlets, { confirmations: { 'quest:family-crest': 'have' } })).toBe(UNKNOWN)
    expect(requirementStatus(gauntlets, { confirmations: { 'quest:family-crest': 'have', 'equipment:goldsmith-gauntlets': 'have' } })).toBe(MET)
  })

  it('needs every quest of a pair, and accepts a finished quest where only starting it is asked', () => {
    const neitiznot = find('unlock:neitiznot-access').r
    expect(requirementStatus(neitiznot, { confirmations: { 'quest:the-fremennik-trials': 'have' } })).toBe(UNKNOWN)
    expect(requirementStatus(neitiznot, { confirmations: { 'quest:the-fremennik-trials': 'have', 'quest:the-fremennik-isles': 'have' } })).toBe(MET)
    const furnace = find('unlock:blast-furnace-access').r
    expect(questsBehind(furnace, { 'quest:the-giant-dwarf': 'have' })[0].done).toBe(true)
    expect(questsBehind(furnace, { 'quest:the-giant-dwarf:partial': 'have' })[0].done).toBe(true)
  })

  it('does not undo a "don\'t have this" answer', () => {
    const lunar = find('unlock:lunar-spellbook').r
    expect(requirementStatus(lunar, { confirmations: { 'quest:lunar-diplomacy': 'have', 'unlock:lunar-spellbook': 'missing' } })).not.toBe(MET)
  })

  it('makes a method available when its only gap is an unlock the finished quests cover', () => {
    const m = TRAINING_METHODS.find((x) => x.id === 'smithing-blast-gold')
    const a = methodAvailability(m, { confirmations: { 'quest:family-crest': 'have', 'equipment:goldsmith-gauntlets': 'have', 'quest:the-giant-dwarf': 'have' } })
    expect(a.unmet).toEqual([])
  })
})

describe('the marker on a route step', () => {
  const furnace = TRAINING_METHODS.find((m) => m.id === 'smithing-blast-gold')
  it('lists what is open, missing first, with the quest behind an item', () => {
    const flag = routeFlag(furnace, { confirmations: { 'equipment:goldsmith-gauntlets': 'missing' } })
    expect(flag.state).toBe('blocked')
    expect(flag.items[0].req.id).toBe('equipment:goldsmith-gauntlets')
    const open = routeFlag(furnace, { confirmations: {} })
    expect(open.state).toBe('unconfirmed')
    expect(open.items.find((i) => i.req.id === 'equipment:goldsmith-gauntlets').req.quests[0].label).toBe('Family Crest')
  })
  it('is null when everything is confirmed or the method needs nothing', () => {
    const all = Object.fromEntries(requirementsFor(furnace).map((r) => [r.id, 'have']))
    expect(routeFlag(furnace, { confirmations: all })).toBeNull()
    expect(routeFlag(TRAINING_METHODS.find((m) => !m.requirements), { confirmations: {} })).toBeNull()
  })
})
