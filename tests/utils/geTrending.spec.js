import { describe, it, expect } from 'vitest'
import { liquid, searchItems, trending } from '@/utils/geTrending'

const row = (id, name, price, volume, change1, change7) => ({ id, name, price, volume, change1, change7 })
const rows = [
  row(1, 'Blood rune', 337, 58_000_000, 4, 1),
  row(2, 'Cheap thing', 5, 50_000_000, 40, 40),
  row(3, 'Dragon bones', 3700, 2_000_000, -3, -6),
  row(4, 'Quiet staff', 50_000, 3, 25, 30),
  row(5, 'Nature rune', 169, 41_000_000, -1, 12),
  row(6, 'Gold bar', 84, 14_000_000, 7, null),
]

describe('liquid', () => {
  it('drops cheap items and ones with little trading', () => {
    expect(liquid(rows).map((r) => r.id)).toEqual([1, 3, 5, 6])
  })
})

describe('trending', () => {
  it('lists the biggest rises and falls today among real markets', () => {
    const t = trending(rows, 'day')
    expect(t.risers.map((r) => r.id)).toEqual([6, 1])
    expect(t.fallers.map((r) => r.id)).toEqual([3, 5])
  })
  it('uses the week change for the week view and skips items without one', () => {
    const t = trending(rows, 'week')
    expect(t.risers.map((r) => r.id)).toEqual([5, 1])
    expect(t.fallers.map((r) => r.id)).toEqual([3])
  })
  it('lists what is traded most: by number for today, by coins for the week', () => {
    expect(trending(rows, 'day').traded.slice(0, 3).map((r) => r.id)).toEqual([1, 2, 5])
    expect(trending(rows, 'week').traded.slice(0, 3).map((r) => r.id)).toEqual([1, 3, 5])
  })
  it('keeps each list to the limit', () => {
    expect(trending(rows, 'day', 1).risers).toHaveLength(1)
    expect(trending([], 'day')).toEqual({ risers: [], fallers: [], traded: [] })
  })
})

describe('searchItems', () => {
  const items = [
    row(1, 'Dragon bones', 3700, 2_000_000), row(2, 'Superior dragon bones', 20000, 100), row(3, 'Bones', 100, 500_000),
    row(4, 'Ring of dueling(8)', 90, 300_000), row(5, 'Dragon dagger', 12000, 5000),
  ]
  it('puts names that start with the search first, then busier ones', () => {
    expect(searchItems(items, 'dragon').map((r) => r.id)).toEqual([1, 5, 2])
  })
  it('needs every word typed to be in the name', () => {
    expect(searchItems(items, 'dragon bones').map((r) => r.id)).toEqual([1, 2])
    expect(searchItems(items, 'zzz')).toEqual([])
    expect(searchItems(items, '   ')).toEqual([])
  })
  it('finds a word that starts the search in the middle of a name', () => {
    expect(searchItems(items, 'duel').map((r) => r.id)).toEqual([4])
  })
  it('limits the results', () => {
    expect(searchItems(items, 'o', 2)).toHaveLength(2)
  })
})
