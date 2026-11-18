import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('@/api/stats', () => ({
  statsApi: {
    visitors: vi.fn(async () => ({
      days: 30,
      visitors: [
        { key: 'a:9', kind: 'account', label: 'me@example.com', players: 'Zezima', events: 12, pages: 7, first: '2026-11-17T10:00:00Z', last: new Date().toISOString() },
        { key: `v:${'ab'.repeat(16)}`, kind: 'visitor', label: 'Visitor ababab', players: '', events: 3, pages: 3, first: '2026-11-18T10:00:00Z', last: '2026-11-18T10:05:00Z' },
      ],
    })),
    journey: vi.fn(async (key) => ({
      key,
      kind: 'account',
      label: 'me@example.com',
      players: 'Zezima',
      days: 30,
      count: 3,
      pages: 2,
      first: '2026-11-18T10:00:00Z',
      last: '2026-11-18T10:05:00Z',
      daily: [{ day: '2026-11-17', n: 0 }, { day: '2026-11-18', n: 3 }],
      sessions: [
        {
          start: '2026-11-18T10:00:00Z',
          end: '2026-11-18T10:05:00Z',
          events: [
            { at: '2026-11-18T10:00:00Z', name: 'spa_page_view', props: { page_path: '/' } },
            { at: '2026-11-18T10:02:00Z', name: 'search_started', props: {} },
            { at: '2026-11-18T10:05:00Z', name: 'plan_share', props: { method: 'copy_link' } },
          ],
        },
      ],
    })),
  },
}))

import StatsVisitors from '@/components/admin/stats/StatsVisitors.vue'

describe('Visitors tab', () => {
  it('lists people, and shows one person\'s steps in order when picked', async () => {
    const w = mount(StatsVisitors, { props: { days: 30 }, global: { stubs: { StatChart: true } } })
    await flushPromises()
    const rows = w.findAll('.vz-person')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('me@example.com')
    expect(rows[0].text()).toContain('Zezima')
    expect(rows[1].text()).toContain('Visitor ababab')
    // The most recent visitor is open without a click.
    expect(rows[0].classes()).toContain('on')
    const steps = w.findAll('.vz-steps li').map((li) => li.text())
    expect(steps).toHaveLength(3)
    expect(steps[0]).toContain('Viewed')
    expect(steps[0]).toContain('/')
    expect(steps[1]).toContain('Search started')
    expect(steps[2]).toContain('Plan share')
    expect(steps[2]).toContain('method: copy_link')
    expect(w.text()).toContain('Signed-in account')
  })

  it('has no notice under the list', async () => {
    const w = mount(StatsVisitors, { props: { days: 30 }, global: { stubs: { StatChart: true } } })
    await flushPromises()
    expect(w.find('.vz-list .st-note').exists()).toBe(false)
  })

  it('filters the list', async () => {
    const w = mount(StatsVisitors, { props: { days: 30 }, global: { stubs: { StatChart: true } } })
    await flushPromises()
    await w.find('input[type=search]').setValue('zezima')
    expect(w.findAll('.vz-person')).toHaveLength(1)
  })
})
