import { describe, it, expect } from 'vitest'
import { claimVisit, referrerHost, referrerSource, shareFromEvent, sharedLinkItem, sharedLinkKind } from '@/utils/shareEvents'

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

describe('referrerSource: more places and apps', () => {
  const own = 'tickgains.com'
  it('knows Facebook, its link redirector and its messenger', () => {
    expect(referrerSource('https://l.facebook.com/l.php?u=x', own)).toBe('facebook')
    expect(referrerSource('https://m.facebook.com/', own)).toBe('facebook')
    expect(referrerSource('https://www.messenger.com/', own)).toBe('facebook')
  })
  it('knows the other social, video and search sites', () => {
    expect(referrerSource('https://www.instagram.com/', own)).toBe('instagram')
    expect(referrerSource('https://www.youtube.com/watch?v=1', own)).toBe('youtube')
    expect(referrerSource('https://www.twitch.tv/x', own)).toBe('twitch')
    expect(referrerSource('https://www.bing.com/search?q=x', own)).toBe('bing')
    expect(referrerSource('https://duckduckgo.com/', own)).toBe('duckduckgo')
    expect(referrerSource('https://oldschool.runescape.wiki/w/Agility', own)).toBe('wiki')
  })
  it('reads the tag on a link first, so a link posted somewhere says where', () => {
    expect(referrerSource('', own, { search: '?utm_source=facebook' })).toBe('facebook')
    expect(referrerSource('https://example.org/', own, { search: '?utm_source=FB' })).toBe('facebook')
    expect(referrerSource('', own, { search: '?utm_source=twitter' })).toBe('x')
    expect(referrerSource('', own, { search: '?utm_source=mystery' })).toBe('direct')
  })
  it('spots Facebook and other apps when no referrer is sent', () => {
    expect(referrerSource('', own, { search: '?fbclid=abc' })).toBe('facebook')
    expect(referrerSource('', own, { userAgent: 'Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/430.0]' })).toBe('facebook')
    expect(referrerSource('', own, { userAgent: 'Mozilla/5.0 Instagram 300.0' })).toBe('instagram')
    expect(referrerSource('', own, { userAgent: 'Mozilla/5.0 musical_ly_30.0' })).toBe('tiktok')
    expect(referrerSource('', own, { userAgent: 'Mozilla/5.0 (Macintosh) Chrome/120' })).toBe('direct')
  })
  it('does not call a visit from the site itself an app visit', () => {
    expect(referrerSource('https://tickgains.com/player/x', own, { search: '?fbclid=abc', userAgent: 'FBAN' })).toBe('direct')
  })
})

describe('referrerHost', () => {
  it('gives the referring site without www, and nothing for no referrer, junk or this site', () => {
    expect(referrerHost('https://www.reddit.com/r/2007scape', 'tickgains.com')).toBe('reddit.com')
    expect(referrerHost('https://l.facebook.com/l.php', 'tickgains.com')).toBe('l.facebook.com')
    expect(referrerHost('', 'tickgains.com')).toBe('')
    expect(referrerHost('not a url', 'tickgains.com')).toBe('')
    expect(referrerHost('https://www.tickgains.com/x', 'tickgains.com')).toBe('')
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

describe('what was shared', () => {
  it('carries the item a share button names, trimmed', () => {
    expect(shareFromEvent('share_card', { method: 'live', item: '  zezima ' })).toEqual({ kind: 'weekly_card', method: 'link', item: 'zezima' })
    expect(shareFromEvent('calc_share', { item: 'Mining' })).toEqual({ kind: 'calculator', method: 'link', item: 'Mining' })
    expect(shareFromEvent('clan_share', { method: 'x', item: '   ' })).toEqual({ kind: 'clan', method: 'social' })
  })
  it('names the player behind a shared link, in the same words as the share buttons', () => {
    expect(sharedLinkItem('/player/Zezima/card/weekly/abc123')).toBe('zezima')
    expect(sharedLinkItem('/player/Zezima/card/weekly?skill=Mining')).toBe('zezima')
    expect(sharedLinkItem('/player/Zezima/goals/12')).toBe('zezima')
    expect(sharedLinkItem('/player/Zezima/records/Biggest-Day')).toBe('zezima · biggest-day')
    expect(sharedLinkItem('/challenge/Lynx%20Titan')).toBe('lynx titan')
  })
  it('names nothing for links that are private or not about one player', () => {
    expect(sharedLinkItem('/join/bEYPONY4aTuUMmZgGBx-TA')).toBe('')
    expect(sharedLinkItem('/plan/my-plan')).toBe('')
    expect(sharedLinkItem('/player/Zezima')).toBe('')
    expect(sharedLinkItem(undefined)).toBe('')
  })
})
