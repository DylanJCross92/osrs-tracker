import { describe, expect, it } from 'vitest'
import { summarizeHistory } from '@/utils/geSummary'

describe('summarizeHistory', () => {
  const points = [
    { high: 110, low: 90 },
    { high: 120, low: 100 },
    { high: 130, low: 110 },
  ]
  it('gives the lowest, highest and average price and the change over the range', () => {
    const s = summarizeHistory(points, 120)
    expect(s.low).toBe(90)
    expect(s.high).toBe(130)
    expect(s.avg).toBe(110)
    expect(s.change).toBe(20)
    expect(s.vsAvg).toBe(9.1)
  })
  it('uses the one price there is, and skips empty steps', () => {
    const s = summarizeHistory([{ high: null, low: 50 }, { high: null, low: null }, { high: 70, low: null }], 60)
    expect(s.low).toBe(50)
    expect(s.high).toBe(70)
    expect(s.avg).toBe(60)
    expect(s.vsAvg).toBe(0)
  })
  it('says nothing when there is too little to go on', () => {
    expect(summarizeHistory([], 5)).toBeNull()
    expect(summarizeHistory([{ high: 5, low: 4 }], 5)).toBeNull()
    expect(summarizeHistory(null, 5)).toBeNull()
  })
  it('has no comparison with the average without a price now', () => {
    expect(summarizeHistory(points, null).vsAvg).toBeNull()
  })
})
