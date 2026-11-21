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

const mountIt = (props = {}, slots = {}) => {
  // Without a wait, the window shows its short "reading" beat first; skip it by asking for reduced motion.
  window.matchMedia = () => ({ matches: true })
  return mount(SmartOrderModal, { props: { suggestion: smartOrder(goals, plans), goals, ...props }, slots, attachTo: document.body })
}

describe('the Smart order window', () => {
  it('shows the slot (the planner\'s own player box) with a note that a name makes it more accurate, when the plan has no player', async () => {
    const w = mountIt({ hasPlayer: false }, { 'name-box': '<div class="the-box">player box</div>' })
    await flushPromises()
    const note = document.body.querySelector('.so-name')
    expect(note.textContent).toContain('More accurate with your name')
    expect(note.textContent).toContain('level 1')
    expect(note.querySelector('.the-box')).not.toBeNull()
    w.unmount()
  })
  it('says the order now uses the player\'s levels once one is loaded', async () => {
    const w = mountIt({ hasPlayer: false }, { 'name-box': '<div class="the-box" />' })
    await flushPromises()
    await w.setProps({ hasPlayer: true, playerLabel: 'Zezima' })
    expect(document.body.querySelector('.so-name')).toBeNull()
    expect(document.body.textContent).toContain("Now using Zezima's levels")
    w.unmount()
  })
  it('does not ask when the plan already uses a player', async () => {
    const w = mountIt({ hasPlayer: true })
    await flushPromises()
    expect(document.body.querySelector('.so-name')).toBeNull()
    expect(document.body.textContent).not.toContain("Now using")
    w.unmount()
  })
})
