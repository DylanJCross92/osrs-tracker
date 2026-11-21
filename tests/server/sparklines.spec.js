import { describe, expect, it, vi } from 'vitest'

const query = vi.hoisted(() => vi.fn())
vi.mock('../../server/src/db.js', () => ({ pool: { query } }))
const { getSparklines } = await import('../../server/src/services/ge.service.js')

describe('getSparklines', () => {
  it('turns each day\'s sums into an average price, oldest first, and skips days with no trades', async () => {
    query.mockResolvedValue({
      rows: [
        { slug: 'dragon-bones', day: '2026-11-01', high_sum: '3800000', high_vol: '1000', low_sum: '3600000', low_vol: '1000' },
        { slug: 'dragon-bones', day: '2026-11-02', high_sum: '0', high_vol: '0', low_sum: '0', low_vol: '0' },
        { slug: 'dragon-bones', day: '2026-11-03', high_sum: '3900000', high_vol: '1000', low_sum: '0', low_vol: '0' },
        { slug: 'law-rune', day: '2026-11-01', high_sum: '240', high_vol: '2', low_sum: '230', low_vol: '2' },
      ],
    })
    const out = await getSparklines(['dragon-bones', 'law-rune'], 30)
    expect(out['dragon-bones']).toEqual([3700, 3900])
    expect(out['law-rune']).toEqual([118])
    expect(query.mock.calls[0][1]).toEqual([['dragon-bones', 'law-rune'], 30])
  })
  it('does not ask the database when there is nothing to look up', async () => {
    query.mockClear()
    expect(await getSparklines([])).toEqual({})
    expect(query).not.toHaveBeenCalled()
  })
})
