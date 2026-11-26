import { describe, expect, it } from 'vitest'
import { accountNote, parsePlanLink, planLinkText } from '../../server/src/utils/planLink.js'

// level 34 = 20,224 XP, level 99 = 13,034,431 XP
const cooking = { h: '7', g: 'Cooking~20224~13034431~global~~~' }

describe('parsePlanLink', () => {
  it('reads the goals, levels and XP to go from the address', () => {
    const p = parsePlanLink(cooking)
    expect(p.goals).toEqual([{ skill: 'Cooking', fromLevel: 34, toLevel: 99, xp: 13034431 - 20224 }])
    expect(p.hoursPerDay).toBe(7)
    expect(p.hours).toBeNull()
  })
  it('keeps the totals a share link carries and the kind of account', () => {
    const p = parsePlanLink({ ...cooking, sh: '412.46', sd: '59', sg: '-3200000', u: 'Zezima', hw: '1', bd: 'zerker' })
    expect(p).toMatchObject({ who: 'Zezima', hours: 412.46, days: 59, netGp: -3200000 })
    expect(p.account).toMatchObject({ hardcoreWorlds: true, build: 'zerker' })
  })
  it('ignores junk: unknown skills, goals that go nowhere, odd names and numbers', () => {
    expect(parsePlanLink({ g: 'Nothing~0~100~global' })).toBeNull()
    expect(parsePlanLink({ g: 'Cooking~500~500~global' })).toBeNull()
    expect(parsePlanLink({})).toBeNull()
    expect(parsePlanLink({ ...cooking, u: '<script>', sh: 'x', zz: '1' })).toMatchObject({ who: '', hours: null })
  })
  it('never combines ironman with Hardcore Worlds', () => {
    expect(parsePlanLink({ ...cooking, i: '1', hw: '1' }).account.hardcoreWorlds).toBe(false)
  })
})

describe('planLinkText', () => {
  it('names a single skill plan with its levels and, when known, the time', () => {
    const t = planLinkText(parsePlanLink({ ...cooking, sh: '412.46', sd: '59', sg: '-3200000' }))
    expect(t.title).toBe('Cooking 34 to 99 training plan, 412 hours | TickGains')
    expect(t.description).toContain('Cooking from level 34 to 99: 13M XP to go')
    expect(t.description).toContain('about 412 hours of training, 59 days at 7 hours a day')
    expect(t.description).toContain('costs about 3.2M gp')
  })
  it('works from the levels alone when the link has no totals', () => {
    const t = planLinkText(parsePlanLink(cooking))
    expect(t.title).toBe('Cooking 34 to 99 training plan | TickGains')
    expect(t.description).not.toMatch(/hours of training/)
  })
  it('lists several skills, says who it is for and the kind of account', () => {
    const t = planLinkText(parsePlanLink({ g: 'Cooking~0~13034431~g,Fishing~0~13034431~g,Mining~0~13034431~g,Smithing~0~13034431~g', u: 'Zezima', i: '1', ik: 'hardcore' }))
    expect(t.title).toBe("Zezima's Cooking, Fishing, Mining and 1 more to 99 training plan | TickGains")
    expect(t.description).toMatch(/^Zezima's hardcore ironman Old School RuneScape training plan/)
  })
  it('describes the account kind', () => {
    expect(accountNote({ freeToPlay: true, iron: false, ironKind: 'standard', build: 'skiller', hardcoreWorlds: false })).toBe('free-to-play level 3 skiller')
    expect(accountNote({ freeToPlay: false, iron: false, ironKind: 'standard', build: 'main', hardcoreWorlds: false })).toBe('')
  })
})
