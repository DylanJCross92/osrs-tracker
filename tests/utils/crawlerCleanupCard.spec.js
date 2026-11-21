import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({ crawlerBursts: vi.fn(), deleteCrawlerBursts: vi.fn() }))
vi.mock('@/api/stats', () => ({ statsApi: api }))

import StatsCrawlerCleanup from '@/components/admin/stats/StatsCrawlerCleanup.vue'

const report = { since: '2026-11-20', min: 150, prefix: '/items/', visitors: 4500, events: 9000, minutes: [{ minute: '2026-11-21T04:26:00.000Z', visitors: 4500 }] }

beforeEach(() => {
  api.crawlerBursts.mockReset()
  api.deleteCrawlerBursts.mockReset()
})

describe('the temporary crawler cleanup card', () => {
  it('shows what it found and only deletes after the confirmation', async () => {
    api.crawlerBursts.mockResolvedValueOnce(report).mockResolvedValueOnce({ ...report, visitors: 0, events: 0, minutes: [] })
    api.deleteCrawlerBursts.mockResolvedValue({ visitors: 4500, events: 9000 })
    const w = mount(StatsCrawlerCleanup, { attachTo: document.body })
    await w.find('button').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Found 4,500 visitors')
    await w.find('.po-delete').trigger('click')
    expect(api.deleteCrawlerBursts).not.toHaveBeenCalled()
    document.body.querySelector('.modal-card .po-delete').click()
    await flushPromises()
    expect(api.deleteCrawlerBursts).toHaveBeenCalledWith('2026-11-20', 150)
    expect(w.text()).toContain('Deleted 4,500 visitors and 9,000 events.')
    expect(w.text()).toContain('Nothing to clean')
    w.unmount()
  })
  it('says so when there is nothing to clean', async () => {
    api.crawlerBursts.mockResolvedValue({ ...report, visitors: 0, events: 0, minutes: [] })
    const w = mount(StatsCrawlerCleanup)
    await w.find('button').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Nothing to clean since 2026-11-20')
    expect(w.find('.po-delete').exists()).toBe(false)
  })
})
