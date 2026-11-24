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

async function toThePlan(w) {
  const next = async () => {
    await w.findAll('button').find((b) => /^(Continue|Show my plan)$/.test(b.text().trim())).trigger('click')
    await nextTick()
  }
  await next() // who -> goal
  await next() // goal -> time
  await next() // time -> plan
  await vi.advanceTimersByTimeAsync(1000)
}

describe('Smart Planner events', () => {
  it('logs the finished plan being seen once, however many times it is worked out again while open', async () => {
    const w = mount(SmartPlannerBody, { props: { skills, hasPlayer: true, playerLabel: 'Test' }, global: { stubs } })
    await toThePlan(w)
    expect(count('smart_planner_plan_viewed')).toBe(1)
    // the player's stats refreshing (a new object with the same levels) works the plan out again; it is the same view
    await w.setProps({ skills: JSON.parse(JSON.stringify(skills)) })
    await vi.advanceTimersByTimeAsync(1000)
    expect(count('smart_planner_plan_viewed')).toBe(1)
  })

  it('logs it again when the plan step is left and reached again', async () => {
    const w = mount(SmartPlannerBody, { props: { skills, hasPlayer: true, playerLabel: 'Test' }, global: { stubs } })
    await toThePlan(w)
    await w.findAll('button').find((b) => /^Back$/.test(b.text().trim())).trigger('click')
    await nextTick()
    await w.findAll('button').find((b) => /^Show my plan$/.test(b.text().trim())).trigger('click')
    await vi.advanceTimersByTimeAsync(1000)
    expect(count('smart_planner_plan_viewed')).toBe(2)
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
