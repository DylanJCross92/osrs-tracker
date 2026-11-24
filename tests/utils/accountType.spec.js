import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { F2P_METHOD_IDS } from '@/data/plannerMilestones'

const KEY = 'tickgains-planner-prefs-v1'
beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

describe('the free-to-play or members choice, kept for every planner', () => {
  it('starts as members, remembers a choice, and keeps the hours a day next to it', async () => {
    const { useAccountType, membersPref } = await import('@/composables/useAccountType')
    const { usePlayHours, playHours } = await import('@/composables/usePlayHours')
    expect(membersPref()).toBe(true)
    usePlayHours().setPlayHours(3)
    useAccountType().setMembersPref(false)
    expect(membersPref()).toBe(false)
    // each is stored without losing the other
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ hours: 3, members: false })
    usePlayHours().setPlayHours(4.5)
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ hours: 4.5, members: false })
    expect(playHours()).toBe(4.5)
  })

  it('is read back the next visit', async () => {
    localStorage.setItem(KEY, JSON.stringify({ hours: 2, members: false }))
    const { membersPref } = await import('@/composables/useAccountType')
    expect(membersPref()).toBe(false)
  })

  it('is the Smart Planner answer too', async () => {
    const { usePlannerProfile } = await import('@/composables/usePlannerProfile')
    const { membersPref } = await import('@/composables/useAccountType')
    usePlannerProfile().answer({ members: false })
    expect(membersPref()).toBe(false)
  })
})

describe('the add-goal window', () => {
  it('works the route out with free methods and hands them to the plan when free-to-play is picked', async () => {
    const { default: PlannerAddGoal } = await import('@/components/planner/PlannerAddGoal.vue')
    const stubs = { RouterLink: { props: ['to'], template: '<a><slot /></a>' }, PlannerRoute: true, NumberInput: true, SkillSelect: true }
    const w = mount(PlannerAddGoal, { props: { globalStrategy: 'auto-fast', gpValue: 2_000_000, initialSkill: 'Smithing', members: true, player: null, existingSkills: [] }, global: { stubs } })
    await w.findAll('.acct-toggle button').find((b) => /Free-to-play/.test(b.text())).trigger('click')
    await w.findAll('button').find((b) => /Add to plan/.test(b.text())).trigger('click')
    const [goal, members] = w.emitted('add')[0]
    expect(members).toBe(false)
    expect(goal.allowedMethodIds.length).toBeGreaterThan(0)
    for (const id of goal.allowedMethodIds) expect(F2P_METHOD_IDS.has(id)).toBe(true)
  })

  it('says so when a skill has no free route', async () => {
    const { default: PlannerAddGoal } = await import('@/components/planner/PlannerAddGoal.vue')
    const stubs = { RouterLink: { props: ['to'], template: '<a><slot /></a>' }, PlannerRoute: true, NumberInput: true, SkillSelect: true }
    const w = mount(PlannerAddGoal, { props: { globalStrategy: 'auto-fast', gpValue: 2_000_000, initialSkill: 'Agility', members: false, player: null, existingSkills: [] }, global: { stubs } })
    expect(w.find('.acct-note').text()).toMatch(/no free-to-play route for Agility/)
  })
})
