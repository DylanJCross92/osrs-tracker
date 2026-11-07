import { pool } from '../db.js'
import { listPlayers } from './players.service.js'
import { MAX_TOTAL_LEVEL } from './milestones.service.js'

function card(p, featured = null) {
  const skills = p.latest?.skills || {}
  const entries = Object.entries(skills)
  const highest = entries.sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp)[0]
  return {
    id: p.id,
    username: p.username,
    displayName: p.displayName,
    badge: p.badge,
    overallLevel: p.latest?.overallLevel ?? null,
    overallXp: p.latest?.overallXp ?? null,
    overallRank: p.latest?.overallRank ?? null,
    featured: featured || (highest ? { kind: 'skill', skill: highest[0], text: `Level ${highest[1].level} ${highest[0]}` } : null),
  }
}

const gainText = (g) => (g ? { kind: 'gain', skill: g.topSkill, xp: g.xp, text: `+${Math.round(g.xp).toLocaleString()} XP` } : null)

/** Public discovery sections, derived from the same data the player list already loads. */
export async function getDiscover() {
  const players = (await listPlayers()).filter((p) => p.latest)

  const recentlyTracked = [...players].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8).map((p) => card(p))

  const gainsBy = (period) =>
    players
      .filter((p) => p.gains?.[period]?.xp > 0)
      .sort((a, b) => b.gains[period].xp - a.gains[period].xp)
      .slice(0, 8)
      .map((p) => card(p, gainText(p.gains[period])))

  const approachingMax = players
    .filter((p) => p.latest.overallLevel < MAX_TOTAL_LEVEL)
    .sort((a, b) => b.latest.overallLevel - a.latest.overallLevel)
    .slice(0, 8)
    .map((p) => {
      const left = Object.values(p.latest.skills).filter((s) => s.level < 99).length
      return card(p, { kind: 'progress', text: `${left} skill${left === 1 ? '' : 's'} from 99` })
    })

  const recent99Rows = await pool.query(
    `SELECT DISTINCT ON (player_id) player_id, skill, occurred_at
     FROM player_milestones
     WHERE milestone_type = 'skill_level' AND value = 99 AND occurred_at IS NOT NULL
     ORDER BY player_id, occurred_at DESC`,
  )
  const byId = new Map(players.map((p) => [p.id, p]))
  const recent99 = recent99Rows.rows
    .filter((r) => byId.has(r.player_id))
    .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
    .slice(0, 8)
    .map((r) => card(byId.get(r.player_id), { kind: 'milestone', skill: r.skill, text: `99 ${r.skill}`, at: r.occurred_at }))

  return { recentlyTracked, recent99, topWeek: gainsBy('week'), topMonth: gainsBy('month'), approachingMax }
}

/** Case-insensitive partial RSN match among tracked players. */
export async function searchPlayers(rawQuery) {
  const q = String(rawQuery || '').trim().slice(0, 12)
  if (q.length < 2) return []
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`)
  const { rows } = await pool.query(
    `SELECT p.username, p.display_name, p.badge, s.overall_level
     FROM players p
     LEFT JOIN LATERAL (SELECT overall_level FROM snapshots WHERE player_id = p.id ORDER BY captured_at DESC LIMIT 1) s ON true
     WHERE p.username ILIKE $1 ESCAPE '\\'
     ORDER BY (lower(p.username) = lower($2)) DESC, (p.username ILIKE $3 ESCAPE '\\') DESC, p.username ASC
     LIMIT 8`,
    [`%${escaped}%`, q, `${escaped}%`],
  )
  return rows.map((r) => ({ username: r.username, displayName: r.display_name, badge: r.badge, overallLevel: r.overall_level }))
}
