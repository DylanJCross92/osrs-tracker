import { describe, expect, it } from 'vitest'
import { plannedQuestReqIds, questChain, questMinutes, withPrerequisites, withoutQuest } from '@/data/quests'
import { methodAvailability } from '@/utils/requirements'
import { getMethod } from '@/data/trainingMethods'
import { AUTO_BALANCED, AUTO_FAST, planGoal, suggestedQuests, xpAtLevel } from '@/utils/planner'

const rc = (o = {}) => ({ skill: 'Runecraft', currentXp: 0, targetXp: xpAtLevel(99), methodId: AUTO_BALANCED, ...o })

describe('quest prerequisites', () => {
  it('lists what a quest needs first, in order', () => {
    expect(questChain('temple-of-the-eye')).toEqual(['rune-mysteries', 'enter-the-abyss', 'temple-of-the-eye'])
    expect(withPrerequisites(['temple-of-the-eye', 'rune-mysteries'])).toEqual(['rune-mysteries', 'enter-the-abyss', 'temple-of-the-eye'])
  })
  it('drops a quest together with the ones that need it', () => {
    expect(withoutQuest(['rune-mysteries', 'enter-the-abyss', 'temple-of-the-eye'], 'enter-the-abyss')).toEqual(['rune-mysteries'])
    expect(withoutQuest(['rune-mysteries', 'enter-the-abyss'], 'temple-of-the-eye')).toEqual(['rune-mysteries', 'enter-the-abyss'])
  })
  it('adds up their time and names the requirements a plan covers', () => {
    expect(questMinutes(['temple-of-the-eye'])).toBe(20)
    expect(questMinutes(['temple-of-the-eye'], new Set(['rune-mysteries']))).toBe(15)
    expect(plannedQuestReqIds([{ quests: ['temple-of-the-eye'] }])).toContain('quest:temple-of-the-eye')
  })
})

describe('planGoal with the Runecraft quests', () => {
  it('counts the quest xp, the prerequisites and the time they take', () => {
    const plan = planGoal(rc({ quests: ['temple-of-the-eye'] }))
    expect(plan.questXp).toBe(500 + 1000 + 9210)
    expect(plan.questList.map((x) => x.name)).toEqual(['Rune Mysteries', 'Enter the Abyss', 'Temple of the Eye'])
    expect(plan.questHours).toBeCloseTo(20 / 60)
  })
  it('does not count quests that are already finished', () => {
    const plan = planGoal(rc({ quests: ['temple-of-the-eye'], doneQuestIds: ['rune-mysteries', 'enter-the-abyss', 'temple-of-the-eye'] }))
    expect(plan.questXp).toBe(0)
    expect(plan.questHours).toBe(0)
  })
})

describe('suggestedQuests', () => {
  it('turns the Runecraft quests on from level 1, skipping the paid early levels', () => {
    expect(suggestedQuests(rc())).toEqual(['rune-mysteries', 'enter-the-abyss', 'temple-of-the-eye'])
  })
  it('leaves finished quests out', () => {
    expect(suggestedQuests(rc({ currentXp: 500, doneQuestIds: ['rune-mysteries'] }))).toEqual(['enter-the-abyss', 'temple-of-the-eye'])
  })
  it('suggests nothing when the route never needs them and they would not pay off', () => {
    expect(suggestedQuests(rc({ currentXp: xpAtLevel(85) }))).toEqual([])
  })
  it('suggests nothing for a skill with no such quests', () => {
    expect(suggestedQuests({ skill: 'Mining', currentXp: 0, targetXp: xpAtLevel(99), methodId: AUTO_FAST })).toEqual([])
  })
})

describe('a method that needs a planned quest', () => {
  it('counts the quest as covered by the plan', () => {
    const gotr = getMethod('runecraft-gotr')
    expect(methodAvailability(gotr, { confirmations: {} }).state).toBe('unconfirmed')
    expect(methodAvailability(gotr, { confirmations: {}, plannedQuests: plannedQuestReqIds([{ quests: ['temple-of-the-eye'] }]) }).state).toBe('planned')
    // Even a "missing" answer is covered once the plan does the quest.
    expect(methodAvailability(gotr, { confirmations: { 'quest:temple-of-the-eye': 'missing' }, plannedQuests: ['quest:temple-of-the-eye'] }).state).toBe('planned')
  })
})
