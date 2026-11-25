import { describe, expect, it } from 'vitest'
import { MISS_GAP_MS, detectLifeChange, lifeSummary, nextMiss } from '../../server/src/utils/hardcore.js'
import { cleanMode } from '../../server/src/services/osrsHiscores.service.js'

const snap = (overall, skills) => ({ overall_xp: overall, skills: Object.fromEntries(Object.entries(skills).map(([k, xp]) => [k, { xp, level: 1 }])) })
const now = (overall, skills) => ({ overall: { xp: overall }, skills: Object.fromEntries(Object.entries(skills).map(([k, xp]) => [k, { xp, level: 1 }])) })

describe('detectLifeChange', () => {
  const prev = snap(1_000_000, { Attack: 400_000, Mining: 600_000 })
  it('is not a reset while the character just keeps playing', () => {
    expect(detectLifeChange(prev, now(1_050_000, { Attack: 450_000, Mining: 600_000 }))).toBe(false)
    expect(detectLifeChange(prev, now(1_000_000, { Attack: 400_000, Mining: 600_000 }))).toBe(false)
  })
  it('is a reset when the total or any single skill has less xp than before', () => {
    expect(detectLifeChange(prev, now(0, { Attack: 0, Mining: 0 }))).toBe(true)
    expect(detectLifeChange(prev, now(1_100_000, { Attack: 300_000, Mining: 800_000 }))).toBe(true)
  })
  it('never calls a first snapshot a reset', () => {
    expect(detectLifeChange(null, now(10, { Attack: 10 }))).toBe(false)
  })
  it('ignores a skill the older snapshot did not have', () => {
    expect(detectLifeChange(prev, now(1_000_500, { Attack: 400_000, Mining: 600_000, Sailing: 500 }))).toBe(false)
  })
})

describe('nextMiss', () => {
  const t0 = new Date('2026-11-25T10:00:00Z')
  it('counts the first miss without calling it gone', () => {
    expect(nextMiss({}, t0)).toEqual({ misses: 1, missAt: t0, left: false })
  })
  it('does not count a second miss that comes too soon', () => {
    const soon = new Date(t0.getTime() + MISS_GAP_MS - 60_000)
    expect(nextMiss({ misses: 1, missAt: t0 }, soon)).toMatchObject({ misses: 1, left: false })
  })
  it('marks it gone on a second miss a day later', () => {
    const later = new Date(t0.getTime() + 24 * 3_600_000)
    expect(nextMiss({ misses: 1, missAt: t0 }, later)).toMatchObject({ misses: 2, left: true })
  })
})

describe('lifeSummary and cleanMode', () => {
  it('keeps the three best skills of a finished life', () => {
    const s = lifeSummary({ skills: { A: { level: 50, xp: 5 }, B: { level: 70, xp: 50 }, C: { level: 60, xp: 20 }, D: { level: 10, xp: 1 } } }, [{ a: 1 }])
    expect(s.topSkills.map((x) => x.skill)).toEqual(['B', 'C', 'A'])
    expect(s.milestones).toHaveLength(1)
  })
  it('only knows the two modes', () => {
    expect([cleanMode('hardcore'), cleanMode('main'), cleanMode('x'), cleanMode(undefined)]).toEqual(['hardcore', 'main', 'main', 'main'])
  })
})
