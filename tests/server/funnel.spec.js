import { describe, expect, it } from 'vitest'
import { buildFunnel, buildJourney, median, milestonesOf, spanLabel } from '../../server/src/utils/funnel.js'

const T = (min) => new Date(Date.UTC(2026, 10, 10, 12, min)).toISOString()
const person = (o = {}) => ({ first: T(0), played: null, added: false, viewed: false, signedUp: null, confirmed: null, claimed: null, back: null, ...o })

const ROWS = [
  person(), // looked around, nothing else
  person({ played: T(2), viewed: true }),
  person({ played: T(1), added: true, viewed: true, signedUp: T(10), confirmed: T(14), claimed: T(40) }),
  person({ played: T(3), viewed: true, signedUp: T(20) }),
  person({ signedUp: T(5), confirmed: T(6), claimed: T(9) }), // signed up straight away, no player step
]

describe('buildFunnel', () => {
  it('counts only people who reached every earlier step', () => {
    const { steps } = buildFunnel(ROWS)
    expect(steps.map((s) => s.value)).toEqual([5, 3, 2, 1])
    expect(steps[0].ofPrevious).toBeNull()
    expect(steps[1].ofFirst).toBe(60)
    expect(steps[2].ofPrevious).toBe(66.7)
    expect(steps[3].ofFirst).toBe(20)
  })

  it('splits the player step and counts confirmed sign-ups', () => {
    const { steps } = buildFunnel(ROWS)
    expect(steps[1].detail).toEqual({ added: 1, viewed: 3, both: 1 })
    expect(steps[2].detail).toEqual({ confirmed: 1 })
  })

  it('keeps people who skipped the player step in the totals', () => {
    const f = buildFunnel(ROWS)
    expect(f.skipped).toEqual({ signedUp: 1, claimed: 1 })
    expect(f.totals).toEqual({ people: 5, signedUp: 3, claimed: 2 })
  })

  it('copes with nobody', () => {
    const f = buildFunnel([])
    expect(f.steps.map((s) => s.value)).toEqual([0, 0, 0, 0])
    expect(f.steps[1].ofFirst).toBeNull()
  })
})

describe('buildJourney', () => {
  it('puts the milestones a person reached in the order they happened', () => {
    expect(milestonesOf(ROWS[2])).toEqual(['player', 'signedUp', 'confirmed', 'claimed'])
    expect(milestonesOf(ROWS[4])).toEqual(['signedUp', 'confirmed', 'claimed'])
    expect(milestonesOf(ROWS[0])).toEqual([])
  })

  it('gives the typical time from the milestone each is measured against', () => {
    const { milestones } = buildJourney(ROWS)
    const by = Object.fromEntries(milestones.map((m) => [m.key, m]))
    expect(by.visited.value).toBe(5)
    expect(by.player.value).toBe(3)
    expect(by.player.typical).toBe(2 * 60_000) // 1, 2 and 3 minutes after the first visit
    expect(by.signedUp.value).toBe(3)
    expect(by.confirmed.typical).toBe(150_000) // 4 min and 1 min after signing up
    expect(by.confirmed.typicalLabel).toBe('3 min after signing up')
    expect(by.claimed.ofBase).toBe(66.7)
    expect(by.claimed.baseLabel).toBe('of sign-ups')
  })

  it('counts "came back" only for a later day than the sign-up', () => {
    const rows = [person({ signedUp: T(1), back: T(30) }), person({ signedUp: T(1), back: '2026-11-12T08:00:00.000Z' })]
    expect(buildJourney(rows).milestones.find((m) => m.key === 'back').value).toBe(1)
  })

  it('lists the most common paths, biggest first', () => {
    const { paths, otherPaths } = buildJourney([...ROWS, person(), person()], 2)
    expect(paths[0]).toMatchObject({ label: 'Visited', n: 3 })
    expect(paths[1].n).toBe(1)
    expect(otherPaths).toBe(3) // the other three one-person paths
  })
})

describe('helpers', () => {
  it('median', () => {
    expect(median([])).toBeNull()
    expect(median([5, 1, 3])).toBe(3)
    expect(median([1, 2, 3, 4])).toBe(3)
  })
  it('spanLabel', () => {
    expect(spanLabel(null)).toBe('')
    expect(spanLabel(20_000)).toBe('under a minute')
    expect(spanLabel(12 * 60_000)).toBe('12 min')
    expect(spanLabel(5 * 3_600_000)).toBe('5 h')
    expect(spanLabel(4 * 86_400_000)).toBe('4 days')
  })
})
