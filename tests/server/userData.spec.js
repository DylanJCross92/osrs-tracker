import { describe, it, expect } from 'vitest'
import { sanitizeUserData, MAX_PLANS, MAX_SET, MAX_WATCH } from '../../server/src/utils/userData.js'

const T = '2026-11-10T12:00:00.000Z'

describe('sanitizeUserData', () => {
  it('keeps valid plans, newest first, and drops bad ones', () => {
    const out = sanitizeUserData({
      plans: { value: [{ id: 'p_1', name: 'Old', updatedAt: '2026-01-01T00:00:00Z', goals: [] }, { id: 'p_2', name: 'New', updatedAt: T, goals: [] }, { id: 'bad id!', name: 'x' }, { name: 'no id' }, 'junk'], updatedAt: T },
    })
    expect(out.plans.value.map((p) => p.id)).toEqual(['p_2', 'p_1'])
    expect(out.plans.updatedAt).toBe(T)
  })
  it('caps plan count and plan size', () => {
    const many = Array.from({ length: MAX_PLANS + 10 }, (_, i) => ({ id: `p_${i}`, name: 'n', updatedAt: T, goals: [] }))
    expect(sanitizeUserData({ plans: { value: many, updatedAt: T } }).plans.value).toHaveLength(MAX_PLANS)
    const huge = [{ id: 'p_big', name: 'big', updatedAt: T, blob: 'x'.repeat(30_000) }]
    expect(sanitizeUserData({ plans: { value: huge, updatedAt: T } }).plans.value).toEqual([])
  })
  it('only accepts a planner state with goals and a sane size', () => {
    expect(sanitizeUserData({ planner: { value: { goals: [], hoursPerDay: 2 }, updatedAt: T } }).planner.value.hoursPerDay).toBe(2)
    expect(sanitizeUserData({ planner: { value: { nope: 1 }, updatedAt: T } }).planner).toBeUndefined()
    expect(sanitizeUserData({ planner: { value: { goals: [], blob: 'x'.repeat(70_000) }, updatedAt: T } }).planner).toBeUndefined()
  })
  it('cleans recents and sets', () => {
    const out = sanitizeUserData({
      recents: { value: [{ username: 'sedz', displayName: 'sedz' }, { username: 'SEDZ' }, { username: 'bad<name>' }], updatedAt: T },
      cheered: { value: ['a:b', 'a:b', '', 5, 'x'.repeat(100)], updatedAt: T },
      dismissed: { value: Array.from({ length: MAX_SET + 20 }, (_, i) => `k${i}`), updatedAt: T },
    })
    expect(out.recents.value).toEqual([{ username: 'sedz', displayName: 'sedz' }])
    expect(out.cheered.value).toEqual(['a:b'])
    expect(out.dismissed.value).toHaveLength(MAX_SET)
  })
  it('ignores unknown keys and junk input', () => {
    expect(sanitizeUserData({ evil: { value: 1 }, plans: 'x' })).toEqual({})
    for (const bad of [null, undefined, 5, 'x', []]) expect(sanitizeUserData(bad)).toEqual({})
  })
  it('keeps requirement answers with valid ids and values only', () => {
    const out = sanitizeUserData({
      requirements: { value: { 'quest:monkey-madness-ii': 'have', 'equipment:toxic-blowpipe': 'missing', 'unlock:ancient-magicks': 'unknown', 'quest:x': 'maybe', 'BAD ID': 'have', 'quest:y': 7 }, updatedAt: T },
    })
    expect(out.requirements.value).toEqual({ 'quest:monkey-madness-ii': 'have', 'equipment:toxic-blowpipe': 'missing', 'unlock:ancient-magicks': 'unknown' })
    expect(sanitizeUserData({ requirements: { value: ['x'], updatedAt: T } })).toEqual({})
  })
})

describe('watched items', () => {
  it('keeps item addresses in order without repeats, and drops anything else', () => {
    const out = sanitizeUserData({ watch: { value: ['dragon-bones', 'law-rune', 'dragon-bones', 'Bad Name', '', 5, 'ring-of-dueling-8'], updatedAt: T } })
    expect(out.watch.value).toEqual(['dragon-bones', 'law-rune', 'ring-of-dueling-8'])
  })
  it('caps the list and ignores a value that is not a list', () => {
    const many = Array.from({ length: MAX_WATCH + 20 }, (_, i) => `item-${i}`)
    expect(sanitizeUserData({ watch: { value: many, updatedAt: T } }).watch.value).toHaveLength(MAX_WATCH)
    expect(sanitizeUserData({ watch: { value: 'dragon-bones', updatedAt: T } }).watch).toBeUndefined()
  })
})

describe('planner profile (the Smart Planner answers)', () => {
  it('keeps the known choices and drops anything else', () => {
    const out = sanitizeUserData({ plannerProfile: { value: { members: false, goal: 'money', hours: 3.2, gp: 'rich', experience: 'veteran', iron: true, evil: '<script>', goalx: 1 }, updatedAt: '2026-01-01T00:00:00Z' } })
    expect(out.plannerProfile.value).toEqual({ members: false, goal: 'money', hours: 3, gp: 'rich', experience: 'veteran', iron: true })
  })
  it('ignores an unknown choice and a value that is not an object', () => {
    expect(sanitizeUserData({ plannerProfile: { value: { goal: 'nope', gp: 'lots', experience: 'god', hours: 99 } } }).plannerProfile.value).toEqual({ hours: 12 })
    expect(sanitizeUserData({ plannerProfile: { value: { goal: 'afk' } } }).plannerProfile.value.goal).toBe('afk')
    expect(sanitizeUserData({ plannerProfile: { value: { goal: 'hardcore' } } }).plannerProfile.value.goal).toBe('hardcore')
    expect(sanitizeUserData({ plannerProfile: { value: 'x' } }).plannerProfile).toBeUndefined()
    expect(sanitizeUserData({ plannerProfile: { value: [1] } }).plannerProfile).toBeUndefined()
  })
})

describe('planner preferences (hours a day)', () => {
  it('keeps the hours on a half hour step between 0.5 and 24', () => {
    expect(sanitizeUserData({ plannerPrefs: { value: { hours: 3.2 }, updatedAt: '2026-01-01T00:00:00Z' } }).plannerPrefs.value).toEqual({ hours: 3 })
    expect(sanitizeUserData({ plannerPrefs: { value: { hours: 99 } } }).plannerPrefs.value).toEqual({ hours: 24 })
    expect(sanitizeUserData({ plannerPrefs: { value: { hours: 0 } } }).plannerPrefs.value).toEqual({ hours: 0.5 })
  })
  it('drops anything else and a value that is not an object', () => {
    expect(sanitizeUserData({ plannerPrefs: { value: { hours: 'lots', evil: '<script>' } } }).plannerPrefs.value).toEqual({})
    expect(sanitizeUserData({ plannerPrefs: { value: 4 } }).plannerPrefs).toBeUndefined()
    expect(sanitizeUserData({ plannerPrefs: { value: [4] } }).plannerPrefs).toBeUndefined()
  })
})
