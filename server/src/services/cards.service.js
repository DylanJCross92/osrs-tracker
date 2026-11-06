import crypto from 'node:crypto'
import { pool } from '../db.js'
import { getPlayer } from './players.service.js'
import { SKILL_NAMES } from './osrsHiscores.service.js'

export function isValidCardSkill(skill) {
  return skill === 'Overall' || SKILL_NAMES.includes(skill)
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
      return { skill: name, xp: s.xp - prevXp }
    })
    gains.sort((a, b) => b.xp - a.xp)
    const topSkills = gains.filter((g) => g.xp > 0).slice(0, 3)

    return { ...base, xpGained, topSkills }
  }

  const current = row.skills?.[skill] ?? { xp: 0, level: 1, rank: null }
  const baseline = row.baseline_skills?.[skill] ?? current
  const xpGained = current.xp - baseline.xp
  const levelGained = current.level - baseline.level
  const rankGained = current.rank != null && baseline.rank != null ? baseline.rank - current.rank : null

  return { ...base, xpGained, level: current.level, levelGained, rankGained }
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
