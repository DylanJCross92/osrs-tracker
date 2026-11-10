// Wording and icons for personal records, shared by the Records tab and the profile overview so both read the same.
import { formatGameDay, addGameDays } from '@/utils/gameDay'
import { formatXp } from '@/utils/osrsSkills'

export const RECORD_ICONS = {
  trophy: ['M8 21h8M12 17v4M7 4h10v6a5 5 0 01-10 0V4z', 'M17 6h3v2a3 3 0 01-3 3', 'M7 6H4v2a3 3 0 003 3'],
  flame: ['M12 3c1 3 4 4.5 4 8.5a4 4 0 01-8 0c0-1.7.8-2.8 1.6-3.8.3 1.2 1 1.8 1.6 1.8C11 7.5 11 5 12 3z'],
  star: ['M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7z'],
  layers: ['M12 3l9 5-9 5-9-5 9-5z', 'M3 13l9 5 9-5'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M9 3v4', 'M15 3v4'],
  lock: ['M6 11h12v9H6z', 'M8 11V8a4 4 0 018 0v3'],
  share: ['M4 12v7h16v-7', 'M12 16V3', 'M7 8l5-5 5 5'],
}

export const iconForRecord = (r) =>
  r.locked
    ? RECORD_ICONS.lock
    : ({ 'best-day': RECORD_ICONS.trophy, 'best-week': RECORD_ICONS.calendar, 'best-month': RECORD_ICONS.calendar, 'longest-streak': RECORD_ICONS.flame, 'most-levels-day': RECORD_ICONS.star, 'most-skills-day': RECORD_ICONS.layers })[r.key] || RECORD_ICONS.trophy

export const recordValueText = (r) => (r.unit === 'xp' ? formatXp(r.value) : r.value.toLocaleString('en-US'))
export const recordUnitText = (r) => ({ xp: 'XP', days: r.value === 1 ? 'day' : 'days', levels: r.value === 1 ? 'level' : 'levels', skills: 'skills' })[r.unit] || ''

export function recordDayText(key, today, withYear = false) {
  if (!key) return ''
  const sameYear = key.slice(0, 4) === (today || '').slice(0, 4)
  return formatGameDay(key, { month: 'short', day: 'numeric', ...(withYear && !sameYear ? { year: 'numeric' } : {}) })
}

export function recordWhenText(r, today) {
  if (!r.end) return ''
  if (r.start === r.end) {
    if (r.end === today) return 'Set today'
    if (r.end === addGameDays(today, -1)) return 'Set yesterday'
    return `Set ${recordDayText(r.end, today, true)}`
  }
  return `${recordDayText(r.start, today)} to ${recordDayText(r.end, today, true)}`
}

// Just the distance to the record: "+468K XP to beat it".
export function recordGapText(r) {
  const c = r.current
  if (!c) return ''
  if (c.value >= r.value) return 'Record in progress, keep going'
  const gap = r.value - c.value + 1
  return r.unit === 'xp' ? `+${formatXp(gap)} XP to beat it` : `${gap} more to beat it`
}

// How far off the record you are, in the record's own unit.
export function recordChaseText(r) {
  const c = r.current
  if (!c) return ''
  if (c.value >= r.value) return r.key === 'longest-streak' ? 'Streak record in progress' : 'Record in progress, keep going'
  const gap = r.value - c.value + 1
  if (r.key === 'longest-streak') return `${c.value} ${c.value === 1 ? 'day' : 'days'} now, ${gap} more to beat it`
  if (r.unit === 'xp') return `${formatXp(c.value)} ${c.label}, +${formatXp(gap)} to beat it`
  return `${c.value} ${c.label}, ${gap} more to beat it`
}
