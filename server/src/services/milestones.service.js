import { pool } from '../db.js'
import crypto from 'node:crypto'
import { SKILL_NAMES } from './osrsHiscores.service.js'
import { addNotification, followersOfPlayer, ownerOfPlayer } from './inbox.service.js'

// Achievements are defined here in code (version-controlled, no registration
// or manual awarding) and evaluated against recorded snapshots. What is
// persisted is the *milestone*, the first moment a threshold was seen, so
// pages never recompute history and dates are never invented.

export const SKILL_LEVEL_TARGETS = [50, 70, 90, 99]
export const SKILL_XP_TARGETS = [10_000_000, 25_000_000, 50_000_000, 100_000_000, 200_000_000]
export const MAX_TOTAL_LEVEL = SKILL_NAMES.length * 99
export const TOTAL_LEVEL_TARGETS = [500, 1000, 1500, 2000, 2200, MAX_TOTAL_LEVEL]
export const TOTAL_XP_TARGETS = [10_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000, 1_000_000_000, 2_000_000_000]

const fmtXp = (n) => (n >= 1e9 ? `${n / 1e9}B` : `${n / 1e6}M`)

/** Every achievement definition: { key, category, type, skill, value, title, description }. */
export function achievementDefinitions() {
  const defs = []
  for (const skill of SKILL_NAMES) {
    for (const value of SKILL_LEVEL_TARGETS) {
      defs.push({ key: `skill_level:${skill}:${value}`, category: 'Skill Levels', type: 'skill_level', skill, value, title: `${value} ${skill}`, description: `Reach level ${value} ${skill}.` })
    }
  }
  for (const skill of SKILL_NAMES) {
    for (const value of SKILL_XP_TARGETS) {
      defs.push({ key: `skill_xp:${skill}:${value}`, category: 'Skill XP', type: 'skill_xp', skill, value, title: `${fmtXp(value)} ${skill} XP`, description: `Earn ${fmtXp(value)} XP in ${skill}.` })
    }
  }
  for (const value of TOTAL_LEVEL_TARGETS) {
    const isMax = value === MAX_TOTAL_LEVEL
    defs.push({ key: `total_level::${value}`, category: 'Overall', type: 'total_level', skill: '', value, title: isMax ? `Maxed (${value.toLocaleString('en-US')} Overall)` : `${value.toLocaleString('en-US')} Overall`, description: `Reach ${value.toLocaleString('en-US')} Overall.` })
  }
  for (const value of TOTAL_XP_TARGETS) {
    defs.push({ key: `total_xp::${value}`, category: 'Total XP', type: 'total_xp', skill: '', value, title: `${fmtXp(value)} Total XP`, description: `Earn ${fmtXp(value)} total XP.` })
  }
  return defs
}

// Value of a milestone's metric inside one snapshot-shaped object.
function metric(type, skill, snap) {
  if (type === 'total_level') return snap.overallLevel
  if (type === 'total_xp') return snap.overallXp
  const s = snap.skills?.[skill]
  if (!s) return 0
  return type === 'skill_level' ? s.level : s.xp
}

// News worth a notification: 99s, 200M XP, and the big overall marks. Smaller steps stay on the profile and in the feed.
const FRESH_MS = 3 * 86_400_000
export const isNotable = (d) =>
  (d.type === 'skill_level' && d.value === 99) ||
  (d.type === 'skill_xp' && d.value >= 200_000_000) ||
  (d.type === 'total_level' && d.value >= 2000) ||
  (d.type === 'total_xp' && d.value >= 1_000_000_000)

/** Tells the profile's owner ("You reached...") and everyone following it ("<Name> reached...") about new milestones. */
export async function fanOutMilestones(playerId, defs) {
  const { rows } = await pool.query('SELECT username, display_name FROM players WHERE id = $1', [playerId])
  if (!rows[0]) return
  const { username, display_name: name } = rows[0]
  const link = `/player/${encodeURIComponent(username)}`
  const ownerId = await ownerOfPlayer(playerId)
  const followers = (await followersOfPlayer(playerId)).filter((id) => id !== ownerId)
  for (const d of defs) {
    const key = `milestone:${playerId}:${d.key}`
    if (ownerId) await addNotification(ownerId, { type: 'milestone', text: `You reached ${d.title}!`, link, dedupeKey: key, subject: username })
    for (const id of followers) await addNotification(id, { type: 'follow_milestone', text: `${name} reached ${d.title}`, link, dedupeKey: key, subject: username })
  }
}

const defKey = (d) => `${d.type}|${d.skill}|${d.value}`

/**
 * Idempotently records any milestones a player has reached but not yet
 * stored, using the earliest snapshot that shows each one. Cheap when
 * nothing is missing (latest snapshot + stored keys only); loads the full
 * history only when something new appeared. Safe to call after every
 * snapshot, WOM import, or on a backfill loop.
 */
export async function syncMilestones(playerId) {
  const latestRes = await pool.query(
    `SELECT overall_xp, overall_level, skills FROM snapshots WHERE player_id = $1 ORDER BY captured_at DESC LIMIT 1`,
    [playerId],
  )
  if (!latestRes.rowCount) return 0
  const latest = { overallXp: Number(latestRes.rows[0].overall_xp), overallLevel: latestRes.rows[0].overall_level, skills: latestRes.rows[0].skills }

  const storedRes = await pool.query('SELECT milestone_type, skill, value, occurred_at FROM player_milestones WHERE player_id = $1', [playerId])
  const stored = new Map(storedRes.rows.map((r) => [`${r.milestone_type}|${r.skill}|${Number(r.value)}`, r.occurred_at]))

  // Missing, or stored without a date (might be datable now that older history exists).
  const todo = achievementDefinitions().filter((d) => metric(d.type, d.skill, latest) >= d.value && (!stored.has(defKey(d)) || stored.get(defKey(d)) === null))
  if (!todo.length) return 0

  const snapsRes = await pool.query(
    `SELECT captured_at, overall_xp, overall_level, skills FROM snapshots WHERE player_id = $1 ORDER BY captured_at ASC`,
    [playerId],
  )
  const snaps = snapsRes.rows.map((r) => ({ at: r.captured_at, overallXp: Number(r.overall_xp), overallLevel: r.overall_level, skills: r.skills }))
  const earliest = snaps[0]

  const rows = []
  for (const d of todo) {
    const first = snaps.find((s) => metric(d.type, d.skill, s) >= d.value)
    if (!first) continue
    // Already true in the very first snapshot = achieved before tracking; the date is unknown.
    rows.push({ d, occurredAt: first === earliest ? null : first.at })
  }
  let written = 0
  const fresh = []
  for (const { d, occurredAt } of rows) {
    const res = await pool.query(
      `INSERT INTO player_milestones (player_id, milestone_type, skill, value, occurred_at, source)
       VALUES ($1, $2, $3, $4, $5, 'snapshot')
       ON CONFLICT (player_id, milestone_type, skill, value)
       DO UPDATE SET occurred_at = EXCLUDED.occurred_at WHERE player_milestones.occurred_at IS NULL AND EXCLUDED.occurred_at IS NOT NULL
       RETURNING (xmax = 0) AS inserted`,
      [playerId, d.type, d.skill, d.value, occurredAt],
    )
    written += res.rowCount
    // Only a brand-new row with a real, recent date is news (not history being filled in).
    if (res.rows[0]?.inserted && occurredAt && Date.now() - new Date(occurredAt).getTime() < FRESH_MS && isNotable(d)) fresh.push(d)
  }
  if (fresh.length) fanOutMilestones(playerId, fresh).catch((err) => console.error('[milestones] notify failed:', err.message))
  return written
}

/** Fire-and-forget wrapper for hooks, a milestone failure must never break a snapshot. */
export function syncMilestonesSafe(playerId) {
  syncMilestones(playerId).catch((err) => console.error(`[milestones] sync failed for player ${playerId}:`, err.message))
}

/** Startup backfill for players tracked before milestones existed. */
export async function backfillAllMilestones() {
  const { rows } = await pool.query('SELECT id FROM players ORDER BY id ASC')
  for (const { id } of rows) {
    try {
      await syncMilestones(id)
    } catch (err) {
      console.error(`[milestones] backfill failed for player ${id}:`, err.message)
    }
  }
}

function currentValueFor(def, latest) {
  return metric(def.type, def.skill, latest)
}

/** Profile payload: every achievement with status/progress/date, plus the timeline. */
export async function getProfileAchievements(playerId) {
  const [latestRes, milestonesRes, firstRes] = await Promise.all([
    pool.query(`SELECT overall_xp, overall_level, skills FROM snapshots WHERE player_id = $1 ORDER BY captured_at DESC LIMIT 1`, [playerId]),
    // occurred_after = the last snapshot BEFORE the one that first showed the
    // milestone. A wide gap between the two means the real date is only known
    // to be somewhere inside it (e.g. sparse imported history).
    pool.query(
      `SELECT m.milestone_type, m.skill, m.value, m.occurred_at, m.detected_at, m.source,
              (SELECT MAX(s.captured_at) FROM snapshots s WHERE s.player_id = m.player_id AND s.captured_at < m.occurred_at) AS occurred_after
       FROM player_milestones m WHERE m.player_id = $1`,
      [playerId],
    ),
    pool.query('SELECT MIN(captured_at) AS first FROM snapshots WHERE player_id = $1', [playerId]),
  ])
  const latest = latestRes.rows[0]
    ? { overallXp: Number(latestRes.rows[0].overall_xp), overallLevel: latestRes.rows[0].overall_level, skills: latestRes.rows[0].skills }
    : { overallXp: 0, overallLevel: 0, skills: {} }
  const byKey = new Map(milestonesRes.rows.map((r) => [`${r.milestone_type}|${r.skill}|${Number(r.value)}`, r]))

  const achievements = achievementDefinitions().map((d) => {
    const current = currentValueFor(d, latest)
    const m = byKey.get(defKey(d))
    return {
      key: d.key,
      category: d.category,
      type: d.type,
      skill: d.skill,
      value: d.value,
      title: d.title,
      description: d.description,
      current,
      progress: Math.min(current / d.value, 1),
      completed: Boolean(m) || current >= d.value,
      achievedAt: m?.occurred_at || null,
      dateKnown: Boolean(m?.occurred_at),
    }
  })

  const timeline = milestonesRes.rows
    .map((r) => {
      const d = achievementDefinitions().find((x) => x.type === r.milestone_type && x.skill === r.skill && x.value === Number(r.value))
      return { key: d?.key, title: d?.title, description: d?.description, category: d?.category, type: r.milestone_type, skill: r.skill, value: Number(r.value), occurredAt: r.occurred_at, occurredAfter: r.occurred_after, detectedAt: r.detected_at, source: r.source }
    })
    .filter((t) => t.key)

  return { achievements, timeline, trackingStartedAt: firstRes.rows[0]?.first || null }
}

// --- Congratulations -----------------------------------------------------------------------------------------

// Only big, fresh moments are celebrated: a new 99 or 200M XP in a skill seen in the last 7 days.
const CELEBRATION_DAYS = 7
const celebrationWhere = `((m.milestone_type = 'skill_level' AND m.value = 99) OR (m.milestone_type = 'skill_xp' AND m.value = 200000000))
  AND m.occurred_at IS NOT NULL AND m.occurred_at >= now() - interval '${CELEBRATION_DAYS} days'`

/** Anonymous visitor id: a salted hash of the IP, so repeat clicks can be blocked without storing the address. */
export function visitorHash(ip) {
  return crypto.createHash('sha256').update(`${process.env.CHEER_SALT || 'tickgains-cheer'}|${ip || ''}`).digest('hex').slice(0, 32)
}

/** Recent 99s / 200M milestones for a player, with congratulation counts and whether this visitor already clicked. */
export async function getCelebrations(playerId, visitor) {
  const { rows } = await pool.query(
    `SELECT m.milestone_type, m.skill, m.value, m.occurred_at,
            (SELECT COUNT(*)::int FROM milestone_cheers c WHERE c.player_id = m.player_id AND c.milestone_type = m.milestone_type AND c.skill = m.skill AND c.value = m.value) AS cheers,
            EXISTS (SELECT 1 FROM milestone_cheers c WHERE c.player_id = m.player_id AND c.milestone_type = m.milestone_type AND c.skill = m.skill AND c.value = m.value AND c.visitor_hash = $2) AS cheered
     FROM player_milestones m
     WHERE m.player_id = $1 AND ${celebrationWhere}
     ORDER BY m.occurred_at DESC`,
    [playerId, visitor || ''],
  )
  const defs = achievementDefinitions()
  return rows.map((r) => {
    const d = defs.find((x) => x.type === r.milestone_type && x.skill === r.skill && x.value === Number(r.value))
    return {
      type: r.milestone_type,
      skill: r.skill,
      value: Number(r.value),
      title: d?.title || `${r.value} ${r.skill}`,
      occurredAt: r.occurred_at,
      cheers: r.cheers,
      cheered: r.cheered,
    }
  })
}

/** Record one congratulation. Returns the new count, or null if that milestone is not currently celebrated. */
export async function addCheer(playerId, { type, skill, value }, visitor) {
  const { rows } = await pool.query(
    `SELECT 1 FROM player_milestones m WHERE m.player_id = $1 AND m.milestone_type = $2 AND m.skill = $3 AND m.value = $4 AND ${celebrationWhere}`,
    [playerId, type, skill || '', value],
  )
  if (!rows.length) return null
  await pool.query(
    `INSERT INTO milestone_cheers (player_id, milestone_type, skill, value, visitor_hash) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    [playerId, type, skill || '', value, visitor],
  )
  const count = await pool.query(
    `SELECT COUNT(*)::int AS n FROM milestone_cheers WHERE player_id = $1 AND milestone_type = $2 AND skill = $3 AND value = $4`,
    [playerId, type, skill || '', value],
  )
  return count.rows[0].n
}
