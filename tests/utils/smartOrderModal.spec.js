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
  it('asks for a name, as a way to be more accurate, when the plan has no player', async () => {
    const w = mountIt({ hasPlayer: false })
    await flushPromises()
    const note = document.body.querySelector('.so-name')
    expect(note.textContent).toContain('More accurate with your name')
    expect(note.textContent).toContain('level 1')
    note.querySelector('button').click()
    expect(w.emitted('add-name')).toHaveLength(1)
    w.unmount()
  })
  it('does not ask when the plan already uses a player', async () => {
    const w = mountIt({ hasPlayer: true })
    await flushPromises()
    expect(document.body.querySelector('.so-name')).toBeNull()
    w.unmount()
  })
})
