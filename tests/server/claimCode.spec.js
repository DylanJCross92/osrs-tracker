import { describe, it, expect } from 'vitest'
import { generateClaimCode, normalizeClaimCode, CODE_LENGTH } from '../../server/src/utils/claimCode.js'

describe('claim codes', () => {
  it('are short, upper case and free of look-alike characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateClaimCode()
      expect(code).toHaveLength(CODE_LENGTH)
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]+$/)
    }
  })
  it('are not repeated back to back', () => {
    const seen = new Set(Array.from({ length: 500 }, generateClaimCode))
    expect(seen.size).toBeGreaterThan(495)
  })
  it('tidy up what was typed or pasted', () => {
    expect(normalizeClaimCode(' k7m-2qx ')).toBe('K7M2QX')
    expect(normalizeClaimCode('k7m 2qx')).toBe('K7M2QX')
  })
  it('reject anything that cannot be a code', () => {
    for (const bad of ['', 'abc', 'K7M2QXZ', 'K7M2Q0', 'K7M2QI', null, undefined, 123, {}]) expect(normalizeClaimCode(bad)).toBeNull()
  })
})
