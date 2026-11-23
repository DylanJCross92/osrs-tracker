import { pool } from '../db.js'
import { getLatestSnapshot } from './players.service.js'
import { SKILL_NAMES } from './osrsHiscores.service.js'
import { XP_99 as XP_99_TOTAL } from '../utils/xp.js'

const XP_99 = XP_99_TOTAL

/** The skill as the game writes it ("agility" -> "Agility"), or null when it is not one. */
export const matchSkill = (raw) => SKILL_NAMES.find((n) => n.toLowerCase() === String(raw || '').trim().toLowerCase()) || null

/**
 * What the level 99 card shows, or null when the player does not have 99 in that skill (a card is never drawn for one they have
 * not earned): { displayName, skill, xp, rank, reachedAt }.
 */
export async function getLevel99Card(player, rawSkill, { preview = false } = {}) {
  const skill = matchSkill(rawSkill)
  if (!skill) return null
  const latest = await getLatestSnapshot(player.id)
  const s = latest?.skills?.[skill]
  // Development only (the production image sets NODE_ENV=production): a preview of the card for a skill that is not 99 yet.
  if (preview && process.env.NODE_ENV !== 'production') {
    return { displayName: player.displayName, skill, xp: Math.max(Number(s?.xp) || 0, XP_99), rank: s?.rank > 0 ? s.rank : null, reachedAt: new Date() }
  }
  if (!s || !(s.level >= 99 || s.xp >= XP_99)) return null
  const { rows } = await pool.query(`SELECT occurred_at FROM player_milestones WHERE player_id = $1 AND milestone_type = 'skill_level' AND skill = $2 AND value = 99`, [player.id, skill])
  return { displayName: player.displayName, skill, xp: s.xp, rank: s.rank > 0 ? s.rank : null, reachedAt: rows[0]?.occurred_at || null }
}
