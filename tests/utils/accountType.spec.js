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

describe('the ironman choice', () => {
  it('is remembered with the other planner preferences, and pages follow it', async () => {
    const { useAccountType, ironPref, ironModeRef, setIronMode } = await import('@/composables/useAccountType')
    const { usePlayHours } = await import('@/composables/usePlayHours')
    expect(ironPref()).toBe(false)
    usePlayHours().setPlayHours(3)
    useAccountType().setMembersPref(false)
    useAccountType().setIronPref(true)
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ hours: 3, members: false, iron: true })
    expect(ironModeRef.value).toBe(true)
    // a plan for a main account open while the person plays an ironman shows as main, and the person's own choice comes back after
    setIronMode(false)
    expect(ironModeRef.value).toBe(false)
    setIronMode(null)
    expect(ironModeRef.value).toBe(true)
  })

  it('shows gp as supplies to gather: no prices in the materials list', async () => {
    const { ironModeRef, setIronMode } = await import('@/composables/useAccountType')
    const { default: PlannerMaterials } = await import('@/components/planner/PlannerMaterials.vue')
    const { getMethod } = await import('@/data/trainingMethods')
    const plan = { segments: [{ method: getMethod('cooking-sharks'), fromXp: 1_986_068, toXp: 1_988_168 }] }
    const stubs = { RouterLink: { props: ['to'], template: '<a><slot /></a>' }, GePriceBadge: true, PriceBasisToggle: true }
    setIronMode(true)
    expect(ironModeRef.value).toBe(true)
    const w = mount(PlannerMaterials, { props: { plan }, global: { stubs } })
    expect(w.find('h4').text()).toBe('Supplies to gather')
    // every price piece carries the class that an ironman's page hides
    expect(w.findAll('th').filter((th) => /Price each|Cost/.test(th.text())).every((th) => th.classes('gp-figure'))).toBe(true)
    expect(w.findAll('td.mat-cost').every((td) => td.classes('gp-figure'))).toBe(true)
    setIronMode(false)
    const main = mount(PlannerMaterials, { props: { plan }, global: { stubs } })
    expect(main.find('h4').text()).toBe('Materials needed')
  })
})
