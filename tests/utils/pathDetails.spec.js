import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

vi.mock('@/composables/useRouteRequirements', () => ({ useRouteRequirements: () => ({ routeMethods: ref([]) }) }))
vi.mock('@/composables/useRequirements', () => ({ useRequirements: () => ({ doneQuestIds: ref(['knights-sword']) }) }))

import PlannerPathDetails from '@/components/planner/PlannerPathDetails.vue'

const stubs = { PlannerMaterials: true, RequirementList: true }
const plan = (over = {}) => ({ currentXp: 1_000_000, startXp: 1_000_000, targetXp: 13_034_431, remainingXp: 12_034_431, questList: [], questHours: 0, segments: [], ...over })

describe('the details under a skill route', () => {
  it('lists quests that could be done, and the ones already finished, and opens the Quests tab from the button', async () => {
    const w = mount(PlannerPathDetails, { props: { plan: plan(), goal: { skill: 'Herblore' } }, global: { stubs } })
    await w.find('.pd-bar').trigger('click')
    const text = w.text()
    expect(text).toContain("Eadgar's Ruse")
    expect(text).toContain('+11,000 xp')
    await w.find('.pd-quest-act').trigger('click')
    expect(w.emitted('edit')[0]).toEqual(['quests'])
  })
  it('shows finished quests of the skill without offering them again', async () => {
    const w = mount(PlannerPathDetails, { props: { plan: plan(), goal: { skill: 'Smithing' } }, global: { stubs } })
    await w.find('.pd-bar').trigger('click')
    expect(w.find('.pd-done-chip').text()).toContain("The Knight's Sword")
    expect(w.find('.pd-quests').exists()).toBe(false)
  })
  it('draws nothing for a skill with no quests, nothing to buy and no requirements', () => {
    const w = mount(PlannerPathDetails, { props: { plan: plan(), goal: { skill: 'Firemaking' } }, global: { stubs } })
    expect(w.find('.pd').exists()).toBe(false)
  })
})
