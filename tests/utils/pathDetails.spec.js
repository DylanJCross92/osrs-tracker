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

// The row of a quest by its own name (another quest's "needs" line can mention it)
const rowFor = (w, name) => w.findAll('.pd-quests li').find((r) => r.find('b').text() === name)

describe('the details under a skill route', () => {
  it('lists quests that could be done, and ticking one changes the plan from here', async () => {
    const w = mount(PlannerPathDetails, { props: { plan: plan(), goal: { skill: 'Herblore', quests: [] } }, global: { stubs } })
    await w.find('.pd-bar').trigger('click')
    expect(w.text()).toContain("Eadgar's Ruse")
    expect(w.text()).toContain('+11,000 xp')
    await rowFor(w, "Eadgar's Ruse").find('input').setValue(true)
    const patch = w.emitted('patch')[0][0]
    expect(patch.quests).toContain('eadgars-ruse')
  })
  it('unticks a quest that is in the plan, and can mark one as already done', async () => {
    const inPlan = plan({ questList: [{ id: 'eadgars-ruse', name: "Eadgar's Ruse", xp: 11000, minutes: 0 }] })
    const w = mount(PlannerPathDetails, { props: { plan: inPlan, goal: { skill: 'Herblore', quests: ['eadgars-ruse'] } }, global: { stubs } })
    await w.find('.pd-bar').trigger('click')
    expect(rowFor(w, "Eadgar's Ruse").find('input').element.checked).toBe(true)
    await rowFor(w, "Eadgar's Ruse").find('input').setValue(false)
    expect(w.emitted('patch')[0][0].quests).toEqual([])
    const fresh = mount(PlannerPathDetails, { props: { plan: plan(), goal: { skill: 'Herblore', quests: [] } }, global: { stubs } })
    await fresh.find('.pd-bar').trigger('click')
    await rowFor(fresh, "Eadgar's Ruse").find('.pd-q-done').trigger('click')
    expect(setQuestDone).toHaveBeenCalledWith("Eadgar's Ruse", true)
  })
  it('shows finished quests of the skill without offering them again', async () => {
    const w = mount(PlannerPathDetails, { props: { plan: plan(), goal: { skill: 'Smithing' } }, global: { stubs } })
    await w.find('.pd-bar').trigger('click')
    expect(w.find('.pd-done-chip').text()).toContain("The Knight's Sword")
    // Not offered again, whatever else the skill has to offer
    expect(w.findAll('.pd-quests li').some((r) => r.text().includes("The Knight's Sword"))).toBe(false)
  })
  it('draws nothing when there are no quests, nothing to buy and no requirements', () => {
    // A goal that is already finished has nothing left to offer, however many quests the skill has.
    const done = plan({ currentXp: 13_034_431, startXp: 13_034_431, remainingXp: 0 })
    const w = mount(PlannerPathDetails, { props: { plan: done, goal: { skill: 'Sailing' } }, global: { stubs } })
    expect(w.find('.pd').exists()).toBe(false)
  })
})
