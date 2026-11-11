import { describe, expect, it } from 'vitest'
import { QUEST_LIST, questBySlug } from '@/data/questList'
import { QUESTS } from '@/data/quests'
import { TRAINING_METHODS } from '@/data/trainingMethods'
import { requirementsFor } from '@/data/methodRequirements'
import { completedQuestSlugs, doneShortcutIds, questStats } from '@/utils/questProgress'
import { questId, questSlug } from '@/utils/questSlug'
import { cleanConfirmations, requirementStatus } from '@/utils/requirements'
import { planGoal, xpAtLevel, AUTO_FAST } from '@/utils/planner'

describe('quest list', () => {
  it('has unique, valid ids that fit the answer store', () => {
    const ids = new Set()
    for (const q of QUEST_LIST) {
      expect(q.id).toMatch(/^quest:[a-z0-9'-]{1,80}$/)
      expect(ids.has(q.id)).toBe(false)
      ids.add(q.id)
      expect(['F', 'M', 'MQ']).toContain(q.type)
    }
    expect(QUEST_LIST.length).toBeGreaterThan(150)
    expect(cleanConfirmations(Object.fromEntries(QUEST_LIST.map((q) => [q.id, 'have'])))).toEqual(Object.fromEntries(QUEST_LIST.map((q) => [q.id, 'have'])))
  })

  it('shares one slug scheme with requirements and quest shortcuts', () => {
    expect(questSlug("Eagles' Peak")).toBe("eagles'-peak")
    expect(questId('Monkey Madness II')).toBe('quest:monkey-madness-ii')
    // Every quest a method asks for (except the NMZ group) is a real quest in the tracker.
    for (const m of TRAINING_METHODS) {
      for (const r of requirementsFor(m)) {
        if (r.kind !== 'quest' || r.id === 'quest:nmz-quests') continue
        const slug = r.id.replace(/^quest:/, '').replace(/:partial$/, '')
        expect(questBySlug(slug), `${m.id} needs ${r.label}`).not.toBeNull()
      }
    }
    // Every XP-shortcut quest is in the tracker too, so finishing one there is noticed by the shortcuts.
    for (const q of QUESTS) expect(questBySlug(questSlug(q.name)), q.name).not.toBeNull()
  })
})

describe('quest progress', () => {
  const answers = { 'quest:monkey-madness-ii': 'have', 'quest:the-grand-tree': 'have', 'quest:dragon-slayer-ii': 'missing', 'quest:sins-of-the-father:partial': 'have', 'equipment:fire-cape': 'have' }

  it('counts only whole quests answered "have"', () => {
    expect([...completedQuestSlugs(answers)].sort()).toEqual(['monkey-madness-ii', 'the-grand-tree'])
    const s = questStats(answers)
    expect(s.done).toBe(2)
    expect(s.total).toBe(QUEST_LIST.length)
    expect(s.by.M.done).toBe(2)
  })

  it('a finished quest satisfies the requirement that names it, a partial finished quest alone does not', () => {
    const req = { id: 'quest:monkey-madness-ii', kind: 'quest', label: 'Monkey Madness II' }
    expect(requirementStatus(req, { confirmations: answers })).toBe('met')
    const dsii = { id: 'quest:dragon-slayer-ii', kind: 'quest', label: 'Dragon Slayer II' }
    expect(requirementStatus(dsii, { confirmations: answers })).toBe('unmet')
    const sotf = { id: 'quest:sins-of-the-father', kind: 'quest', label: 'Sins of the Father' }
    expect(requirementStatus(sotf, { confirmations: answers })).toBe('unknown')
  })

  it('finished shortcut quests give no XP in a plan', () => {
    const goal = { skill: 'Agility', currentXp: xpAtLevel(20), targetXp: xpAtLevel(50), methodId: AUTO_FAST, customXpPerHour: 0, quests: ['the-grand-tree'] }
    const counted = planGoal(goal)
    expect(counted.questXp).toBeGreaterThan(0)
    const skipped = planGoal({ ...goal, doneQuestIds: doneShortcutIds(answers) })
    expect(skipped.questXp).toBe(0)
    expect(skipped.hours).toBeGreaterThan(counted.hours)
  })
})
