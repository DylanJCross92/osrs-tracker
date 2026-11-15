import { plain } from './clans.js'

// Scoring and validation for clan competitions. A competition is "who gained the most XP between two moments", in one skill
// or overall. Everything here is pure: the database and the hiscores are handled by the service.
export const MIN_HOURS = 1
export const MAX_DAYS = 60
export const MAX_AHEAD_DAYS = 90
export const TITLE_MAX = 60
// Someone who joins within this long of the start is treated as there from the beginning.
export const LATE_GRACE_MS = 5 * 60_000
// If the hiscores cannot be reached when a competition ends, final numbers are taken as soon as they can be, up to this long
// after the end; past it the best numbers on hand are used.
export const FINALIZE_DEADLINE_MS = 30 * 60_000

export const METRICS = ['skill_xp', 'overall_xp']
const HOUR = 3_600_000
const DAY = 24 * HOUR

/** XP in the competition's metric from a snapshot-shaped object ({ overallXp, skills: { Mining: { xp } } }). */
export function metricValue(metric, skill, snap) {
  if (!snap) return null
  if (metric === 'overall_xp') return Number.isFinite(Number(snap.overallXp)) ? Number(snap.overallXp) : null
  const xp = Number(snap.skills?.[skill]?.xp)
  // A skill the hiscores leave out (unranked) has gained nothing yet.
  return Number.isFinite(xp) && xp >= 0 ? xp : 0
}

/**
 * Checks a new competition's body. Returns { ok: true, value: { title, metric, skill, startsAt, endsAt } } (dates as Date) or
 * { ok: false, error }. A start in the recent past means "now"; the end must be at least an hour later and within 60 days.
 */
export function cleanCompetitionInput(body, skillNames, now = new Date()) {
  const title = plain(body?.title, TITLE_MAX)
  if (title.length < 3) return { ok: false, error: 'Give the competition a title of at least 3 characters.' }
  const metric = body?.metric
  if (!METRICS.includes(metric)) return { ok: false, error: 'Choose what is being measured.' }
  let skill = ''
  if (metric === 'skill_xp') {
    skill = typeof body?.skill === 'string' ? body.skill : ''
    if (!skillNames.includes(skill) || skill === 'Overall') return { ok: false, error: 'Choose a skill.' }
  }
  if (typeof body?.startsAt !== 'string' || typeof body?.endsAt !== 'string') return { ok: false, error: 'Choose a start and an end time.' }
  let startsAt = new Date(body.startsAt)
  const endsAt = new Date(body.endsAt)
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return { ok: false, error: 'Those times were not understood.' }
  if (startsAt.getTime() < now.getTime() - 5 * 60_000) return { ok: false, error: 'The start has already passed. Pick a time from now on.' }
  if (startsAt < now) startsAt = new Date(now)
  if (startsAt.getTime() > now.getTime() + MAX_AHEAD_DAYS * DAY) return { ok: false, error: `Start within the next ${MAX_AHEAD_DAYS} days.` }
  if (endsAt.getTime() - startsAt.getTime() < MIN_HOURS * HOUR) return { ok: false, error: `A competition has to run for at least ${MIN_HOURS} hour.` }
  if (endsAt.getTime() - startsAt.getTime() > MAX_DAYS * DAY) return { ok: false, error: `A competition can run for at most ${MAX_DAYS} days.` }
  return { ok: true, value: { title, metric, skill, startsAt, endsAt } }
}

/** Where a competition is by the clock: 'scheduled', 'running' or 'ended'. */
export function competitionPhase(c, now = Date.now()) {
  if (now < new Date(c.startsAt).getTime()) return 'scheduled'
  return now < new Date(c.endsAt).getTime() ? 'running' : 'ended'
}

/**
 * The standing: everyone's gain, biggest first, with the rank (ties share a rank, "1, 2, 2, 4"), the gap to the player above
 * and whether they joined late. `members`: [{ playerId, username, displayName, startXp, endXp, currentXp, joinedAt }]. The
 * value counted is the end XP when the competition is over, otherwise the current XP. Entrants whose start has not been taken
 * yet rank last with a gain of nothing and `pending: true`.
 */
export function standings(members, { startsAt }) {
  const rows = (members || []).map((m) => {
    const start = m.startXp == null ? null : Number(m.startXp)
    const now = m.endXp != null ? Number(m.endXp) : m.currentXp != null ? Number(m.currentXp) : null
    const pending = start == null || now == null
    return {
      playerId: m.playerId,
      username: m.username,
      displayName: m.displayName,
      startXp: start,
      currentXp: now,
      gain: pending ? 0 : Math.max(now - start, 0),
      pending,
      joinedLate: new Date(m.joinedAt).getTime() > new Date(startsAt).getTime() + LATE_GRACE_MS,
    }
  })
  rows.sort((a, b) => Number(a.pending) - Number(b.pending) || b.gain - a.gain || String(a.username).toLowerCase().localeCompare(String(b.username).toLowerCase()))
  let lastGain = null
  let lastRank = 0
  return rows.map((r, i) => {
    const rank = lastGain !== null && r.gain === lastGain && !r.pending ? lastRank : i + 1
    lastGain = r.gain
    lastRank = rank
    return { ...r, rank, gapToAbove: i === 0 ? null : rows[i - 1].gain - r.gain }
  })
}

/** What is stored when a competition finishes: the final standing, with no live fields. */
export function freezeResults(rows) {
  return rows.map((r) => ({ playerId: r.playerId, username: r.username, displayName: r.displayName, rank: r.rank, gain: r.gain, startXp: r.startXp, endXp: r.currentXp, joinedLate: r.joinedLate, pending: r.pending }))
}

/** The winner or winners (a tie for first), from standings or frozen results. A competition nobody gained in has none. */
export const winnersOf = (rows) => rows.filter((r) => r.rank === 1 && r.gain > 0 && !r.pending)

/** What a competition measures, in words: "Mining XP" or "Overall XP". */
export const metricLabel = (c) => (c.metric === 'overall_xp' ? 'Overall XP' : `${c.skill} XP`)
