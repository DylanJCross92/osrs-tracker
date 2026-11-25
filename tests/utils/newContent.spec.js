import { describe, expect, it } from 'vitest'
import { NEW_DAYS, isNewContent } from '../../src/data/newContent.js'

const list = { 'the-graveyard': '2026-11-25' }
// Midnight Eastern (UTC-5) on the 25th.
const start = Date.parse('2026-11-25T05:00:00Z')
const DAY = 86_400_000

describe('isNewContent', () => {
  it('is new from the day it was added until seven days later', () => {
    expect(NEW_DAYS).toBe(7)
    expect(isNewContent('the-graveyard', start, list)).toBe(true)
    expect(isNewContent('the-graveyard', start + 6.9 * DAY, list)).toBe(true)
    expect(isNewContent('the-graveyard', start + 7 * DAY, list)).toBe(false)
    expect(isNewContent('the-graveyard', start + 30 * DAY, list)).toBe(false)
  })
  it('is not new before it was added, or when it is not listed', () => {
    expect(isNewContent('the-graveyard', start - 1000, list)).toBe(false)
    expect(isNewContent('another-quest', start + DAY, list)).toBe(false)
    expect(isNewContent('', start, list)).toBe(false)
    expect(isNewContent(undefined, start, list)).toBe(false)
  })
  it('accepts a quest: prefix', () => {
    expect(isNewContent('quest:the-graveyard', start + DAY, list)).toBe(true)
  })
  it('lists the real new content for its first week', () => {
    expect(isNewContent('the-graveyard', start + DAY)).toBe(true)
    expect(isNewContent('agility-prison-of-raun', start + DAY)).toBe(true)
  })
})
