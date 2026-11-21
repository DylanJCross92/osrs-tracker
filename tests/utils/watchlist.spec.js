import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'

const watchApi = vi.fn()
const sparkApi = vi.fn()
const showToast = vi.fn()
vi.mock('@/api/ge', () => ({ geApi: { watch: (...a) => watchApi(...a), spark: (...a) => sparkApi(...a) } }))
vi.mock('@/utils/analytics', () => ({ track: vi.fn() }))
vi.mock('@/composables/useAuth', () => ({ useAuth: () => ({ loggedIn: ref(false) }) }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ showToast }) }))
vi.mock('@/composables/useItemModal', () => ({ onItemLinkClick: vi.fn() }))

import { MAX_WATCH, reloadWatchlist, useWatchlist } from '@/composables/useWatchlist'
import { KEYS } from '@/utils/accountData'
import WatchButton from '@/components/WatchButton.vue'
import DashWatchlist from '@/components/dashboard/DashWatchlist.vue'

const stubs = { RouterLink: { props: ['to'], template: '<a><slot /></a>' } }
const stored = () => JSON.parse(localStorage.getItem(KEYS.watch) || '[]')

beforeEach(() => {
  localStorage.clear()
  reloadWatchlist()
  watchApi.mockReset()
  sparkApi.mockReset().mockResolvedValue({ spark: {} })
  showToast.mockReset()
})

describe('the watchlist', () => {
  it('adds and removes items, keeps them in this browser, and in the order they were added', () => {
    const { toggle, isWatching, slugs } = useWatchlist()
    expect(toggle('dragon-bones')).toBe(true)
    expect(toggle('law-rune')).toBe(true)
    expect(slugs.value).toEqual(['dragon-bones', 'law-rune'])
    expect(stored()).toEqual(['dragon-bones', 'law-rune'])
    expect(toggle('dragon-bones')).toBe(false)
    expect(isWatching('dragon-bones')).toBe(false)
    expect(stored()).toEqual(['law-rune'])
  })
  it('stops at the limit', () => {
    const { toggle, slugs } = useWatchlist()
    for (let i = 0; i < MAX_WATCH; i++) toggle(`item-${i}`)
    expect(slugs.value).toHaveLength(MAX_WATCH)
    expect(toggle('one-more')).toBe(false)
    expect(slugs.value).toHaveLength(MAX_WATCH)
  })
  it('the watch button toggles an item and says so', async () => {
    const w = mount(WatchButton, { props: { slug: 'shark', name: 'Shark' } })
    expect(w.text()).toContain('Watch')
    expect(w.attributes('aria-pressed')).toBe('false')
    await w.trigger('click')
    expect(w.text()).toContain('Watching')
    expect(w.attributes('aria-pressed')).toBe('true')
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Watching Shark'))
    await w.trigger('click')
    expect(showToast).toHaveBeenLastCalledWith('Stopped watching Shark')
  })
})

describe('the dashboard card', () => {
  it('asks you to watch something when the list is empty, without loading prices', async () => {
    const w = mount(DashWatchlist, { global: { stubs } })
    await flushPromises()
    expect(w.text()).toContain('Watch Grand Exchange items')
    expect(watchApi).not.toHaveBeenCalled()
  })
  it('lists watched items newest first with their prices, and stopping removes one', async () => {
    localStorage.setItem(KEYS.watch, JSON.stringify(['law-rune', 'dragon-bones']))
    reloadWatchlist()
    watchApi.mockResolvedValue({
      items: [
        [1, 'Dragon bones', 'dragon-bones', 1, 3700, 3690, 1000, 7500, -1, -5.5, 12.5, -64, null],
        [2, 'Law rune', 'law-rune', 0, 120, 116, 5000, 10000, -0.6, -1.3, 2, 0, null],
      ],
    })
    const w = mount(DashWatchlist, { global: { stubs } })
    await flushPromises()
    expect(watchApi).toHaveBeenCalledWith(['dragon-bones', 'law-rune'])
    const names = w.findAll('.wl-name b').map((b) => b.text())
    expect(names).toEqual(['Dragon bones', 'Law rune'])
    expect(w.text()).toContain('3,695')
    // One request for every watched item's small graph, drawn only for the ones that came back with a history.
    expect(sparkApi).toHaveBeenCalledWith(['dragon-bones', 'law-rune'])
    await w.find('.wl-x').trigger('click')
    expect(stored()).toEqual(['law-rune'])
  })
})
