// What is moving on the Grand Exchange, worked out from the item rows on the Items page (see geFormat.js rowsFromIndex): the biggest rises
// and falls, and what is traded most. A cheap item that goes from 5 to 6 coins is "up 20%" and means nothing, so risers and fallers only
// count items with a real market: a price of at least MIN_PRICE and at least MIN_DAILY_VALUE coins changing hands a day.

export const MIN_PRICE = 20
export const MIN_DAILY_VALUE = 5_000_000

const valueTraded = (r) => (r.volume || 0) * (r.price || 0)

/** The rows with a real market. */
export const liquid = (rows) => rows.filter((r) => r.price >= MIN_PRICE && valueTraded(r) >= MIN_DAILY_VALUE)

/**
 * { risers, fallers, traded } for 'day' (against yesterday's average) or 'week' (against the average 7 days ago), each at most `limit` long.
 * traded is the items traded most yesterday, or for the week view the items with the most coins changing hands, since the busiest markets
 * are not always the most numerous items.
 */
export function trending(rows, period = 'day', limit = 8) {
  const key = period === 'week' ? 'change7' : 'change1'
  const pool = liquid(rows).filter((r) => r[key] != null)
  const risers = pool.filter((r) => r[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, limit)
  const fallers = pool.filter((r) => r[key] < 0).sort((a, b) => a[key] - b[key]).slice(0, limit)
  const traded = rows
    .filter((r) => r.volume > 0 && r.price != null)
    .sort((a, b) => (period === 'week' ? valueTraded(b) - valueTraded(a) : b.volume - a.volume))
    .slice(0, limit)
  return { risers, fallers, traded }
}

/**
 * Items matching what was typed, best first: names that start with it, then ones with a word that starts with it, then ones that contain
 * it; the busiest first within each. Every word typed has to be in the name.
 */
export function searchItems(rows, query, limit = 8) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const whole = words.join(' ')
  const scored = []
  for (const r of rows) {
    const name = r.name.toLowerCase()
    if (!words.every((w) => name.includes(w))) continue
    const rank = name.startsWith(whole) ? 0 : name.split(/[\s(]+/).some((w) => w.startsWith(words[0])) ? 1 : 2
    scored.push({ r, rank })
  }
  return scored.sort((a, b) => a.rank - b.rank || (b.r.volume || 0) - (a.r.volume || 0) || a.r.name.localeCompare(b.r.name)).slice(0, limit).map((x) => x.r)
}
