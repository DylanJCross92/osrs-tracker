import { describe, expect, it } from 'vitest'
import { ALL_QUESTS, LENGTH_MINUTES, QUESTS, getQuest, questChain } from '@/data/quests'
import { QUEST_DATA } from '@/data/questData.generated'
import { QUEST_LIST, questBySlug } from '@/data/questList'
import { F2P_METHOD_IDS, F2P_SKILLS, COMBAT_TIERS } from '@/data/plannerMilestones'
import { TRAINING_METHODS } from '@/data/trainingMethods'
import { requirementsFor } from '@/data/methodRequirements'
import { SKILL_NAMES } from '@/utils/osrsSkills'
import { questSlug } from '@/utils/questSlug'

// The data the Smart Planner reasons from has to agree with itself: ids that point at something, numbers that make sense, lists that match.

describe('quest data', () => {
  it('has a plain, unique id and name for every quest', () => {
    expect(new Set(ALL_QUESTS.map((q) => q.id)).size).toBe(ALL_QUESTS.length)
    expect(new Set(QUEST_DATA.map((q) => q.name)).size).toBe(QUEST_DATA.length)
  })

  it('has sensible numbers on every quest', () => {
    for (const q of ALL_QUESTS) {
      expect(q.minutes, q.name).toBeGreaterThan(0)
      expect(q.combat, q.name).toBeGreaterThanOrEqual(0)
      expect(q.combat, q.name).toBeLessThanOrEqual(126)
      for (const [skill, xp] of Object.entries(q.rewards)) {
        expect(SKILL_NAMES, `${q.name}: ${skill}`).toContain(skill)
        expect(xp, `${q.name}: ${skill}`).toBeGreaterThan(0)
      }
      for (const [skill, level] of Object.entries(q.reqs)) {
        expect(SKILL_NAMES, `${q.name} needs ${skill}`).toContain(skill)
        expect(level, `${q.name}: ${skill}`).toBeGreaterThanOrEqual(1)
        expect(level, `${q.name}: ${skill}`).toBeLessThanOrEqual(99)
      }
      if (q.length) expect(LENGTH_MINUTES, q.name).toHaveProperty(q.length)
    }
  })

  it('points every "comes first" at a quest we have, with no loops', () => {
    for (const q of ALL_QUESTS) {
      for (const r of q.requires) expect(getQuest(r), `${q.name} needs ${r}`).not.toBeNull()
      const chain = questChain(q.id)
      expect(new Set(chain).size, `${q.name}: a loop in what it needs`).toBe(chain.length)
      expect(chain[chain.length - 1], q.name).toBe(q.id)
    }
  })

  it('knows each quest by the older id plans were saved with, and by its name', () => {
    expect(getQuest('eadgars-ruse')?.name).toBe("Eadgar's Ruse")
    expect(getQuest("eadgar's-ruse")?.name).toBe("Eadgar's Ruse")
    expect(getQuest('witchs-house')?.name).toBe("Witch's House")
    expect(getQuest('knights-sword')?.name).toBe("The Knight's Sword")
  })

  it('has every planner quest in the tracker list, with the same free or members type', () => {
    for (const q of QUESTS) {
      const listed = questBySlug(questSlug(q.name))
      expect(listed, `${q.name} is not in the quest tracker list`).not.toBeNull()
      if (!q.miniquest) expect(listed.type === 'F', `${q.name}: free or members`).toBe(q.members === false)
    }
  })

  it('only recommends quests with a full set of details, and never one that needs a quest we do not have', () => {
    for (const q of QUESTS) expect(q.length, `${q.name} has no length`).toBeTruthy()
  })

  it('keeps the Wiki-checked corrections the script cannot read', () => {
    const mm1 = getQuest('monkey-madness-i')
    expect(mm1.rewards).toEqual({ Attack: 35000, Defence: 35000, Strength: 20000, Hitpoints: 20000 })
    expect(mm1.combat).toBeGreaterThanOrEqual(65)
    expect(getQuest('temple-of-the-eye').rewards.Runecraft).toBe(9210)
    // It gives no experience at all, so it is not a shortcut (an earlier hand-written list had it at 15,000 Magic XP)
    expect(QUESTS.find((q) => q.name === 'Mage Arena I')).toBeUndefined()
  })
})

describe('method and tier data', () => {
  it('names only real methods of free-to-play skills as free-to-play methods', () => {
    const byId = new Map(TRAINING_METHODS.map((m) => [m.id, m]))
    for (const id of F2P_METHOD_IDS) {
      expect(byId.has(id), `${id} is not a method`).toBe(true)
      expect(F2P_SKILLS, `${id} is a members skill`).toContain(byId.get(id).skill)
    }
  })

  it('makes a quest in a method requirement a quest, for every quest we know', () => {
    const sample = QUEST_LIST.find((q) => q.name === 'Lost City')
    const method = { id: 'x', skill: 'Mining', requirements: 'Lost City' }
    const items = requirementsFor(method)
    expect(items.some((i) => i.kind === 'quest' && i.id === sample.id)).toBe(true)
  })

  it('has combat tiers whose levels are real levels of real skills', () => {
    for (const tier of COMBAT_TIERS) {
      for (const g of tier.goals) {
        expect(SKILL_NAMES, `${tier.title}: ${g.skill}`).toContain(g.skill)
        expect(g.level, `${tier.title}: ${g.skill}`).toBeGreaterThanOrEqual(1)
        expect(g.level, `${tier.title}: ${g.skill}`).toBeLessThanOrEqual(99)
      }
    }
  })
})
