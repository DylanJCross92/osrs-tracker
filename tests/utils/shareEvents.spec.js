import { describe, it, expect } from 'vitest'
import { claimVisit, referrerSource, shareFromEvent, sharedLinkKind } from '@/utils/shareEvents'

describe('shareFromEvent', () => {
  it('groups share buttons into links, images and posts', () => {
    expect(shareFromEvent('record_share', { method: 'copy_link' })).toEqual({ kind: 'record', method: 'link' })
    expect(shareFromEvent('goal_share', { method: 'copy_image' })).toEqual({ kind: 'goal', method: 'image' })
    expect(shareFromEvent('challenge_share', { method: 'download' })).toEqual({ kind: 'challenge', method: 'image' })
    expect(shareFromEvent('challenge_share', { method: 'x' })).toEqual({ kind: 'challenge', method: 'social' })
    expect(shareFromEvent('plan_share', { method: 'native' })).toEqual({ kind: 'plan', method: 'social' })
    expect(shareFromEvent('share_card', { method: 'live' })).toEqual({ kind: 'weekly_card', method: 'link' })
    expect(shareFromEvent('share_card', { method: 'download' })).toEqual({ kind: 'weekly_card', method: 'image' })
    expect(shareFromEvent('clan_share', { method: 'copy_link' })).toEqual({ kind: 'clan', method: 'link' })
    expect(shareFromEvent('clan_share', { method: 'copy_image' })).toEqual({ kind: 'clan', method: 'image' })
  })
  it('counts copied calculator, compare and plan links', () => {
    expect(shareFromEvent('calc_share', { skill: 'Mining' })).toEqual({ kind: 'calculator', method: 'link' })
    expect(shareFromEvent('compare_share_copy')).toEqual({ kind: 'compare', method: 'link' })
    expect(shareFromEvent('shared_plan_link_copied')).toEqual({ kind: 'plan', method: 'link' })
  })
  it('ignores everything that is not a share', () => {
    expect(shareFromEvent('profile_view')).toBeNull()
    expect(shareFromEvent('record_share_open', { record: 'x' })).toBeNull()
    expect(shareFromEvent('goal_share', { method: 'mystery' })).toBeNull()
    expect(shareFromEvent('plan_share_stopped')).toBeNull()
  })
})

describe('sharedLinkKind', () => {
  it('recognises the shared pages', () => {
    expect(sharedLinkKind('/challenge/Zezima')).toBe('challenge')
    expect(sharedLinkKind('/player/Zezima/records/biggest-day')).toBe('record')
    expect(sharedLinkKind('/player/Zezima/goals/12')).toBe('goal')
    expect(sharedLinkKind('/player/Zezima/card/weekly/abc123')).toBe('weekly_card')
    expect(sharedLinkKind('/plan/my-plan')).toBe('plan')
    expect(sharedLinkKind('/join/bEYPONY4aTuUMmZgGBx-TA')).toBe('clan')
  })
  it('counts marked planner, compare and calculator links only when they carry from=share', () => {
    expect(sharedLinkKind('/planner', { from: 'share' })).toBe('plan')
    expect(sharedLinkKind('/compare/a/b', { from: 'share' })).toBe('compare')
    expect(sharedLinkKind('/calculators/mining', { from: 'share' })).toBe('calculator')
    expect(sharedLinkKind('/planner', {})).toBeNull()
    expect(sharedLinkKind('/compare/a/b')).toBeNull()
  })
  it('does not count ordinary pages or the bare records tab', () => {
    expect(sharedLinkKind('/')).toBeNull()
    expect(sharedLinkKind('/player/Zezima')).toBeNull()
    expect(sharedLinkKind('/player/Zezima/records')).toBeNull()
    expect(sharedLinkKind(undefined)).toBeNull()
  })
})

describe('referrerSource', () => {
  it('sorts referrers into the usual places', () => {
    expect(referrerSource('https://discord.com/channels/1/2', 'tickgains.com')).toBe('discord')
    expect(referrerSource('https://t.co/abc', 'tickgains.com')).toBe('x')
    expect(referrerSource('https://old.reddit.com/r/2007scape', 'tickgains.com')).toBe('reddit')
    expect(referrerSource('https://www.google.co.uk/', 'tickgains.com')).toBe('google')
    expect(referrerSource('https://example.org/post', 'tickgains.com')).toBe('other')
  })
  it('treats no referrer, the site itself and junk as direct', () => {
    expect(referrerSource('', 'tickgains.com')).toBe('direct')
    expect(referrerSource('https://www.tickgains.com/player/x', 'tickgains.com')).toBe('direct')
    expect(referrerSource('not a url', 'tickgains.com')).toBe('direct')
  })
})

describe('claimVisit', () => {
  const memory = () => {
    const m = {}
    return { getItem: (k) => m[k] ?? null, setItem: (k, v) => (m[k] = v) }
  }
  it('counts a kind once per day and again the next day', () => {
    const store = memory()
    const day1 = new Date('2026-11-14T10:00:00Z')
    expect(claimVisit('record:/a', day1, store)).toBe(true)
    expect(claimVisit('record:/a', day1, store)).toBe(false)
    expect(claimVisit('goal:/b', day1, store)).toBe(true)
    expect(claimVisit('record:/a', new Date('2026-11-15T10:00:00Z'), store)).toBe(true)
  })
  it('still counts when storage is blocked', () => {
    expect(claimVisit('site', new Date(), { getItem: () => { throw new Error('blocked') }, setItem: () => {} })).toBe(true)
  })
})
