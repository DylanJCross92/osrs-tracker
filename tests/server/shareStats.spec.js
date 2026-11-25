import { describe, it, expect } from 'vitest'
import { cleanHost, cleanItem, cleanShare, cleanVisit, summarize, summarizeItems, summarizeTraffic } from '../../server/src/utils/shareStats.js'

describe('request cleaning', () => {
  it('accepts only known shares', () => {
    expect(cleanShare({ kind: 'record', method: 'image' })).toEqual({ kind: 'record', method: 'image' })
    expect(cleanShare({ kind: 'nonsense', method: 'link' })).toBeNull()
    expect(cleanShare({ kind: 'goal', method: 'carrier pigeon' })).toBeNull()
    expect(cleanShare(undefined)).toBeNull()
  })
  it('accepts known visits and turns an unknown source into direct', () => {
    expect(cleanVisit({ kind: 'site', source: 'discord' })).toEqual({ kind: 'site', source: 'discord' })
    expect(cleanVisit({ kind: 'goal', source: 'weird' })).toEqual({ kind: 'goal', source: 'direct' })
    expect(cleanVisit({ kind: 'bogus' })).toBeNull()
  })
})

describe('what was shared', () => {
  it('cleans an item to one short line, or nothing', () => {
    expect(cleanItem('  The   Skilling\nClan ')).toBe('The Skilling Clan')
    expect(cleanItem('a'.repeat(200))).toHaveLength(80)
    expect(cleanItem('\u0000\u0007')).toBe('')
    expect(cleanItem(42)).toBe('')
    expect(cleanItem(undefined)).toBe('')
  })
  it('keeps the item on a share or visit, and drops it when empty', () => {
    expect(cleanShare({ kind: 'weekly_card', method: 'link', item: 'zezima' })).toEqual({ kind: 'weekly_card', method: 'link', item: 'zezima' })
    expect(cleanShare({ kind: 'weekly_card', method: 'link', item: '  ' })).toEqual({ kind: 'weekly_card', method: 'link' })
    expect(cleanVisit({ kind: 'record', source: 'x', item: 'zezima · biggest-day' })).toEqual({ kind: 'record', source: 'x', item: 'zezima · biggest-day' })
    // A site visit's item is only ever the referring site's host name, never a player or anything with spaces.
    expect(cleanVisit({ kind: 'site', source: 'x', item: 'zezima the great' })).toEqual({ kind: 'site', source: 'x' })
  })
  it('lists the busiest items with their shares and visits together', () => {
    const rows = [
      { type: 'share', kind: 'weekly_card', item: 'zezima', n: 2 },
      { type: 'visit', kind: 'weekly_card', item: 'zezima', n: 5 },
      { type: 'share', kind: 'clan', item: 'The Skilling Clan', n: 3 },
      { type: 'share', kind: 'weekly_card', item: 'lynx', n: 1 },
      { type: 'share', kind: 'nonsense', item: 'ignored', n: 9 },
    ]
    expect(summarizeItems(rows)).toEqual([
      { kind: 'weekly_card', label: 'Weekly card', item: 'zezima', shares: 2, visits: 5 },
      { kind: 'clan', label: 'Clan invite', item: 'The Skilling Clan', shares: 3, visits: 0 },
      { kind: 'weekly_card', label: 'Weekly card', item: 'lynx', shares: 1, visits: 0 },
    ])
    expect(summarizeItems(rows, 1)).toHaveLength(1)
  })
})

describe('summarize', () => {
  const rows = [
    { day: '2026-11-13', type: 'share', kind: 'record', detail: 'link', n: 3 },
    { day: '2026-11-14', type: 'share', kind: 'record', detail: 'image', n: 2 },
    { day: '2026-11-14', type: 'share', kind: 'plan', detail: 'social', n: 1 },
    { day: '2026-11-14', type: 'visit', kind: 'record', detail: 'discord', n: 4 },
    { day: '2026-11-14', type: 'visit', kind: 'plan', detail: 'direct', n: 1 },
    { day: '2026-11-14', type: 'visit', kind: 'site', detail: 'google', n: 40 },
  ]
  const out = summarize(rows, 3, '2026-11-14')
  it('totals shares by method and visits by kind', () => {
    expect(out.totals).toEqual({ shares: 6, link: 3, image: 2, social: 1, visits: 5, siteVisits: 40 })
  })
  it('keeps site visits out of the shared-link visits', () => {
    expect(out.sources).toEqual([
      { source: 'discord', label: 'Discord', visits: 4 },
      { source: 'direct', label: 'Direct or app', visits: 1 },
    ])
  })
  it('lists the busiest kind first with its own numbers', () => {
    expect(out.byKind[0]).toMatchObject({ kind: 'record', shares: 5, link: 3, image: 2, visits: 4 })
  })
  it('gives one point per day for the whole window, empty days included', () => {
    expect(out.daily.map((d) => d.day)).toEqual(['2026-11-12', '2026-11-13', '2026-11-14'])
    expect(out.daily.map((d) => [d.shares, d.visits])).toEqual([[0, 0], [3, 0], [3, 5]])
  })
})

describe('where site visitors came from', () => {
  it('keeps the referring site only for a site visit that came from somewhere, and only as a plain host name', () => {
    expect(cleanVisit({ kind: 'site', source: 'facebook', item: 'L.Facebook.com' })).toEqual({ kind: 'site', source: 'facebook', item: 'l.facebook.com' })
    expect(cleanVisit({ kind: 'site', source: 'direct', item: 'example.org' })).toEqual({ kind: 'site', source: 'direct' })
    expect(cleanVisit({ kind: 'site', source: 'other', item: 'https://example.org/path?a=b' })).toEqual({ kind: 'site', source: 'other' })
    expect(cleanVisit({ kind: 'site', source: 'instagram' })).toEqual({ kind: 'site', source: 'instagram' })
    expect(cleanVisit({ kind: 'site', source: 'youtube' }).source).toBe('youtube')
  })
  it('cleans a host name', () => {
    expect(cleanHost(' Old.Reddit.com ')).toBe('old.reddit.com')
    expect(cleanHost('a b.com')).toBe('')
    expect(cleanHost('x@y.com')).toBe('')
    expect(cleanHost('')).toBe('')
    expect(cleanHost(5)).toBe('')
    expect(cleanHost('a'.repeat(100))).toBe('')
  })

  const rows = [
    { day: '2026-11-24', detail: 'direct', n: 10 },
    { day: '2026-11-24', detail: 'facebook', n: 6 },
    { day: '2026-11-25', detail: 'direct', n: 8 },
    { day: '2026-11-25', detail: 'google', n: 4 },
    { day: '2026-11-25', detail: 'facebook', n: 2 },
    { day: '2026-11-25', detail: 'made-up', n: 3 },
    { day: '2026-11-01', detail: 'reddit', n: 99 },
  ]
  const sites = [{ item: 'l.facebook.com', n: 5 }, { item: 'm.facebook.com', n: 3 }, { item: 'bad host', n: 9 }]

  it('totals, splits direct from other sites, ranks the sources and gives each its share', () => {
    const t = summarizeTraffic(rows, sites, 2, '2026-11-25', 12)
    // The 99 reddit visits are outside the two days of rows only because the caller never selects them; here every row passed counts.
    expect(t.total).toBe(10 + 6 + 8 + 4 + 2 + 3 + 99)
    const small = summarizeTraffic(rows.slice(0, 6), sites, 2, '2026-11-25', 12)
    expect(small).toMatchObject({ days: 2, total: 33, previous: 12, direct: 21, referred: 12 })
    expect(small.sources.map((s) => [s.source, s.visits])).toEqual([['direct', 21], ['facebook', 8], ['google', 4]])
    expect(small.sources[0].pct).toBe(63.6)
    expect(small.sources.map((s) => s.label)).toEqual(['Direct or app', 'Facebook', 'Google'])
  })
  it('counts an unknown source as direct and drops invalid referring sites', () => {
    const small = summarizeTraffic(rows.slice(0, 6), sites, 2, '2026-11-25')
    expect(small.sites).toEqual([{ site: 'l.facebook.com', visits: 5 }, { site: 'm.facebook.com', visits: 3 }])
  })
  it('gives one point per day, ending today, with how many came from other sites', () => {
    const small = summarizeTraffic(rows.slice(0, 6), sites, 2, '2026-11-25')
    expect(small.daily).toEqual([
      { day: '2026-11-24', total: 16, referred: 6 },
      { day: '2026-11-25', total: 17, referred: 6 },
    ])
  })
  it('is all zero with nothing recorded', () => {
    expect(summarizeTraffic([], [], 7, '2026-11-25')).toMatchObject({ total: 0, direct: 0, referred: 0, sources: [], sites: [] })
  })
})
