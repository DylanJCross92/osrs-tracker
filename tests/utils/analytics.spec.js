import { describe, expect, it } from 'vitest'
import { isInternalTraffic, isLocalHost } from '@/utils/analytics'

const store = (items = {}) => ({ getItem: (k) => items[k] ?? null })

describe('internal traffic', () => {
  it('treats local and private addresses as internal, and the real site as not', () => {
    for (const h of ['localhost', '127.0.0.1', '[::1]', '192.168.1.20', '10.0.0.5', '172.20.1.1', 'dev.localhost', 'mac.local']) expect(isLocalHost(h)).toBe(true)
    for (const h of ['tickgains.com', 'www.tickgains.com', 'osrs-tracker-709q.onrender.com', '172.32.0.1', '8.8.8.8']) expect(isLocalHost(h)).toBe(false)
  })

  it('is internal for a marked browser or while an admin account is signed in', () => {
    const live = 'tickgains.com'
    expect(isInternalTraffic({ hostname: live, storage: store() })).toBe(false)
    expect(isInternalTraffic({ hostname: live, storage: store({ 'tickgains-internal': '1' }) })).toBe(true)
    expect(isInternalTraffic({ hostname: live, storage: store({ 'tickgains-internal-account': '1' }) })).toBe(true)
    expect(isInternalTraffic({ hostname: 'localhost', storage: store() })).toBe(true)
  })

  it('counts the visit when storage cannot be read', () => {
    expect(isInternalTraffic({ hostname: 'tickgains.com', storage: { getItem: () => { throw new Error('blocked') } } })).toBe(false)
  })
})
