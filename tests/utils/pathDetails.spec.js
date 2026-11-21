import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

vi.mock('@/composables/useRouteRequirements', () => ({ useRouteRequirements: () => ({ routeMethods: ref([]) }) }))
const setQuestDone = vi.fn()
vi.mock('@/composables/useRequirements', () => ({ useRequirements: () => ({ doneQuestIds: ref(['knights-sword']), setQuestDone }) }))
vi.mock('@/utils/analytics', () => ({ track: vi.fn() }))

import PlannerPathDetails from '@/components/planner/PlannerPathDetails.vue'

const stubs = { PlannerMaterials: true, RequirementList: true }
const plan = (over = {}) => ({ currentXp: 1_000_000, startXp: 1_000_000, targetXp: 13_034_431, remainingXp: 12_034_431, questList: [], questHours: 0, segments: [], ...over })

describe('the details under a skill route', () => {
  it('lists quests that could be done, and ticking one changes the plan from here', async () => {
    const w = mount(PlannerPathDetails, { props: { plan: plan(), goal: { skill: 'Herblore', quests: [] } }, global: { stubs } })
    await w.find('.pd-bar').trigger('click')
    expect(w.text()).toContain("Eadgar's Ruse")
    expect(w.text()).toContain('+11,000 xp')
    await w.find('.pd-q input').setValue(true)
    const patch = w.emitted('patch')[0][0]
    expect(patch.quests).toContain('eadgars-ruse')
  })
  it('unticks a quest that is in the plan, and can mark one as already done', async () => {
    const inPlan = plan({ questList: [{ id: 'eadgars-ruse', name: "Eadgar's Ruse", xp: 11000, minutes: 0 }] })
    const w = mount(PlannerPathDetails, { props: { plan: inPlan, goal: { skill: 'Herblore', quests: ['eadgars-ruse'] } }, global: { stubs } })
    await w.find('.pd-bar').trigger('click')
    expect(w.find('.pd-q input').element.checked).toBe(true)
    await w.find('.pd-q input').setValue(false)
    expect(w.emitted('patch')[0][0].quests).toEqual([])
    const fresh = mount(PlannerPathDetails, { props: { plan: plan(), goal: { skill: 'Herblore', quests: [] } }, global: { stubs } })
    await fresh.find('.pd-bar').trigger('click')
    await fresh.find('.pd-q-done').trigger('click')
    expect(setQuestDone).toHaveBeenCalledWith("Eadgar's Ruse", true)
  })
  it('shows finished quests of the skill without offering them again', async () => {
    const w = mount(PlannerPathDetails, { props: { plan: plan(), goal: { skill: 'Smithing' } }, global: { stubs } })
    await w.find('.pd-bar').trigger('click')
    expect(w.find('.pd-done-chip').text()).toContain("The Knight's Sword")
    expect(w.find('.pd-q').exists()).toBe(false)
  })
  it('draws nothing for a skill with no quests, nothing to buy and no requirements', () => {
    const w = mount(PlannerPathDetails, { props: { plan: plan(), goal: { skill: 'Firemaking' } }, global: { stubs } })
    expect(w.find('.pd').exists()).toBe(false)
  })
})
