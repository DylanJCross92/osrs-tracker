import crypto from 'node:crypto'
import { pool } from '../db.js'
import { getPlayer } from './players.service.js'
import { SKILL_NAMES } from './osrsHiscores.service.js'
import { localDay, addDays, diffDays, weekdayShort } from '../utils/dates.js'

const DAY_MS = 86_400_000

export function isValidCardSkill(skill) {
  return skill === 'Overall' || SKILL_NAMES.includes(skill)
}


/**
 * Everything on a card beyond the headline number: a per-day xp series for
 * the chart, how this period compares with the one before it, and whether it
 * beat every earlier week. Comparisons only run for a full 7-day card —
 * a 3-day partial period has nothing fair to compare against.
 */
async function computeExtras(playerId, skill, startIso, endIso, xpGained) {
  const result = await pool.query(
    `SELECT captured_at,
            CASE WHEN $2::text = 'Overall' THEN overall_xp ELSE (skills->$2::text->>'xp')::bigint END AS xp
     FROM snapshots WHERE player_id = $1 ORDER BY captured_at ASC`,
    [playerId, skill],
  )
  const series = result.rows.map((r) => ({ t: new Date(r.captured_at).getTime(), xp: Number(r.xp) }))
  if (!series.length) return { daily: null, comparison: null }

  // Last snapshot at or before t (null if t predates all data).
  const xpAt = (t) => {
    let lo = 0
    let hi = series.length - 1
    let found = null
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (series[mid].t <= t) {
        found = series[mid].xp
        lo = mid + 1
      } else hi = mid - 1
    }
    return found
  }
  // Like xpAt, but a window that starts just after the first snapshot still
  // counts — the history simply begins a little late.
  const baseAt = (t) => xpAt(t) ?? (series[0].t <= t + 1.5 * DAY_MS ? series[0].xp : null)

  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()

  // Daily xp for the chart: each local day's gain = its last snapshot minus the previous day's.
  let daily = null
  const firstDay = localDay(start)
  const lastDay = localDay(end)
  const spanDays = diffDays(firstDay, lastDay) + 1
  if (spanDays >= 2) {
    const lastXpOfDay = new Map()
    for (const p of series) {
      if (p.t >= start && p.t <= end) lastXpOfDay.set(localDay(p.t), p.xp)
    }
    let carry = xpAt(start) ?? series[0].xp
    const days = []
    for (let i = 0; i < spanDays; i++) {
      const day = addDays(firstDay, i)
      const next = lastXpOfDay.has(day) ? lastXpOfDay.get(day) : carry
      days.push({ date: day, label: weekdayShort(day), xp: Math.max(next - carry, 0) })
      carry = next
    }
    daily = days.slice(-7)
  }

  // Previous-period comparison + personal best, full-week cards only.
  let comparison = null
  if (spanDays >= 7) {
    const gains = []
    for (let j = 1; j <= 52; j++) {
      const endT = start - 7 * (j - 1) * DAY_MS
      const beginT = start - 7 * j * DAY_MS
      const e = j === 1 ? xpAt(start) : xpAt(endT)
      const b = baseAt(beginT)
      if (e == null || b == null) break
      gains.push(e - b)
    }
    const prev = gains[0]
    if (prev != null) {
      const bestPrior = gains.length >= 3 ? Math.max(...gains) : null
      comparison = {
        prevXp: prev,
        pct: prev > 0 ? Math.round(((xpGained - prev) / prev) * 100) : null,
        personalBest: bestPrior != null && xpGained > 0 && xpGained > bestPrior,
      }
    }
  }

  return { daily, comparison }
}

/**
 * Live weekly gain data for a player over the trailing 7 days, for whichever
 * skill is selected (default 'Overall'). Mirrors the same baseline pattern
 * used for the homepage's "week" gains, but scoped to one player. Returns
 * null if the player has no data at all yet.
 *
 * 'Overall' mode returns { xpGained, topSkills: [{skill, xp}, ...] } (up to
 * the top 3 skills gained that week) — a single-skill mode returns
 * { xpGained, level, levelGained, rankGained } for that skill specifically.
 */
export async function getWeeklyCardData(playerId, skill = 'Overall') {
  if (!isValidCardSkill(skill)) skill = 'Overall'

  const player = await getPlayer(playerId)
  if (!player) return null

  const result = await pool.query(
    `
    WITH latest AS (
      SELECT overall_xp, skills, captured_at
      FROM snapshots WHERE player_id = $1
      ORDER BY captured_at DESC LIMIT 1
    ),
    baseline AS (
      (
        SELECT overall_xp, skills, captured_at
        FROM snapshots
        WHERE player_id = $1 AND captured_at >= now() - interval '7 days'
        ORDER BY captured_at ASC LIMIT 1
      )
      UNION ALL
      (
        SELECT overall_xp, skills, captured_at
        FROM snapshots WHERE player_id = $1
        ORDER BY captured_at ASC LIMIT 1
      )
      LIMIT 1
    )
    SELECT latest.overall_xp, latest.skills, latest.captured_at,
           baseline.overall_xp AS baseline_overall_xp, baseline.skills AS baseline_skills,
           baseline.captured_at AS baseline_captured_at
    FROM latest, baseline
    `,
    [playerId],
  )
  if (result.rowCount === 0) return null

  const row = result.rows[0]
  const base = {
    username: player.username,
    displayName: player.displayName,
    skill,
    periodStart: row.baseline_captured_at,
    periodEnd: row.captured_at,
  }

  if (skill === 'Overall') {
    const xpGained = Number(row.overall_xp) - Number(row.baseline_overall_xp)

    const gains = Object.entries(row.skills || {}).map(([name, s]) => {
      const prevXp = row.baseline_skills?.[name]?.xp ?? s.xp
      return {
        skill: name,
        xp: s.xp - prevXp,
        levelStart: row.baseline_skills?.[name]?.level ?? s.level,
        levelEnd: s.level,
      }
    })
    gains.sort((a, b) => b.xp - a.xp)
    const topSkills = gains.filter((g) => g.xp > 0).slice(0, 3)

    const extras = await computeExtras(playerId, 'Overall', row.baseline_captured_at, row.captured_at, xpGained)
    return { ...base, xpGained, topSkills, ...extras }
  }

  const current = row.skills?.[skill] ?? { xp: 0, level: 1, rank: null }
  const baseline = row.baseline_skills?.[skill] ?? current
  const xpGained = current.xp - baseline.xp
  const levelGained = current.level - baseline.level
  const rankGained = current.rank != null && baseline.rank != null ? baseline.rank - current.rank : null

  const extras = await computeExtras(playerId, skill, row.baseline_captured_at, row.captured_at, xpGained)
  return { ...base, xpGained, level: current.level, levelStart: baseline.level, levelGained, rankGained, ...extras }
}

/**
 * Freezes the player's current weekly numbers (for the given skill) into a
 * permanent, shareable record — the slug's data never changes after this,
 * even as the player's real "last 7 days" moves on. Returns null if there's
 * nothing to share yet.
 */
export async function freezeWeeklyCard(playerId, skill = 'Overall') {
  const data = await getWeeklyCardData(playerId, skill)
  if (!data) return null

  const slug = crypto.randomBytes(6).toString('base64url')
  await pool.query(
    `INSERT INTO shared_cards (slug, player_id, card_type, payload) VALUES ($1, $2, 'weekly', $3)`,
    [slug, playerId, JSON.stringify(data)],
  )
  return { slug, ...data }
}

/** Fetches a previously frozen card by its slug, or null if it doesn't exist. */
export async function getFrozenCard(slug) {
  const result = await pool.query(
    `SELECT sc.slug, sc.card_type, sc.payload, sc.created_at, p.username, p.display_name
     FROM shared_cards sc
     JOIN players p ON p.id = sc.player_id
     WHERE sc.slug = $1`,
    [slug],
  )
  if (result.rowCount === 0) return null

  const row = result.rows[0]
  return {
    slug: row.slug,
    cardType: row.card_type,
    createdAt: row.created_at,
    username: row.username,
    displayName: row.display_name,
    ...row.payload,
  }
}
