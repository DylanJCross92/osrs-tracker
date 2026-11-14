// Helpers for the "when will you be online?" window on a profile claim. The person picks a day and two clock times in
// their own time zone; the server stores exact moments, so the owner sees them converted to their own zone.

const pad = (n) => String(n).padStart(2, '0')
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const timeKey = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

function dayLabel(d, offset) {
  if (offset === 0) return 'Today'
  if (offset === 1) return 'Tomorrow'
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** The next few days to pick from: [{ value: 'YYYY-MM-DD', label }]. */
export function dayOptions(now = new Date(), count = 8) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    return { value: dayKey(d), label: dayLabel(d, i) }
  })
}

/** A day and two "HH:MM" times into { onlineFrom, onlineUntil } ISO strings. An end before the start means overnight. */
export function buildWindow(day, from, to) {
  if (!day || !from || !to) return null
  const [y, m, d] = day.split('-').map(Number)
  const [fh, fm] = from.split(':').map(Number)
  const [th, tm] = to.split(':').map(Number)
  if ([y, m, d, fh, fm, th, tm].some((n) => Number.isNaN(n))) return null
  const start = new Date(y, m - 1, d, fh, fm)
  let end = new Date(y, m - 1, d, th, tm)
  if (end <= start) end = new Date(y, m - 1, d + 1, th, tm)
  return { onlineFrom: start.toISOString(), onlineUntil: end.toISOString() }
}

/** The reverse of buildWindow: ISO strings into { day, from, to } for the form. */
export function splitWindow(onlineFrom, onlineUntil) {
  const a = new Date(onlineFrom)
  const b = new Date(onlineUntil)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  return { day: dayKey(a), from: timeKey(a), to: timeKey(b) }
}

/** "Sat, Nov 15, 6:00 PM to 10:00 PM" in the viewer's own time zone. */
export function describeWindow(onlineFrom, onlineUntil) {
  const a = new Date(onlineFrom)
  const b = new Date(onlineUntil)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return ''
  const date = a.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const time = (d) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const sameDay = dayKey(a) === dayKey(b)
  return sameDay ? `${date}, ${time(a)} to ${time(b)}` : `${date}, ${time(a)} to ${b.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, ${time(b)}`
}
