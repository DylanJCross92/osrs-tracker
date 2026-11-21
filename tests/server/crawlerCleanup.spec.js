import { describe, expect, it, vi } from 'vitest'

// The service imports the database pool, which is not needed for the pure option rules.
vi.mock('../../server/src/db.js', () => ({ pool: { query: vi.fn() } }))
const { cleanBurstOptions } = await import('../../server/src/services/crawlerCleanup.service.js')

describe('cleanBurstOptions', () => {
  it('keeps good settings and fills in the rest', () => {
    expect(cleanBurstOptions({ since: '2026-11-20', min: '200', prefix: '/items/' })).toEqual({ since: '2026-11-20', min: 200, prefix: '/items/' })
    const d = cleanBurstOptions({})
    expect(d.min).toBe(150)
    expect(d.prefix).toBe('/items/')
    expect(d.since).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('refuses odd values, so nothing can be slipped into the query', () => {
    const o = cleanBurstOptions({ since: "2026-11-20'; DROP TABLE events;--", min: 3, prefix: "/items/%' OR 1=1" })
    expect(o.since).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(o.min).toBe(20)
    expect(o.prefix).toBe('/items/')
  })
})
