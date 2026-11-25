import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

vi.mock('@/utils/analytics', () => ({ track: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }), useRouter: () => ({ replace: vi.fn() }) }))

// The preference modules keep their state at module level, so each test starts from fresh ones.
async function load(members) {
  vi.resetModules()
  localStorage.clear()
  if (members === false) localStorage.setItem('tickgains-planner-prefs-v1', JSON.stringify({ members: false }))
  const { default: TrackerPanel } = await import('@/components/tracker/TrackerPanel.vue')
  const type = await import('@/composables/useAccountType')
  const w = mount(TrackerPanel, {
    props: { tab: 'quests' },
    global: { stubs: { TrackerSuggest: true, QuestsTab: { name: 'QuestsTab', template: '<div class="quests-real" />' }, DiariesTab: { template: '<div class="diaries-real" />' }, TrackerRing: { props: ['label'], template: '<i class="ring">{{ label }}</i>' }, RouterLink: { template: '<a><slot /></a>' } } },
  })
  return { w, type }
}

describe('the quest and diary tracker follows free-to-play or members', () => {
  beforeEach(() => localStorage.clear())

  it('a members account sees every quest and the diaries', async () => {
    const { w } = await load(true)
    expect(w.findAll('.ring').map((r) => r.text())).toEqual(['Quests', 'Quest points', 'Diary tiers'])
    expect(w.find('.quests-real').exists()).toBe(true)
    expect(w.text()).not.toContain('Achievement diaries are for members')
  })

  it('a free-to-play account sees the free quests, and a note where the diaries would be', async () => {
    const { w } = await load(false)
    expect(w.findAll('.ring').map((r) => r.text())).toEqual(['Free quests'])
    await w.setProps({ tab: 'diaries' })
    expect(w.text()).toContain('Achievement diaries are for members')
    expect(w.find('.diaries-real').exists()).toBe(false)
    // The note's button switches to members, the same choice as everywhere else.
    await w.find('.trk-members-only button').trigger('click')
    await nextTick()
    expect(w.find('.trk-members-only').exists()).toBe(false)
    expect(JSON.parse(localStorage.getItem('tickgains-planner-prefs-v1')).members).toBe(true)
  })

  it('changing membership elsewhere (the account settings) changes the tracker at once', async () => {
    const { w, type } = await load(true)
    expect(w.findAll('.ring')).toHaveLength(3)
    type.useAccountType().setMembersPref(false)
    await nextTick()
    expect(w.findAll('.ring').map((r) => r.text())).toEqual(['Free quests'])
  })
})
