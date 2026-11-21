import { describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SmartOrderModal from '@/components/planner/SmartOrderModal.vue'
import { smartOrder } from '@/utils/smartOrder'
import { xpAtLevel } from '@/utils/planner'

const goals = [
  { skill: 'Cooking', currentXp: xpAtLevel(1), targetXp: xpAtLevel(90) },
  { skill: 'Fishing', currentXp: xpAtLevel(1), targetXp: xpAtLevel(90) },
]
const plans = [{ hours: 100, netGp: 1_000_000, remainingXp: 1 }, { hours: 100, netGp: 2_000_000, remainingXp: 1 }]

const mountIt = (props = {}) => {
  // Without a wait, the window shows its short "reading" beat first; skip it by asking for reduced motion.
  window.matchMedia = () => ({ matches: true })
  return mount(SmartOrderModal, { props: { suggestion: smartOrder(goals, plans), goals, ...props }, attachTo: document.body })
}

describe('the Smart order window', () => {
  it('asks for a name, as a way to be more accurate, with the field right there', async () => {
    const w = mountIt({ hasPlayer: false })
    await flushPromises()
    const form = document.body.querySelector('.so-name')
    expect(form.textContent).toContain('More accurate with your name')
    expect(form.textContent).toContain('level 1')
    expect(form.querySelector('input')).not.toBeNull()
    // Nothing to look up until something is typed.
    expect(form.querySelector('button').disabled).toBe(true)
    w.unmount()
  })
  it('sends the typed name to be looked up, and shows how it went', async () => {
    const w = mountIt({ hasPlayer: false })
    await flushPromises()
    const input = document.body.querySelector('.so-name-input')
    input.value = '  Zezima '
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    document.body.querySelector('.so-name').dispatchEvent(new Event('submit'))
    await flushPromises()
    expect(w.emitted('lookup-name')).toEqual([['Zezima']])
    await w.setProps({ lookupError: 'No stats found for that player yet.' })
    expect(document.body.querySelector('.so-name-error').textContent).toContain('No stats found')
    await w.setProps({ hasPlayer: true, playerLabel: 'Zezima', lookupError: '' })
    expect(document.body.querySelector('.so-name')).toBeNull()
    expect(document.body.textContent).toContain("Now using Zezima's levels")
    w.unmount()
  })
  it('does not ask when the plan already uses a player', async () => {
    const w = mountIt({ hasPlayer: true })
    await flushPromises()
    expect(document.body.querySelector('.so-name')).toBeNull()
    w.unmount()
  })
})
