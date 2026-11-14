import { describe, it, expect } from 'vitest'
import { cleanShare, cleanVisit, summarize } from '../../server/src/utils/shareStats.js'

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
