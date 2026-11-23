import { describe, expect, it } from 'vitest'
import { formatXp as clientXp } from '@/utils/osrsSkills'
import { formatDays as clientDays, formatGp as clientGp, formatHours as clientHours, levelAtXp as clientLevel, xpAtLevel as clientXpAt } from '@/utils/planner'
import { formatDays as serverDays, formatGp as serverGp, formatHours as serverHours, formatXp as serverXp } from '../../server/src/utils/format.js'
import { levelAtXp as serverLevel, xpAtLevel as serverXpAt, MAX_LEVEL } from '../../server/src/utils/xp.js'

// The same figure has to read the same on the site and on a share card or link preview, so the two sets of formatters are held together.

const AMOUNTS = [0, 1, 7, 850, 999, 1_000, 1_049, 1_050, 12_345, 99_949, 99_950, 999_499, 999_500, 999_949, 999_950, 999_999, 1_000_000, 1_004_999, 1_005_000, 2_000_000, 9_994_999, 9_995_000, 12_960_000, 13_034_431, 99_949_999, 99_950_000, 188_884_740, 200_000_000, 999_949_999, 999_950_000, 999_999_999, 1_000_000_000, 1_500_000_000, 3_746_000_000]

describe('compact XP', () => {
  it('is written the same by the site and the server', () => {
    for (const n of [...AMOUNTS, ...AMOUNTS.map((x) => -x)]) expect(serverXp(n), String(n)).toBe(clientXp(n))
  })
  it('never prints a thousand of a unit: a value that rounds up uses the next one', () => {
    for (const n of [999_950, 999_999, 999_950_000, 999_999_999, 99_950, -999_999]) {
      expect(clientXp(n), String(n)).not.toMatch(/^-?1000(\.0)?[KM]$/)
      expect(serverXp(n), String(n)).not.toMatch(/^-?1000(\.0)?[KM]$/)
    }
    expect(clientXp(999_999)).toBe('1M')
    expect(clientXp(999_999_999)).toBe('1B')
    expect(clientXp(13_034_431)).toBe('13M')
  })
})

describe('gp', () => {
  it('is written the same by the site and the server', () => {
    for (const n of [null, ...AMOUNTS, ...AMOUNTS.map((x) => -x)]) expect(serverGp(n), String(n)).toBe(clientGp(n))
  })
  it('keeps one decimal in millions and never prints 1000K or 1000M', () => {
    expect(clientGp(2_000_000)).toBe('+2.0M gp')
    expect(clientGp(12_345)).toBe('+12K gp')
    expect(clientGp(999_500)).toBe('+1.0M gp')
    expect(clientGp(-999_999_999)).toBe('-1.00B gp')
    expect(clientGp(null)).toBe('No GP data')
  })
})

describe('hours and days', () => {
  it('are written the same by the site and the server', () => {
    for (const h of [null, 0, 0.01, 0.5, 0.99, 1, 5.24, 99.94, 100, 1788.4]) expect(serverHours(h), String(h)).toBe(clientHours(h))
    for (const d of [0, 1, 2, 12, 1234]) expect(serverDays(d), String(d)).toBe(clientDays(d))
    expect(clientHours(0.5)).toBe('30 min')
    expect(clientDays(1)).toBe('1 day')
  })
})

describe('the XP table', () => {
  it('is the same on the server for every level from 1 to 126', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) expect(serverXpAt(level), `level ${level}`).toBe(clientXpAt(level))
    expect(serverXpAt(99)).toBe(13_034_431)
    expect(serverXpAt(126)).toBe(188_884_740)
  })
  it('gives the same level for any XP', () => {
    for (const xp of [0, 82, 83, 1_000_000, 12_000_000, 13_034_430, 13_034_431, 100_000_000, 188_884_740, 200_000_000]) {
      expect(serverLevel(xp), `${xp}`).toBe(clientLevel(xp))
      expect(serverLevel(xp, true), `${xp} virtual`).toBe(clientLevel(xp, true))
    }
  })
})
