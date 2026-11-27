import { describe, expect, it } from 'vitest'
import { planGoal, xpAtLevel, AUTO_FAST } from '@/utils/planner'
import { QUESTS } from '@/data/quests'
import { goalStatus } from '@/utils/planSteps'

describe('a goal whose XP all comes from quests', () => {
  const quest = QUESTS.find((q) => q.rewards?.Fishing >= 1000)
  const goal = { skill: 'Fishing', currentXp: 0, targetXp: Math.min(quest.rewards.Fishing, xpAtLevel(8)), methodId: AUTO_FAST, customXpPerHour: 0, quests: [quest.id] }

  it('has nothing left to train but still has the quests to do', () => {
    const plan = planGoal(goal)
    expect(plan.remainingXp).toBe(0)
    expect(plan.questList.length).toBe(1)
  })

  it('is not called done until the quests are done (they are what is left)', () => {
    expect(goalStatus(planGoal(goal), null)).not.toBe('done')
    // with no quests it really is finished
    expect(goalStatus(planGoal({ ...goal, quests: [], currentXp: goal.targetXp }), null)).toBe('done')
  })
})
