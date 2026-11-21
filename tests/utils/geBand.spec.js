import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const prices = vi.fn()
vi.mock('@/api/ge', () => ({ geApi: { prices: (...a) => prices(...a) } }))
vi.mock('@/utils/analytics', () => ({ track: vi.fn() }))

import GeBand from '@/components/home/GeBand.vue'

const stubs = { RouterLink: { props: ['to'], template: '<a><slot /></a>' } }

beforeEach(() => prices.mockReset())

describe('the welcome page Grand Exchange band', () => {
  it('shows live prices for the items it can price, and says the planners use them', async () => {
    prices.mockResolvedValue({
      updatedAt: new Date().toISOString(),
      prices: {
        'dragon bones': [3730, 3640, 'dragon-bones', null],
        shark: [717, 701, 'shark', null],
        'nature rune': [168, 167, 'nature-rune', null],
      },
    })
    const w = mount(GeBand, { global: { stubs } })
    await flushPromises()
    expect(w.text()).toContain('planners and calculators')
    const items = w.findAll('.geb-items li').map((li) => li.text())
    expect(items).toHaveLength(3)
    expect(items[0]).toContain('Dragon bones')
    expect(items[0]).toContain('3,685')
  })
  it('stays hidden when the prices cannot be loaded or there are too few', async () => {
    prices.mockRejectedValue(new Error('down'))
    const w = mount(GeBand, { global: { stubs } })
    await flushPromises()
    expect(w.find('.geb').exists()).toBe(false)
    prices.mockResolvedValue({ prices: { shark: [717, 701, 'shark', null] } })
    const w2 = mount(GeBand, { global: { stubs } })
    await flushPromises()
    expect(w2.find('.geb').exists()).toBe(false)
  })
})
