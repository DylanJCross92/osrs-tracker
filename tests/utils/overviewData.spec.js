import { describe, expect, it } from 'vitest'
import { conversion, funnelRows, peopleSummary, sharingSummary, trend, trendLabel } from '@/components/admin/stats/overviewData'

describe('trend', () => {
  it('compares the latest half of the days with the half before', () => {
    const t = trend([1, 1, 1, 1, 2, 2, 2, 2])
    expect(t).toMatchObject({ now: 8, before: 4, pct: 100, dir: 'up' })
    expect(trendLabel(t)).toBe('▲ 100%')
  })
  it('shows a fall, no change, and something from nothing', () => {
    expect(trendLabel(trend([4, 4, 4, 4, 2, 2, 2, 2]))).toBe('▼ 50%')
    expect(trend([3, 3, 3, 3]).dir).toBe('flat')
    expect(trend([0, 0, 0, 0, 5, 0, 0, 0]).dir).toBe('new')
  })
  it('says nothing for too few days, or no activity at all', () => {
    expect(trend([5, 5, 5]).dir).toBe('none')
    expect(trend([0, 0, 0, 0]).dir).toBe('none')
    expect(trendLabel(trend([]))).toBe('')
  })
})

describe('peopleSummary', () => {
  const v = (key, kind, events, first, last) => ({ key, kind, label: key, players: '', events, first, last })
  const list = { visitors: [
    v('a:1', 'account', 40, '2026-11-17T10:00:00Z', '2026-11-18T09:00:00Z'),
    v('v:b', 'visitor', 5, '2026-11-18T08:00:00Z', '2026-11-18T08:30:00Z'),
    v('v:c', 'visitor', 12, '2026-11-16T08:00:00Z', '2026-11-16T09:00:00Z'),
  ] }
  it('counts who signed in and who came back on another day', () => {
    const s = peopleSummary(list)
    expect(s).toMatchObject({ total: 3, accounts: 1, anonymous: 2, returning: 1, avgSteps: 19, capped: false })
  })
  it('lists the busiest first and keeps the newest order for latest', () => {
    const s = peopleSummary(list)
    expect(s.busiest.map((x) => x.key)).toEqual(['a:1', 'v:c', 'v:b'])
    expect(s.latest.map((x) => x.key)).toEqual(['a:1', 'v:b', 'v:c'])
  })
  it('copes with nothing', () => {
    expect(peopleSummary(null)).toMatchObject({ total: 0, avgSteps: 0, latest: [] })
  })
})

describe('funnelRows', () => {
  it('shows how far each step carries on from the one before', () => {
    const rows = funnelRows([{ name: 'search_started', total: 200 }, { name: 'search_suggestions_shown', total: 100 }, { name: 'search_suggestion_selected', total: 25 }])
    expect(rows.map((r) => r.value)).toEqual([200, 100, 25, 0])
    expect(rows[1].sub).toBe('50% of the step before')
    expect(rows[0].sub).toBe('')
  })
})

describe('sharingSummary', () => {
  const data = { totals: { shares: 10, link: 6, image: 3, social: 1, visits: 5, siteVisits: 100 }, items: [{ item: 'a' }, { item: 'b' }, { item: 'c' }, { item: 'd' }, { item: 'e' }], sources: [{ source: 'x', label: 'X', visits: 3 }, { source: 'y', label: 'Y', visits: 0 }] }
  it('boils the tab down', () => {
    const s = sharingSummary(data)
    expect(s).toMatchObject({ shares: 10, visits: 5, pct: '5.0%', perShare: '0.5' })
    expect(s.topItems).toHaveLength(4)
    expect(s.topSources.map((x) => x.source)).toEqual(['x'])
  })
  it('has no figures without data or visits', () => {
    expect(sharingSummary(null)).toBeNull()
    expect(sharingSummary({ ...data, totals: { ...data.totals, shares: 0, siteVisits: 0 } })).toMatchObject({ pct: '-', perShare: null })
  })
})

describe('conversion', () => {
  it('gives sign-ups as a share of visitors', () => {
    expect(conversion(3, 100)).toBe('3.0%')
    expect(conversion(20, 100)).toBe('20%')
    expect(conversion(0, 100)).toBe('0%')
    expect(conversion(5, 0)).toBe('-')
  })
})
