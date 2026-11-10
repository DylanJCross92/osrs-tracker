import { describe, it, expect } from 'vitest'
import { normalizeEmail, cleanSource } from '../../server/src/utils/email.js'

describe('normalizeEmail', () => {
  it('accepts normal addresses and tidies them', () => {
    expect(normalizeEmail('  Player@Example.COM ')).toBe('player@example.com')
    expect(normalizeEmail('a.b+osrs@mail.co.uk')).toBe('a.b+osrs@mail.co.uk')
  })
  it('rejects things that are not email addresses', () => {
    for (const bad of ['', 'nope', 'a@b', 'a b@c.com', '@c.com', 'a@.com', 'a@c.', 'a@@c.com', null, undefined, 42, {}]) expect(normalizeEmail(bad)).toBeNull()
  })
  it('rejects absurdly long input', () => {
    expect(normalizeEmail(`${'a'.repeat(250)}@x.com`)).toBeNull()
    expect(normalizeEmail(`${'a'.repeat(65)}@x.com`)).toBeNull()
  })
})

describe('cleanSource', () => {
  it('keeps short plain labels only', () => {
    expect(cleanSource('footer')).toBe('footer')
    expect(cleanSource('home-card')).toBe('home-card')
    expect(cleanSource('<script>')).toBe('')
    expect(cleanSource('x'.repeat(30))).toBe('')
    expect(cleanSource(5)).toBe('')
  })
})
