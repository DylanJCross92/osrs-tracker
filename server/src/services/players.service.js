import { pool } from '../db.js'
import { fetchHiscores } from './osrsHiscores.service.js'
import { fetchWomHistory } from './wiseOldMan.service.js'

// Local timezone used to decide where a calendar day starts for "today's" gains.
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/New_York'

const GAIN_PERIODS = ['day', 'week', 'month']

// Total xp gained since the given period's baseline snapshot, plus whichever
// single skill gained the most of it — null if there's nothing to compare
// against yet (a brand-new player with only one snapshot).
function computeGain(row, period) {
  const capturedAt = row.captured_at
  const baselineCapturedAt = row[`baseline_captured_at_${period}`]
  if (!capturedAt || !baselineCapturedAt || capturedAt.getTime() === baselineCapturedAt.getTime()) {
    return null
  }

  const xp = Number(row.overall_xp) - Number(row[`baseline_overall_xp_${period}`])
  const baselineSkills = row[`baseline_skills_${period}`]
  let topSkill = null
  let topSkillXp = 0
  for (const [name, skill] of Object.entries(row.skills || {})) {
    const prevXp = baselineSkills?.[name]?.xp ?? skill.xp
    const gained = skill.xp - prevXp
    if (gained > topSkillXp) {
      topSkillXp = gained
      topSkill = name
    }
  }
  return { xp, topSkill, topSkillXp }
}

function mapPlayerRow(row) {
  const gains = {}
  for (const period of GAIN_PERIODS) gains[period] = computeGain(row, period)

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
    gains,
    womImportStatus: row.wom_import_status,
    womImportedCount: row.wom_imported_count,
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

// A period's baseline is the oldest snapshot still within its window, or the
// very first snapshot ever if the player hasn't been tracked that long —
// "day" is pinned to local midnight so it means the calendar day, not a
// rolling 24h window; "week"/"month" are plain rolling windows.
const BASELINE_CUTOFF_SQL = {
  day: `date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1`,
  week: `now() - interval '7 days'`,
  month: `now() - interval '30 days'`,
}

function baselineJoinSql(period) {
  const cutoff = BASELINE_CUTOFF_SQL[period]
  return `
    LEFT JOIN LATERAL (
      (
        SELECT captured_at, overall_xp, skills
        FROM snapshots
        WHERE player_id = p.id AND captured_at >= ${cutoff}
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
    ) b_${period} ON true
  `
}

export async function listPlayers() {
  const baselineColumns = GAIN_PERIODS.map(
    (period) =>
      `b_${period}.captured_at AS baseline_captured_at_${period}, ` +
      `b_${period}.overall_xp AS baseline_overall_xp_${period}, ` +
      `b_${period}.skills AS baseline_skills_${period}`,
  ).join(',\n           ')

  const result = await pool.query(
    `
    SELECT p.id, p.username, p.display_name, p.created_at,
           p.wom_import_status, p.wom_imported_count,
           s.captured_at, s.overall_xp, s.overall_level, s.overall_rank, s.skills,
           ${baselineColumns}
    FROM players p
    LEFT JOIN LATERAL (
      SELECT captured_at, overall_xp, overall_level, overall_rank, skills
      FROM snapshots
      WHERE player_id = p.id
      ORDER BY captured_at DESC
      LIMIT 1
    ) s ON true
    ${GAIN_PERIODS.map(baselineJoinSql).join('\n')}
    ORDER BY p.display_name ASC
  `,
    [APP_TIMEZONE],
  )
  const players = result.rows.map(mapPlayerRow)
  // Most xp gained today first; players with no gain (or no data to
  // compare yet) sink to the bottom, alphabetically among themselves.
  players.sort((a, b) => {
    const gainA = a.gains.day?.xp ?? -Infinity
    const gainB = b.gains.day?.xp ?? -Infinity
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
  let playerId
  let liveCapturedAt
  try {
    await client.query('BEGIN')
    const inserted = await client.query(
      "INSERT INTO players (username, display_name, wom_import_status) VALUES ($1, $2, 'pending') RETURNING id",
      [username, username],
    )
    playerId = inserted.rows[0].id
    const snapshot = await client.query(
      `INSERT INTO snapshots (player_id, overall_xp, overall_level, overall_rank, skills)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING captured_at`,
      [playerId, stats.overall.xp, stats.overall.level, stats.overall.rank, JSON.stringify(stats.skills)],
    )
    liveCapturedAt = snapshot.rows[0].captured_at
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  // Legacy backfill from Wise Old Man can take well over a minute (WOM's
  // rate limit caps us at ~20 req/min, and dense history needs many pages),
  // so it runs in the background rather than blocking the response — the
  // player is already saved above. The UI polls wom_import_status to show
  // progress. Deliberately not awaited.
  runWomImportInBackground(playerId, username, liveCapturedAt)

  return { playerId }
}

// Manual trigger for the "Check Wise Old Man" button — only for a player
// who's never been checked (status 'none'); the button disappears once
// this succeeds, so there's nothing to re-trigger from the UI, but the
// atomic status flip below guards against a stray double-click anyway.
export async function startWomImport(id) {
  const player = await getPlayer(id)
  if (!player) {
    const err = new Error('Player not found.')
    err.status = 404
    throw err
  }

  const flipped = await pool.query(
    "UPDATE players SET wom_import_status = 'pending' WHERE id = $1 AND wom_import_status = 'none'",
    [id],
  )
  if (flipped.rowCount === 0) {
    const err = new Error('Wise Old Man history has already been checked for this player.')
    err.status = 409
    throw err
  }

  const latest = await pool.query(
    'SELECT captured_at FROM snapshots WHERE player_id = $1 ORDER BY captured_at DESC LIMIT 1',
    [id],
  )
  const beforeDate = latest.rows[0]?.captured_at ?? new Date()

  runWomImportInBackground(id, player.username, beforeDate)
}

async function runWomImportInBackground(playerId, username, liveCapturedAt) {
  try {
    await pool.query("UPDATE players SET wom_import_status = 'running' WHERE id = $1", [playerId])
    const count = await importWomHistory(playerId, username, liveCapturedAt)
    await pool.query("UPDATE players SET wom_import_status = 'done', wom_imported_count = $2 WHERE id = $1", [
      playerId,
      count,
    ])
  } catch (err) {
    console.error(`Wise Old Man import failed for "${username}":`, err)
    await pool
      .query("UPDATE players SET wom_import_status = 'failed' WHERE id = $1", [playerId])
      .catch(() => {})
  }
}

// Backfills snapshots strictly older than the player's first live snapshot
// from Wise Old Man's history, so a brand-new player shows legacy data
// instead of starting from a blank slate. WOM's depth varies a lot per
// player — this is a best-effort import, not guaranteed full history.
async function importWomHistory(playerId, username, beforeDate) {
  const history = await fetchWomHistory(username)

  // Excludes timestamps we already have for this player, not just
  // duplicates within this WOM fetch — matters for the manual "Check Wise
  // Old Man" button, which can run against a player who (for whatever
  // reason) already has some overlapping history saved.
  const existing = await pool.query('SELECT captured_at FROM snapshots WHERE player_id = $1', [playerId])
  const seenTimestamps = new Set(existing.rows.map((r) => r.captured_at.toISOString()))

  const rows = history.filter((snap) => {
    if (snap.capturedAt >= beforeDate) return false
    const key = snap.capturedAt.toISOString()
    if (seenTimestamps.has(key)) return false
    seenTimestamps.add(key)
    return true
  })
  if (!rows.length) return 0

  await pool.query(
    `INSERT INTO snapshots (player_id, captured_at, overall_xp, overall_level, overall_rank, skills)
     SELECT $1, * FROM unnest($2::timestamptz[], $3::bigint[], $4::int[], $5::int[], $6::jsonb[])`,
    [
      playerId,
      rows.map((s) => s.capturedAt),
      rows.map((s) => s.overall.xp),
      rows.map((s) => s.overall.level),
      rows.map((s) => s.overall.rank),
      rows.map((s) => JSON.stringify(s.skills)),
    ],
  )
  return rows.length
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
