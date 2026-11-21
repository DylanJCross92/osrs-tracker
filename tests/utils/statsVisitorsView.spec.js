import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const deleteVisitor = vi.hoisted(() => vi.fn(async () => ({ events: 3 })))
vi.mock('@/api/stats', () => ({
  statsApi: {
    deleteVisitor,
    visitors: vi.fn(async () => ({
      days: 30,
      visitors: [
        { key: 'a:9', kind: 'account', label: 'me@example.com', players: 'Zezima', events: 12, pages: 7, first: '2026-11-17T10:00:00Z', last: new Date().toISOString() },
        { key: `v:${'ab'.repeat(16)}`, kind: 'visitor', label: 'Visitor ababab', players: '', events: 3, pages: 3, first: '2026-11-18T10:00:00Z', last: '2026-11-18T10:05:00Z' },
      ],
    })),
    journey: vi.fn(async (key) => ({
      key,
      kind: key.startsWith('v:') ? 'visitor' : 'account',
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
            { at: '2026-11-18T10:05:00Z', name: 'plan_share', props: { method: 'copy_link' } },
            { at: '2026-11-18T10:02:00Z', name: 'search_started', props: {} },
            { at: '2026-11-18T10:00:00Z', name: 'spa_page_view', props: { page_path: '/' } },
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
    expect(steps[0]).toContain('Plan share')
    expect(steps[0]).toContain('method: copy_link')
    expect(steps[1]).toContain('Search started')
    expect(steps[2]).toContain('Viewed')
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

  it('deletes one browser visitor after asking, and never offers it for an account', async () => {
    const w = mount(StatsVisitors, { props: { days: 30 }, global: { stubs: { StatChart: true } }, attachTo: document.body })
    await flushPromises()
    // The first (signed-in account) has no delete button.
    expect(w.find('.vz-delete').exists()).toBe(false)
    await w.findAll('.vz-person')[1].trigger('click')
    await flushPromises()
    await w.find('.vz-delete').trigger('click')
    expect(deleteVisitor).not.toHaveBeenCalled()
    expect(document.body.querySelector('.modal-card').textContent).toContain('Delete this visitor?')
    document.body.querySelector('.modal-card .po-delete').click()
    await flushPromises()
    expect(deleteVisitor).toHaveBeenCalledWith(`v:${'ab'.repeat(16)}`)
    w.unmount()
  })
})
