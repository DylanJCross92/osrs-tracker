import { describe, it, expect, afterEach } from 'vitest'
import { normalizeRoles, hasRole, isOwnerEmail, OWNER_ROLES } from '../../server/src/utils/roles.js'

describe('roles', () => {
  afterEach(() => {
    delete process.env.OWNER_EMAIL
    delete process.env.NOTIFY_EMAIL
  })

  it('makes everyone a plain user unless more is granted', () => {
    expect(normalizeRoles(undefined)).toEqual(['user'])
    expect(normalizeRoles([])).toEqual(['user'])
    expect(normalizeRoles(['bogus'])).toEqual(['user'])
    expect(normalizeRoles(['user'])).toEqual(['user'])
  })
  it('keeps known roles in a fixed order and drops the rest', () => {
    expect(normalizeRoles(['owner', 'nope', 'admin'])).toEqual(['admin', 'owner'])
    expect(OWNER_ROLES).toEqual(['admin', 'owner'])
  })
  it('checks roles', () => {
    expect(hasRole(['admin', 'owner'], 'admin')).toBe(true)
    expect(hasRole([], 'admin', 'owner')).toBe(false)
    expect(hasRole(undefined, 'user')).toBe(true)
  })
  it('recognises the owner by OWNER_EMAIL, falling back to NOTIFY_EMAIL', () => {
    expect(isOwnerEmail('boss@example.com')).toBe(false)
    process.env.NOTIFY_EMAIL = 'Boss@Example.com'
    expect(isOwnerEmail('boss@example.com')).toBe(true)
    process.env.OWNER_EMAIL = 'other@example.com'
    expect(isOwnerEmail('boss@example.com')).toBe(false)
    expect(isOwnerEmail(' OTHER@example.com ')).toBe(true)
  })
})
