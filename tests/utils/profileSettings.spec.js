import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const claims = vi.fn()
vi.mock('@/api/claims', () => ({ claimsApi: { mine: (...a) => claims(...a) } }))
vi.mock('@/utils/analytics', () => ({ track: vi.fn() }))

const PREFS = 'tickgains-planner-prefs-v1'
const prefs = () => JSON.parse(localStorage.getItem(PREFS) || '{}')

const player = (displayName) => ({ username: displayName.toLowerCase(), displayName })
const verified = (id, displayName) => ({ id, status: 'verified', player: player(displayName) })

// The preference modules keep their state at module level, so every test starts from fresh ones.
async function load(me = '') {
  vi.resetModules()
  localStorage.clear()
  if (me) localStorage.setItem('tickgains:me', JSON.stringify(me))
  const util = await import('@/utils/profilePrefs')
  const mod = await import('@/composables/useProfileSettings')
  const type = await import('@/composables/useAccountType')
  return { util, mod, type }
}

describe('profile settings', () => {
  beforeEach(() => claims.mockReset())

  it('keeps each profile apart, falling back to the plain preferences for what was not saved', async () => {
    const { util, mod } = await load('Main One')
    util.saveProfileEntry('Alt Iron', { iron: true, members: false })
    const { settingsOf } = mod
    expect(settingsOf('alt iron')).toEqual({ members: false, iron: true, build: 'main', ironKind: 'standard', hours: 2 })
    expect(settingsOf('Main One')).toEqual({ members: true, iron: false, build: 'main', ironKind: 'standard', hours: 2 })
    expect(prefs().profiles['alt iron']).toEqual({ iron: true, members: false })
  })

  it("changing the main profile's settings changes what every planner starts from, and the other way round", async () => {
    const { mod, type, util } = await load('Main One')
    const s = mod.useProfileSettings()
    s.seed([player('Main One'), player('Alt Iron')])
    s.set('Main One', { iron: true, hours: 4 })
    expect(type.ironPref()).toBe(true)
    expect(prefs().iron).toBe(true)
    expect(prefs().hours).toBe(4)
    // A switch in a planner is a choice for the main profile too.
    type.useAccountType().setMembersPref(false)
    expect(util.profileEntry('Main One').members).toBe(false)
    // The alt was not touched by any of it.
    expect(util.profileEntry('Alt Iron')).toEqual({ members: true, iron: false, build: 'main', ironKind: 'standard', hours: 2 })
  })

  it("changing another profile's settings leaves the plain preferences alone", async () => {
    const { mod, type } = await load('Main One')
    const s = mod.useProfileSettings()
    s.seed([player('Main One'), player('Alt Iron')])
    s.set('Alt Iron', { iron: true, members: false, hours: 6 })
    expect(type.ironPref()).toBe(false)
    expect(prefs().hours ?? 2).toBe(2)
    expect(mod.settingsOf('Alt Iron')).toEqual({ members: false, iron: true, build: 'main', ironKind: 'standard', hours: 6 })
  })

  it('does not grow a profile for a visitor: a planner switch with no saved main profile only changes the plain preferences', async () => {
    const { type } = await load('')
    type.useAccountType().setIronPref(true)
    expect(prefs().iron).toBe(true)
    expect(prefs().profiles).toBeUndefined()
  })

  it('an account page lists the profiles with their settings and saves a change for just that one', async () => {
    claims.mockResolvedValue({ contact: 'Someone', claims: [verified(1, 'Main One'), verified(2, 'Alt Iron'), { id: 3, status: 'pending', expired: false, code: 'ABC123', player: player('Third') }] })
    const { util } = await load('Main One')
    const { default: AccountProfiles } = await import('@/components/account/AccountProfiles.vue')
    const w = mount(AccountProfiles, { global: { stubs: { RouterLink: { props: ['to'], template: '<a><slot /></a>' }, PlayerAvatar: true } } })
    await flushPromises()
    const items = w.findAll('.acp-item')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('Main profile')
    expect(items[1].text()).toContain('Make main')
    expect(w.text()).toContain('ABC123')
    // Ironman on the second profile.
    const ironBtn = items[1].findAll('button').find((b) => b.text().includes('Ironman'))
    await ironBtn.trigger('click')
    expect(util.profileEntry('Alt Iron').iron).toBe(true)
    expect(util.profileEntry('Main One').iron).toBe(false)
    // Hours go up by half an hour.
    await items[1].find('button[aria-label="Half an hour more"]').trigger('click')
    expect(util.profileEntry('Alt Iron').hours).toBe(2.5)
  })

  it('making a profile the main one makes its settings what everything starts from', async () => {
    claims.mockResolvedValue({ contact: 'x', claims: [verified(1, 'Main One'), verified(2, 'Alt Iron')] })
    const { util, type } = await load('Main One')
    const { default: AccountProfiles } = await import('@/components/account/AccountProfiles.vue')
    const w = mount(AccountProfiles, { global: { stubs: { RouterLink: { props: ['to'], template: '<a><slot /></a>' }, PlayerAvatar: true } } })
    await flushPromises()
    util.saveProfileEntry('Alt Iron', { iron: true, members: false, hours: 5 })
    await w.findAll('.acp-item')[1].find('button.acp-makemain').trigger('click')
    await flushPromises()
    // The profile that stopped being the main one keeps its own settings.
    expect(util.profileEntry('Main One')).toEqual({ members: true, iron: false, build: 'main', ironKind: 'standard', hours: 2 })
    expect(JSON.parse(localStorage.getItem('tickgains:me'))).toBe('Alt Iron')
    expect(type.ironPref()).toBe(true)
    expect(prefs().hours).toBe(5)
  })
})

describe('profile settings: builds', () => {
  it('keeps a build and an ironman kind for a profile, and cleans anything else to the plain account', async () => {
    const util = await import('@/utils/profilePrefs')
    util.saveProfileEntry('Skiller Alt', { build: 'skiller', iron: true, ironKind: 'hardcore' })
    expect(util.profileEntry('Skiller Alt')).toMatchObject({ build: 'skiller', iron: true, ironKind: 'hardcore' })
    util.saveProfileEntry('Odd Alt', { build: 'wizard', ironKind: 'zzz' })
    expect(util.profileEntry('Odd Alt')).toMatchObject({ build: 'main', ironKind: 'standard' })
  })
})
