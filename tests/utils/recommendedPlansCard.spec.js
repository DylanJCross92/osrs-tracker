import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RecommendedPlans from '@/components/planner/RecommendedPlans.vue'
import { resetPrices, setPrices } from '@/utils/priceBook'

beforeEach(() => resetPrices())

const mountCards = () => mount(RecommendedPlans, { props: { featured: true, quiet: true, hasPlayer: false } })

describe('the recommended plan cards', () => {
  it('show the time and the gp figure of each plan', () => {
    const w = mountCards()
    const cards = w.findAll('.rp-card')
    expect(cards.length).toBeGreaterThanOrEqual(1)
    for (const c of cards) {
      expect(c.text()).toContain('Goals')
      expect(c.text()).toContain('Time')
      expect(c.text()).toMatch(/GP cost|Profit/)
    }
  })
  it('mark the gp figure as live only once the Grand Exchange prices have loaded', async () => {
    const w = mountCards()
    expect(w.find('.rp-live').exists()).toBe(false)
    setPrices({ 'dragon bones': [3700, 3600, 'dragon-bones'] }, { updatedAt: new Date().toISOString(), stale: false })
    await w.vm.$nextTick()
    expect(w.find('.rp-live').exists()).toBe(true)
    setPrices({ 'dragon bones': [3700, 3600, 'dragon-bones'] }, { updatedAt: '2026-01-01T00:00:00Z', stale: true })
    await w.vm.$nextTick()
    expect(w.find('.rp-live').exists()).toBe(false)
  })
})
