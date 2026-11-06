/** Adds { year: 'numeric' } to a set of toLocaleDateString/toLocaleString
 * options, but only when `date` isn't in the current year — so date labels
 * stay short for the common case and only grow when they'd otherwise be
 * ambiguous (e.g. imported history from a prior year). */
export function withYearIfNotCurrent(date, options) {
  return date.getFullYear() === new Date().getFullYear() ? options : { ...options, year: 'numeric' }
}

/** ISO timestamp -> "Just now" / "15m" / "6d" / "January 5th". */
export function formatRelative(iso) {
  const date = new Date(iso)
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000)

  if (diffSec < 60) return 'Just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h`
  const diffDay = Math.round(diffHour / 24)
  if (diffDay < 7) return `${diffDay}d`

  const day = date.getDate()
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'
  return `${date.toLocaleDateString(undefined, { month: 'long' })} ${day}${suffix}`
}
