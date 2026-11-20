import { describe, it, expect } from 'vitest'
import {
  GE_TAX_CAP, HISTORY_RANGES, afterTax, assignSlugs, dailyMid, dayFromTimeseriesPoint, flipMargin, geTax, midPrice, parseHourly, parseLatest, parseMapping,
  parseTimeseries, percentChange, pickMovers, slugify,
} from '../../server/src/utils/ge.js'

describe('tax', () => {
  it('is 2%, rounded down, so a sale under 50 coins pays nothing', () => {
    expect(geTax(49)).toBe(0)
    expect(geTax(50)).toBe(1)
    expect(geTax(3783)).toBe(75)
    expect(afterTax(3783)).toBe(3708)
  })
  it('is capped at 5M coins per item', () => {
    expect(geTax(2_000_000_000)).toBe(GE_TAX_CAP)
    expect(afterTax(1_000_000_000)).toBe(1_000_000_000 - GE_TAX_CAP)
  })
  it('is zero for the exempt items, whatever the case, and for no price', () => {
    expect(geTax(10_000_000, 'Old school bond')).toBe(0)
    expect(geTax(100, 'CAMELOT TELEPORT')).toBe(0)
    expect(geTax(0)).toBe(0)
    expect(geTax(null)).toBe(0)
    expect(afterTax(null)).toBe(0)
  })
})

describe('prices', () => {
  it('takes the middle of the two prices, or the one there is', () => {
    expect(midPrice(3783, 3666)).toBe(3725)
    expect(midPrice(100, null)).toBe(100)
    expect(midPrice(null, 90)).toBe(90)
    expect(midPrice(null, null)).toBeNull()
  })
  it('works out a flip after tax', () => {
    expect(flipMargin(3783, 3666)).toEqual({ margin: 42, roi: 1.1 })
    expect(flipMargin(3783, null)).toBeNull()
    expect(flipMargin(40, 30).margin).toBe(10)
  })
  it('gives a percentage change to one decimal', () => {
    expect(percentChange(110, 100)).toBe(10)
    expect(percentChange(95, 100)).toBe(-5)
    expect(percentChange(100, 0)).toBeNull()
    expect(percentChange(null, 100)).toBeNull()
  })
})

describe('slugs', () => {
  it('makes readable addresses', () => {
    expect(slugify('Dragon bones')).toBe('dragon-bones')
    expect(slugify('Ring of dueling(8)')).toBe('ring-of-dueling-8')
    expect(slugify("Zulrah's scales")).toBe('zulrahs-scales')
    expect(slugify('!!!')).toBe('item')
  })
  it('keeps the plain address for the lowest id and numbers the rest', () => {
    const out = assignSlugs([{ id: 30, name: 'Bones' }, { id: 5, name: 'Bones' }, { id: 7, name: 'Ash' }])
    expect(out.find((x) => x.id === 5).slug).toBe('bones')
    expect(out.find((x) => x.id === 30).slug).toBe('bones-30')
    expect(out.find((x) => x.id === 7).slug).toBe('ash')
  })
  it('does not take an address another item already has', () => {
    expect(assignSlugs([{ id: 9, name: 'Bones' }], new Set(['bones']))[0].slug).toBe('bones-9')
  })
})

describe('the wiki payloads', () => {
  it('reads the item mapping and skips broken rows', () => {
    const items = parseMapping([
      { id: 536, name: ' Dragon bones ', examine: 'x', members: true, limit: 7500, value: 160, highalch: 96, lowalch: 64, icon: 'Dragon bones.png' },
      { id: 'x', name: 'Bad' },
      { id: 1, name: '' },
      null,
    ])
    expect(items).toEqual([{ id: 536, name: 'Dragon bones', examine: 'x', members: true, limit: 7500, value: 160, highAlch: 96, lowAlch: 64, icon: 'Dragon bones.png' }])
    expect(parseMapping(null)).toEqual([])
  })
  it('reads the latest prices, keeping items with at least one', () => {
    const rows = parseLatest({ data: { 536: { high: 3783, highTime: 1795195951, low: 3666, lowTime: 1795196092 }, 7: { high: null, highTime: null, low: 12, lowTime: 1795196000 }, 8: { high: null, low: null }, bad: {} } })
    expect(rows.map((r) => r.id).sort((a, b) => a - b)).toEqual([7, 536])
    expect(rows.find((r) => r.id === 7)).toMatchObject({ high: null, highAt: null, low: 12 })
    expect(rows.find((r) => r.id === 536).highAt).toBeInstanceOf(Date)
    expect(parseLatest(null)).toEqual([])
  })
  it('reads an hour of trades as sums for the day', () => {
    const { bucket, rows } = parseHourly({ timestamp: 1795186800, data: { 536: { avgHighPrice: 3769, highPriceVolume: 54426, avgLowPrice: 3714, lowPriceVolume: 44033 }, 9: { avgHighPrice: null, highPriceVolume: 0, avgLowPrice: null, lowPriceVolume: 0 } } })
    expect(bucket.toISOString()).toBe('2026-11-20T15:00:00.000Z')
    expect(rows).toEqual([{ id: 536, highSum: 54426 * 3769, highVol: 54426, lowSum: 44033 * 3714, lowVol: 44033 }])
    expect(parseHourly({}).rows).toEqual([])
  })
  it('turns a daily step into sums and a day into its middle price', () => {
    const day = dayFromTimeseriesPoint({ avgHighPrice: 3745, highPriceVolume: 1087303, avgLowPrice: 3675, lowPriceVolume: 1007880 })
    expect(day.highSum).toBe(3745 * 1087303)
    expect(dailyMid({ high_sum: day.highSum, high_vol: day.highVol, low_sum: day.lowSum, low_vol: day.lowVol })).toBe(3710)
    expect(dailyMid({ high_sum: 0, high_vol: 0, low_sum: 0, low_vol: 0 })).toBeNull()
    expect(dayFromTimeseriesPoint({ avgHighPrice: null, highPriceVolume: 5 })).toEqual({ highSum: 0, highVol: 0, lowSum: 0, lowVol: 0 })
  })
  it('reads a time series oldest first and keeps the newest points', () => {
    const json = { data: [{ timestamp: 300, avgHighPrice: 3, avgLowPrice: 2, highPriceVolume: 1, lowPriceVolume: 2 }, { timestamp: 100, avgHighPrice: null, avgLowPrice: 1, highPriceVolume: 0, lowPriceVolume: 1 }, { timestamp: 200, avgHighPrice: 2, avgLowPrice: 1 }] }
    expect(parseTimeseries(json).map((p) => p.t)).toEqual([100000, 200000, 300000])
    expect(parseTimeseries(json, 2).map((p) => p.t)).toEqual([200000, 300000])
    expect(parseTimeseries(json)[0]).toEqual({ t: 100000, high: null, low: 1, vol: 1 })
    expect(parseTimeseries(null)).toEqual([])
  })
  it('has a range for every chart button', () => {
    expect(Object.keys(HISTORY_RANGES)).toEqual(['1d', '1w', '1m', '3m', '1y'])
    for (const r of Object.values(HISTORY_RANGES)) expect(['5m', '1h', '6h', '24h']).toContain(r.step)
  })
})

describe('movers', () => {
  const rows = [
    { id: 1, name: 'A', price: 100, change7: 12, volume: 9000 },
    { id: 2, name: 'B', price: 100, change7: -20, volume: 9000 },
    { id: 3, name: 'C', price: 100, change7: 50, volume: 10 },
    { id: 4, name: 'D', price: 100, change7: 5, volume: 9000 },
    { id: 5, name: 'E', price: null, change7: 80, volume: 9000 },
    { id: 6, name: 'F', price: 1000, change7: null, volume: 3000 },
  ]
  it('lists the biggest risers and fallers that trade enough', () => {
    expect(pickMovers(rows, 'risers').map((r) => r.id)).toEqual([1, 4])
    expect(pickMovers(rows, 'fallers').map((r) => r.id)).toEqual([2])
  })
  it('lists the most traded by how many were traded', () => {
    expect(pickMovers(rows, 'traded').map((r) => r.id)).toEqual([1, 2, 4, 6, 3])
    expect(pickMovers(rows, 'traded', { limit: 2 })).toHaveLength(2)
  })
})
