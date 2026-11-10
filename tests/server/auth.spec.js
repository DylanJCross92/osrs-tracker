import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, passwordProblem } from '../../server/src/utils/password.js'
import { sanitizeSettings } from '../../server/src/utils/settings.js'

describe('passwords', () => {
  it('hashes with a salt and verifies only the right password', async () => {
    const a = await hashPassword('correct horse')
    const b = await hashPassword('correct horse')
    expect(a).not.toBe(b)
    expect(a.startsWith('scrypt$')).toBe(true)
    expect(await verifyPassword('correct horse', a)).toBe(true)
    expect(await verifyPassword('Correct horse', a)).toBe(false)
  })
  it('rejects malformed stored hashes and non-strings', async () => {
    expect(await verifyPassword('x', 'plaintext')).toBe(false)
    expect(await verifyPassword(undefined, 'scrypt$aa$bb')).toBe(false)
    expect(await verifyPassword('x', null)).toBe(false)
  })
  it('enforces length limits', () => {
    expect(passwordProblem('short')).toMatch(/at least 8/)
    expect(passwordProblem('x'.repeat(129))).toMatch(/at most 128/)
    expect(passwordProblem('long enough')).toBeNull()
    expect(passwordProblem(12345678)).not.toBeNull()
  })
})

describe('sanitizeSettings', () => {
  it('keeps valid values and drops everything else', () => {
    expect(sanitizeSettings({ me: ' statoil ', rivals: ['sedz', 'SEDZ', 'bad<name>', 'khint'], gainPeriod: 'day', evil: 1 })).toEqual({
      me: 'statoil',
      rivals: ['sedz', 'khint'],
      gainPeriod: 'day',
    })
  })
  it('leaves missing keys out so a partial update cannot wipe the rest', () => {
    expect(sanitizeSettings({ gainPeriod: 'week' })).toEqual({ gainPeriod: 'week' })
    expect(sanitizeSettings({ gainPeriod: 'year', me: 'x<y' })).toEqual({})
  })
  it('allows clearing your name and caps rivals at 10', () => {
    expect(sanitizeSettings({ me: '' })).toEqual({ me: '' })
    const many = Array.from({ length: 15 }, (_, i) => `rival${i}`)
    expect(sanitizeSettings({ rivals: many }).rivals).toHaveLength(10)
  })
  it('handles junk input', () => {
    for (const bad of [null, undefined, 'x', 5, [], [1]]) expect(sanitizeSettings(bad)).toEqual({})
  })
})
