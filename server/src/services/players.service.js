import { pool } from '../db.js'
import { fetchHiscores } from './osrsHiscores.service.js'

// Total xp gained since the baseline snapshot, plus whichever single skill
// gained the most of it — null if there's nothing to compare against yet
// (a brand-new player with only one snapshot).
function computeTodayGain(row) {
  if (!row.captured_at || !row.baseline_captured_at || row.captured_at.getTime() === row.baseline_captured_at.getTime()) {
    return null
  }

  const xp = Number(row.overall_xp) - Number(row.baseline_overall_xp)
  let topSkill = null
  let topSkillXp = 0
  for (const [name, skill] of Object.entries(row.skills || {})) {
    const prevXp = row.baseline_skills?.[name]?.xp ?? skill.xp
    const gained = skill.xp - prevXp
    if (gained > topSkillXp) {
      topSkillXp = gained
      topSkill = name
    }
  }
  return { xp, topSkill, topSkillXp }
}

function mapPlayerRow(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    createdAt: row.created_at,
    latest: row.captured_at
      ? {
          capturedAt: row.captured_at,
          overallXp: Number(row.overall_xp),
          overallLevel: row.overall_level,
          overallRank: row.overall_rank,
          skills: row.skills,
        }
      : null,
    todayGain: computeTodayGain(row),
  }
}

function mapSnapshotRow(row) {
  return {
    capturedAt: row.captured_at,
    overallXp: Number(row.overall_xp),
    overallLevel: row.overall_level,
    overallRank: row.overall_rank,
    skills: row.skills,
  }
}

export async function listPlayers() {
  const result = await pool.query(`
    SELECT p.id, p.username, p.display_name, p.created_at,
           s.captured_at, s.overall_xp, s.overall_level, s.overall_rank, s.skills,
           b.captured_at AS baseline_captured_at, b.overall_xp AS baseline_overall_xp, b.skills AS baseline_skills
    FROM players p
    LEFT JOIN LATERAL (
      SELECT captured_at, overall_xp, overall_level, overall_rank, skills
      FROM snapshots
      WHERE player_id = p.id
      ORDER BY captured_at DESC
      LIMIT 1
    ) s ON true
    -- "Today" baseline: the oldest snapshot still within the last 24h, or
    -- the very first one ever if the player hasn't been tracked that long.
    LEFT JOIN LATERAL (
      (
        SELECT captured_at, overall_xp, skills
        FROM snapshots
        WHERE player_id = p.id AND captured_at >= now() - interval '24 hours'
        ORDER BY captured_at ASC
        LIMIT 1
      )
      UNION ALL
      (
        SELECT captured_at, overall_xp, skills
        FROM snapshots
        WHERE player_id = p.id
        ORDER BY captured_at ASC
        LIMIT 1
      )
      LIMIT 1
    ) b ON true
    ORDER BY p.display_name ASC
  `)
  const players = result.rows.map(mapPlayerRow)
  // Most xp gained today first; players with no gain (or no data to
  // compare yet) sink to the bottom, alphabetically among themselves.
  players.sort((a, b) => {
    const gainA = a.todayGain?.xp ?? -Infinity
    const gainB = b.todayGain?.xp ?? -Infinity
    if (gainB !== gainA) return gainB - gainA
    return a.displayName.localeCompare(b.displayName)
  })
  return players
}

export async function getPlayer(id) {
  const result = await pool.query('SELECT id, username, display_name, created_at FROM players WHERE id = $1', [id])
  return result.rows[0]
    ? {
        id: result.rows[0].id,
        username: result.rows[0].username,
        displayName: result.rows[0].display_name,
        createdAt: result.rows[0].created_at,
      }
    : null
}

// True if a fetched hiscores result has nothing new over a prior snapshot
// row (same xp/level/rank, overall and per-skill).
function statsUnchanged(prevRow, stats) {
  if (Number(prevRow.overall_xp) !== stats.overall.xp) return false
  if (prevRow.overall_level !== stats.overall.level) return false
  if (prevRow.overall_rank !== stats.overall.rank) return false

  for (const [name, skill] of Object.entries(stats.skills)) {
    const prev = prevRow.skills[name]
    if (!prev || prev.xp !== skill.xp || prev.level !== skill.level || prev.rank !== skill.rank) return false
  }
  return true
}

export async function recordSnapshot(playerId, stats) {
  const prev = await pool.query(
    `SELECT overall_xp, overall_level, overall_rank, skills
     FROM snapshots WHERE player_id = $1 ORDER BY captured_at DESC LIMIT 1`,
    [playerId],
  )
  if (prev.rowCount > 0 && statsUnchanged(prev.rows[0], stats)) return

  await pool.query(
    `INSERT INTO snapshots (player_id, overall_xp, overall_level, overall_rank, skills)
     VALUES ($1, $2, $3, $4, $5)`,
    [playerId, stats.overall.xp, stats.overall.level, stats.overall.rank, JSON.stringify(stats.skills)],
  )
}

export async function addPlayer(rawUsername) {
  const username = (rawUsername || '').trim()
  if (!username) {
    const err = new Error('An RSN is required.')
    err.status = 400
    throw err
  }

  const existing = await pool.query('SELECT id FROM players WHERE lower(username) = lower($1)', [username])
  if (existing.rowCount > 0) {
    const err = new Error(`"${username}" is already being tracked.`)
    err.status = 409
    throw err
  }

  // Fetch first so a bad RSN never creates a row with no data behind it.
  const stats = await fetchHiscores(username)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const inserted = await client.query(
      'INSERT INTO players (username, display_name) VALUES ($1, $2) RETURNING id',
      [username, username],
    )
    const playerId = inserted.rows[0].id
    await client.query(
      `INSERT INTO snapshots (player_id, overall_xp, overall_level, overall_rank, skills)
       VALUES ($1, $2, $3, $4, $5)`,
      [playerId, stats.overall.xp, stats.overall.level, stats.overall.rank, JSON.stringify(stats.skills)],
    )
    await client.query('COMMIT')
    return playerId
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function getSnapshots(playerId) {
  const result = await pool.query(
    `SELECT captured_at, overall_xp, overall_level, overall_rank, skills
     FROM snapshots
     WHERE player_id = $1
     ORDER BY captured_at ASC`,
    [playerId],
  )
  return result.rows.map(mapSnapshotRow)
}

export async function refreshPlayer(id) {
  const player = await getPlayer(id)
  if (!player) {
    const err = new Error('Player not found.')
    err.status = 404
    throw err
  }
  const stats = await fetchHiscores(player.username)
  await recordSnapshot(player.id, stats)
}
