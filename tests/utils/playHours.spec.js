import { beforeEach, describe, expect, it, vi } from 'vitest'

// The hours a day a person plays: remembered from the last choice, used by every new plan, and kept in the key the account sync carries.
async function fresh() {
  vi.resetModules()
  return import('@/composables/usePlayHours')
}

describe('play hours', () => {
  beforeEach(() => localStorage.clear())

  it('is 2 until the person chooses, then follows their choice', async () => {
    const { usePlayHours, playHours } = await fresh()
    expect(playHours()).toBe(2)
    const { setPlayHours } = usePlayHours()
    expect(setPlayHours(5)).toBe(5)
    expect(playHours()).toBe(5)
  })

  it('is kept in this browser for the next visit, in the key the account sync carries', async () => {
    const first = await fresh()
    first.usePlayHours().setPlayHours(3.5)
    expect(JSON.parse(localStorage.getItem('tickgains-planner-prefs-v1'))).toEqual({ hours: 3.5 })
    const next = await fresh()
    expect(next.playHours()).toBe(3.5)
  })

  it('keeps to half hours between 0.5 and 24 and ignores nonsense', async () => {
    const { usePlayHours, playHours } = await fresh()
    const { setPlayHours } = usePlayHours()
    expect(setPlayHours(2.3)).toBe(2.5)
    expect(setPlayHours(100)).toBe(24)
    expect(setPlayHours(0.1)).toBe(0.5)
    setPlayHours('abc')
    setPlayHours(-3)
    expect(playHours()).toBe(0.5)
  })

  it('picks up a change that came from the account', async () => {
    const { playHours } = await fresh()
    expect(playHours()).toBe(2)
    localStorage.setItem('tickgains-planner-prefs-v1', JSON.stringify({ hours: 6 }))
    window.dispatchEvent(new CustomEvent('tickgains:data-synced'))
    expect(playHours()).toBe(6)
  })
})
