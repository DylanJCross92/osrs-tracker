import { SKILL_NAMES } from '@/utils/osrsSkills'

// The big moments in a character's history, worked out from its saved XP snapshots: the first 1M and 5M XP in a skill, being halfway to
// 99 (level 92, which is half of the XP), 99, and 200M. Each one is dated by the first snapshot that has the XP; when the snapshot before
// it is days earlier, the moment is only known to be somewhere in between (`gap`).

export const XP_HALF = 6_517_253 // level 92, half of the XP for 99
export const XP_99 = 13_034_431

// Biggest first. `rank` is used to sort a day's moments and to size the marks on the chart.
export const HIGHLIGHT_KINDS = [
  { key: 'l99', xp: XP_99, short: '99', label: 'Level 99', rank: 4 },
  { key: 'xp200m', xp: 200_000_000, short: '200M', label: '200M XP', rank: 5 },
  { key: 'half', xp: XP_HALF, short: '92', label: 'Halfway to 99', rank: 3 },
  { key: 'xp5m', xp: 5_000_000, short: '5M', label: '5M XP', rank: 2 },
  { key: 'xp1m', xp: 1_000_000, short: '1M', label: '1M XP', rank: 1 },
]

const GAP_MS = 48 * 3_600_000

export function highlightTitle(skill, kind) {
  switch (kind) {
    case 'l99':
      return `${skill} level 99`
    case 'half':
      return `${skill} halfway to 99 (level 92)`
    case 'xp200m':
      return `${skill} 200M XP`
    case 'xp5m':
      return `${skill} 5M XP`
    default:
      return `${skill} 1M XP`
  }
}

/**
 * snapshots: oldest first, each { capturedAt, overallXp, skills: { Name: { xp } } }.
 * Returns { events, before }: `events` are the moments seen happening (newest first), `before` are the ones already reached in the very
 * first snapshot, whose date is not known.
 */
export function skillHighlights(snapshots, skills = SKILL_NAMES) {
  const list = Array.isArray(snapshots) ? snapshots : []
  const events = []
  const before = []
  if (!list.length) return { events, before }
  for (const skill of skills) {
    for (const k of HIGHLIGHT_KINDS) {
      const first = list.findIndex((s) => (s.skills?.[skill]?.xp ?? 0) >= k.xp)
      if (first < 0) continue
      const base = { id: `${skill}:${k.key}`, skill, kind: k.key, short: k.short, label: k.label, rank: k.rank, title: highlightTitle(skill, k.key) }
      if (first === 0) {
        before.push(base)
        continue
      }
      const at = list[first].capturedAt
      const after = list[first - 1].capturedAt
      events.push({ ...base, at, after, atMs: new Date(at).getTime(), totalXp: Number(list[first].overallXp) || 0, gap: new Date(at) - new Date(after) > GAP_MS })
    }
  }
  events.sort((a, b) => b.atMs - a.atMs || b.rank - a.rank)
  return { events, before }
}

/** The total XP line for the chart: [{ x: ms, y: xp }] oldest first, never going down, thinned to about `max` points. */
export function journeyPoints(snapshots, max = 260) {
  const list = (Array.isArray(snapshots) ? snapshots : []).filter((s) => Number.isFinite(Number(s.overallXp)))
  let best = 0
  const pts = list.map((s) => {
    best = Math.max(best, Number(s.overallXp))
    return { x: new Date(s.capturedAt).getTime(), y: best }
  })
  if (pts.length <= max) return pts
  const step = (pts.length - 1) / (max - 1)
  const out = []
  for (let i = 0; i < max; i++) out.push(pts[Math.round(i * step)])
  return out
}

/**
 * Where marks sit along a row so they never overlap: each mark goes in the first lane whose last mark is far enough to its left.
 * xs: pixel positions, in the order the marks should be placed. Returns the lane number of each, and how many lanes were used.
 */
export function assignLanes(xs, gap) {
  const last = []
  const lanes = xs.map((x) => {
    let lane = last.findIndex((l) => x - l >= gap)
    if (lane < 0) lane = last.length
    last[lane] = x
    return lane
  })
  return { lanes, count: last.length }
}
