import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const prices = vi.fn()
const track = vi.fn()
vi.mock('@/api/ge', () => ({ geApi: { prices: (...a) => prices(...a) } }))
vi.mock('@/utils/analytics', () => ({ track: (...a) => track(...a) }))

import HomePreview from '@/components/home/HomePreview.vue'

const stubs = {
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  PlayerAvatar: true,
  PlayerBadge: true,
  XpLineChart: true,
  PageSkeleton: true,
}
const example = {
  username: 'zezima', displayName: 'Zezima', badge: null, claimed: false, overallLevel: 2277, overallXp: 5_000_000_000, weekXp: 1_200_000,
  recentSkills: [{ skill: 'Mining', xp: 900_000 }],
}
const mountIt = (props = {}) => mount(HomePreview, { props: { example, chartPoints: [{ x: 1, y: 1 }, { x: 2, y: 2 }], ...props }, global: { stubs } })

beforeEach(() => {
  prices.mockReset().mockResolvedValue({ prices: {} })
  track.mockReset()
})

describe('the welcome page product preview', () => {
  it('starts on XP tracking with a profile and a way into it', () => {
    const w = mountIt()
    const tabs = w.findAll('[role="tab"]')
    expect(tabs.map((t) => t.text())).toEqual(['XP Tracking', 'Account Planner', 'GE Prices'])
    expect(tabs[0].attributes('aria-selected')).toBe('true')
    expect(w.text()).toContain('Zezima')
    expect(w.text()).toContain('Open this profile')
  })
  it('shows a plan from the planner on the Account Planner tab, and says which tab was opened', async () => {
    const w = mountIt()
    await w.findAll('[role="tab"]')[1].trigger('click')
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))
    await flushPromises()
    expect(w.findAll('[role="tab"]')[1].attributes('aria-selected')).toBe('true')
    expect(w.findAll('.hp-plan-rows li').length).toBeGreaterThanOrEqual(3)
    expect(w.text()).toContain('Build your plan')
    expect(track).toHaveBeenCalledWith('home_preview_tab', { tab: 'planner' })
  })
  it('moves between the tabs with the arrow keys', async () => {
    const w = mountIt()
    await w.find('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' })
    expect(w.findAll('[role="tab"]')[1].attributes('aria-selected')).toBe('true')
    await w.find('[role="tablist"]').trigger('keydown', { key: 'ArrowLeft' })
    await w.find('[role="tablist"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(w.findAll('[role="tab"]')[2].attributes('aria-selected')).toBe('true')
  })
  it('loads the live prices up front, so the GE tab is ready when opened', async () => {
    prices.mockResolvedValue({ prices: { shark: [717, 701, 'shark', null], 'dragon bones': [3730, 3640, 'dragon-bones', null], 'nature rune': [168, 167, 'nature-rune', null] } })
    const w = mountIt()
    await flushPromises()
    expect(prices).toHaveBeenCalledTimes(1)
    expect(w.find('.hp-prices').attributes('style') || '').toContain('display: none')
    await w.findAll('[role="tab"]')[2].trigger('click')
    expect(w.find('.hp-prices').attributes('style') || '').not.toContain('display: none')
    expect(w.findAll('.hp-ge-items li')).toHaveLength(3)
  })
  it('explains itself when no example profile exists yet', () => {
    const w = mountIt({ example: null })
    expect(w.text()).toContain('Track a player above')
  })
})
