import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { xpAtLevel } from '@/utils/planner'
import { SKILL_NAMES } from '@/utils/osrsSkills'

// What the Smart Planner reports to the site's own event log: one "plan viewed" for each time the plan is really on screen, and one answer for a
// change, not one per notch of a slider.
const events = []
vi.mock('@/utils/analytics', () => ({ track: (name, params) => events.push({ name, ...params }) }))
const { default: SmartPlannerBody } = await import('@/components/planner/SmartPlannerBody.vue')

const skills = Object.fromEntries(SKILL_NAMES.map((s) => [s, { xp: xpAtLevel(40), level: 40 }]))
const stubs = { RouterLink: { props: ['to'], template: '<a><slot /></a>' }, SmartPlanReport: true }
const count = (name) => events.filter((e) => e.name === name).length

beforeEach(() => {
  events.length = 0
  vi.useFakeTimers()
  localStorage.clear()
})
afterEach(() => vi.useRealTimers())

async function showMyPlan(w) {
  const next = async () => {
    await w.findAll('button').find((b) => /^(Continue|Show my plan)$/.test(b.text().trim())).trigger('click')
    await nextTick()
  }
  await next() // who -> goal
  await next() // goal -> time
  await next() // Show my plan: straight to the plan page
  await vi.advanceTimersByTimeAsync(1000)
}

describe('Smart Planner events', () => {
  it('Show my plan hands the answers on once and logs the plan as seen once, without opening a plan step here', async () => {
    const w = mount(SmartPlannerBody, { props: { skills, hasPlayer: true, playerLabel: 'Test' }, global: { stubs } })
    await showMyPlan(w)
    expect(count('smart_planner_plan_viewed')).toBe(1)
    expect(count('smart_planner_start')).toBe(1)
    expect(w.emitted('start')).toHaveLength(1)
    // the plan itself is the planner's own page now, so no "Start this plan" step is shown
    expect(w.findAll('button').some((b) => /Start this plan/.test(b.text()))).toBe(false)
  })

  it('counts a quick run of changes to the same answer once', async () => {
    const w = mount(SmartPlannerBody, { props: { skills, hasPlayer: true, playerLabel: 'Test' }, global: { stubs } })
    await w.findAll('button').find((b) => /^Continue$/.test(b.text().trim())).trigger('click')
    await w.findAll('button').find((b) => /^Continue$/.test(b.text().trim())).trigger('click')
    const range = w.find('input[type=range]')
    for (const v of [3, 3.5, 4, 4.5]) {
      range.element.value = String(v)
      await range.trigger('input')
    }
    expect(events.filter((e) => e.name === 'smart_planner_answer' && e.question === 'hours')).toHaveLength(1)
  })
})
