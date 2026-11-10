import { describe, it, expect } from 'vitest'
import { avatarFor } from '@/utils/avatar'

describe('avatarFor', () => {
  it('is the same for the same name, however it is written', () => {
    expect(avatarFor('Dylanz297')).toEqual(avatarFor('dylanz297'))
    expect(avatarFor('oo Jake')).toEqual(avatarFor('oo_Jake'))
  })

  it('differs between names', () => {
    const names = ['sedz', 'khint', 'Dylanz297', 'statoil', 'Sp0oky', 'oo Jake', 'XpTitan']
    const keys = new Set(names.map((n) => JSON.stringify(avatarFor(n).cells)))
    expect(keys.size).toBe(names.length)
  })

  it('is mirrored left to right and never nearly empty', () => {
    for (const name of ['a', 'zezima', 'B0aty', 'Iron Mammal', '']) {
      const { cells } = avatarFor(name)
      expect(cells.length).toBeGreaterThanOrEqual(10)
      const set = new Set(cells.map((c) => `${c.x},${c.y}`))
      for (const c of cells) expect(set.has(`${6 - c.x},${c.y}`)).toBe(true)
    }
  })
})
