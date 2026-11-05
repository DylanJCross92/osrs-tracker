import { pool } from '../db.js'
import { fetchHiscores } from './osrsHiscores.service.js'

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
           s.captured_at, s.overall_xp, s.overall_level, s.overall_rank, s.skills
    FROM players p
    LEFT JOIN LATERAL (
      SELECT captured_at, overall_xp, overall_level, overall_rank, skills
      FROM snapshots
      WHERE player_id = p.id
      ORDER BY captured_at DESC
      LIMIT 1
    ) s ON true
    ORDER BY p.display_name ASC
  `)
  return result.rows.map(mapPlayerRow)
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

export async function recordSnapshot(playerId, stats) {
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

export async function removePlayer(id) {
  await pool.query('DELETE FROM players WHERE id = $1', [id])
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
