// What a price history says in a few numbers (see components/ItemDetail.vue): the lowest and highest price, the average, how far the
// price moved over the range, and where the price is now against that average.

const mid = (p) => (p.high != null && p.low != null ? (p.high + p.low) / 2 : p.high ?? p.low ?? null)
const oneDecimal = (n) => Math.round(n * 10) / 10

/**
 * { low, high, avg, change, vsAvg } for chart points [{ high, low }] oldest first and the price now, or null when there is too little to
 * say. change is the percentage from the first price to the last; vsAvg is the percentage the price now is above (+) or below (-) the average.
 */
export function summarizeHistory(points, now = null) {
  const list = Array.isArray(points) ? points : []
  const mids = list.map(mid).filter((v) => v != null)
  if (mids.length < 2) return null
  const lows = list.map((p) => p.low ?? p.high).filter((v) => v != null)
  const highs = list.map((p) => p.high ?? p.low).filter((v) => v != null)
  const avg = Math.round(mids.reduce((a, b) => a + b, 0) / mids.length)
  const first = mids[0]
  const last = mids[mids.length - 1]
  return {
    low: Math.min(...lows),
    high: Math.max(...highs),
    avg,
    change: first > 0 ? oneDecimal(((last - first) / first) * 100) : null,
    vsAvg: now > 0 && avg > 0 ? oneDecimal(((now - avg) / avg) * 100) : null,
  }
}
