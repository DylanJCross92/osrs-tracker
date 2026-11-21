import { beforeEach, describe, expect, it, vi } from 'vitest'

const query = vi.hoisted(() => vi.fn())
vi.mock('../../server/src/db.js', () => ({ pool: { query } }))
const { deleteVisitor } = await import('../../server/src/services/events.service.js')

const key = `v:${'ab'.repeat(16)}`
beforeEach(() => query.mockReset())

describe('deleteVisitor', () => {
  it('removes a browser visitor\'s events and copied plans', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rowCount: 2 }).mockResolvedValueOnce({ rowCount: 1 })
    expect(await deleteVisitor(key)).toEqual({ events: 2 })
    expect(query.mock.calls[1][0]).toContain('DELETE FROM events')
    expect(query.mock.calls[1][1]).toEqual(['ab'.repeat(16)])
    expect(query.mock.calls[2][0]).toContain('DELETE FROM visitor_data')
  })
  it('leaves accounts, the mixed entry, bad keys and visitors that signed in alone', async () => {
    expect(await deleteVisitor('a:12')).toBeNull()
    expect(await deleteVisitor('n:anon')).toBeNull()
    expect(await deleteVisitor('v:nope')).toBeNull()
    expect(query).not.toHaveBeenCalled()
    query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
    expect(await deleteVisitor(key)).toBeNull()
    expect(query).toHaveBeenCalledTimes(1)
  })
})
