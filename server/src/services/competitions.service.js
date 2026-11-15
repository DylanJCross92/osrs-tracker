import { pool } from '../db.js'
import { SKILL_NAMES, fetchHiscores } from './osrsHiscores.service.js'
import { recordSnapshot } from './players.service.js'
import { FINALIZE_DEADLINE_MS, cleanCompetitionInput, freezeResults, metricValue, standings } from '../utils/competitions.js'
import { MAX_ACTIVE_COMPETITIONS } from '../utils/clans.js'

/** An error that is safe to show as-is. */
export class CompetitionError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
// A little pause between hiscores requests, the same courtesy the hourly sync gives them.
const BETWEEN_PLAYERS_MS = 1000

/** A fresh hiscores check for one player, saved as a snapshot when anything changed. Returns true when the check worked. */
export async function refreshPlayer(player) {
  try {
    const stats = await fetchHiscores(player.username)
    await recordSnapshot(player.id, stats)
    return true
  } catch (err) {
    console.error(`[competitions] could not refresh "${player.username}": ${err.message}`)
    return false
  }
}

/** The player's newest snapshot as { overallXp, skills, capturedAt }, or null. */
async function latestSnapshot(playerId) {
  const { rows } = await pool.query('SELECT overall_xp, skills, captured_at FROM snapshots WHERE player_id = $1 ORDER BY captured_at DESC LIMIT 1', [playerId])
  return rows[0] ? { overallXp: Number(rows[0].overall_xp), skills: rows[0].skills, capturedAt: rows[0].captured_at } : null
}

const shapeCompetition = (r) => ({
  id: r.id,
  clanId: r.clan_id,
  title: r.title,
  metric: r.metric,
  skill: r.skill,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  status: r.status,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
})

// --- creating and reading -------------------------------------------------------------------------------------------

/**
 * Starts a competition in a clan, for everyone who is in the clan now. It begins at its start time: the job at the bottom
 * of this file takes everyone's starting numbers from a fresh hiscores check at that moment.
 */
export async function createCompetition(clan, user, body) {
  const parsed = cleanCompetitionInput(body, SKILL_NAMES)
  if (!parsed.ok) throw new CompetitionError(parsed.error)
  const { rows: open } = await pool.query(`SELECT count(*)::int AS n FROM competitions WHERE clan_id = $1 AND status IN ('scheduled', 'running')`, [clan.id])
  if (open[0].n >= MAX_ACTIVE_COMPETITIONS) throw new CompetitionError(`A clan can have ${MAX_ACTIVE_COMPETITIONS} competitions going at once. Wait for one to finish or cancel it.`, 409)
  const { rows: members } = await pool.query('SELECT player_id FROM clan_members WHERE clan_id = $1', [clan.id])
  if (!members.length) throw new CompetitionError('Add at least one member to the clan first.', 400)

  const { title, metric, skill, startsAt, endsAt } = parsed.value
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO competitions (clan_id, title, metric, skill, starts_at, ends_at, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [clan.id, title, metric, skill, startsAt, endsAt, user.id],
    )
    for (const m of members) await client.query('INSERT INTO competition_members (competition_id, player_id) VALUES ($1, $2)', [rows[0].id, m.player_id])
    await client.query('COMMIT')
    // One that starts right now should not wait for the next minute.
    if (startsAt.getTime() <= Date.now() + 60_000) tick().catch((err) => console.error('[competitions] tick failed:', err.message))
    return shapeCompetition(rows[0])
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/** Entrants with their start, end and current XP in the competition's metric. */
async function loadMembers(c) {
  const { rows } = await pool.query(
    `SELECT cm.player_id, p.username, p.display_name, cm.joined_at, cm.start_xp, cm.end_xp, ls.overall_xp, ls.skills
     FROM competition_members cm
     JOIN players p ON p.id = cm.player_id
     LEFT JOIN LATERAL (SELECT overall_xp, skills FROM snapshots WHERE player_id = cm.player_id ORDER BY captured_at DESC LIMIT 1) ls ON true
     WHERE cm.competition_id = $1`,
    [c.id],
  )
  return rows.map((r) => ({
    playerId: r.player_id,
    username: r.username,
    displayName: r.display_name,
    joinedAt: r.joined_at,
    startXp: r.start_xp == null ? null : Number(r.start_xp),
    endXp: r.end_xp == null ? null : Number(r.end_xp),
    currentXp: r.overall_xp == null ? null : metricValue(c.metric, c.skill, { overallXp: Number(r.overall_xp), skills: r.skills }),
  }))
}

/** A competition with its standing: frozen results once it has finished, otherwise worked out live. Null when there is none. */
export async function getCompetition(id) {
  const { rows } = await pool.query(
    `SELECT c.*, g.slug AS clan_slug, g.name AS clan_name FROM competitions c JOIN clans g ON g.id = c.clan_id WHERE c.id = $1`,
    [id],
  )
  if (!rows[0]) return null
  const row = rows[0]
  const competition = { ...shapeCompetition(row), clan: { slug: row.clan_slug, name: row.clan_name } }
  const members = row.status === 'finished' && row.results ? null : await loadMembers(row)
  const table = row.status === 'finished' && row.results ? row.results : standings(members, { startsAt: row.starts_at }).map(({ ...r }) => r)
  return { competition, standings: table, entrants: table.length }
}

export async function cancelCompetition(competitionId) {
  const { rowCount } = await pool.query(`UPDATE competitions SET status = 'cancelled', finished_at = now() WHERE id = $1 AND status IN ('scheduled', 'running')`, [competitionId])
  if (!rowCount) throw new CompetitionError('That competition is not running any more.', 409)
}

/**
 * A clan's competitions for its page, newest first, with the winners of the finished ones.
 */
export async function listClanCompetitions(clanId, limit = 20) {
  const { rows } = await pool.query(
    `SELECT c.*, (SELECT count(*)::int FROM competition_members cm WHERE cm.competition_id = c.id) AS entrants
     FROM competitions c WHERE c.clan_id = $1 ORDER BY c.starts_at DESC LIMIT $2`,
    [clanId, limit],
  )
  return rows.map((r) => ({
    ...shapeCompetition(r),
    entrants: r.entrants,
    winners: r.status === 'finished' && Array.isArray(r.results) ? r.results.filter((x) => x.rank === 1 && x.gain > 0 && !x.pending).map((x) => ({ username: x.username, displayName: x.displayName, gain: x.gain })) : [],
  }))
}

// --- people joining and leaving -------------------------------------------------------------------------------------

/**
 * Puts a new clan member into the clan's competitions that have not finished. In a running one their starting XP is taken
 * now, from a fresh check (they are marked as a late joiner by the standings when it is past the start).
 */
export async function addEntrantToOpenCompetitions(clanId, player) {
  const { rows: open } = await pool.query(`SELECT * FROM competitions WHERE clan_id = $1 AND status IN ('scheduled', 'running')`, [clanId])
  for (const c of open) {
    await pool.query('INSERT INTO competition_members (competition_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [c.id, player.id])
    if (c.status === 'running') await setBaseline(c, player, true)
  }
}

export async function removeEntrantFromOpenCompetitions(clanId, playerId) {
  await pool.query(
    `DELETE FROM competition_members WHERE player_id = $2 AND competition_id IN (SELECT id FROM competitions WHERE clan_id = $1 AND status IN ('scheduled', 'running'))`,
    [clanId, playerId],
  )
}

// --- the job: starting and finishing ---------------------------------------------------------------------------------

/** Records an entrant's starting XP from a fresh check (or from their newest snapshot when the hiscores are not answering). */
async function setBaseline(c, player, refresh = true) {
  const ok = refresh ? await refreshPlayer(player) : false
  const snap = await latestSnapshot(player.id)
  if (!snap) return false
  const xp = metricValue(c.metric, c.skill, snap)
  await pool.query('UPDATE competition_members SET start_xp = $3, start_at = $4 WHERE competition_id = $1 AND player_id = $2 AND start_xp IS NULL', [c.id, player.id, xp, ok ? new Date() : snap.capturedAt])
  return ok
}

async function setEnd(c, player, force) {
  const ok = await refreshPlayer(player)
  // Without a fresh check, the newest numbers on hand count, but only once it is clear the hiscores are not coming back.
  if (!ok && !force) return false
  const snap = await latestSnapshot(player.id)
  if (!snap) return false
  const xp = metricValue(c.metric, c.skill, snap)
  await pool.query('UPDATE competition_members SET end_xp = $3, end_at = $4 WHERE competition_id = $1 AND player_id = $2 AND end_xp IS NULL', [c.id, player.id, xp, ok ? new Date() : snap.capturedAt])
  return true
}

async function membersOf(competitionId, where = '') {
  const { rows } = await pool.query(
    `SELECT cm.player_id AS id, p.username FROM competition_members cm JOIN players p ON p.id = cm.player_id WHERE cm.competition_id = $1 ${where} ORDER BY cm.player_id`,
    [competitionId],
  )
  return rows
}

async function startDue() {
  const { rows } = await pool.query(`SELECT id FROM competitions WHERE status = 'scheduled' AND starts_at <= now() ORDER BY starts_at`)
  for (const { id } of rows) {
    // Claimed atomically, so two overlapping runs never start the same competition.
    const { rows: claimed } = await pool.query(`UPDATE competitions SET status = 'running', started_at = now() WHERE id = $1 AND status = 'scheduled' RETURNING *`, [id])
    if (!claimed[0]) continue
    const players = await membersOf(id, 'AND cm.start_xp IS NULL')
    for (const p of players) {
      await setBaseline(claimed[0], p)
      await delay(BETWEEN_PLAYERS_MS)
    }
    console.log(`[competitions] started "${claimed[0].title}" with ${players.length} entrants`)
  }
}

/** Gives a starting number to anyone in a running competition who has none (late joiners, failed checks), a few at a time. */
async function fillMissingBaselines(limit = 15) {
  const { rows } = await pool.query(
    `SELECT c.id AS cid, cm.player_id AS id, p.username FROM competition_members cm
     JOIN competitions c ON c.id = cm.competition_id AND c.status = 'running'
     JOIN players p ON p.id = cm.player_id
     WHERE cm.start_xp IS NULL ORDER BY c.id, cm.player_id LIMIT $1`,
    [limit],
  )
  for (const r of rows) {
    const { rows: c } = await pool.query('SELECT * FROM competitions WHERE id = $1', [r.cid])
    if (c[0]) await setBaseline(c[0], r)
    await delay(BETWEEN_PLAYERS_MS)
  }
}

async function finalizeDue() {
  const { rows } = await pool.query(`SELECT * FROM competitions WHERE status = 'running' AND ends_at <= now() ORDER BY ends_at`)
  for (const c of rows) {
    const force = Date.now() > new Date(c.ends_at).getTime() + FINALIZE_DEADLINE_MS
    const pending = await membersOf(c.id, 'AND cm.end_xp IS NULL')
    for (const p of pending) {
      await setEnd(c, p, force)
      await delay(BETWEEN_PLAYERS_MS)
    }
    const stillOpen = await membersOf(c.id, 'AND cm.end_xp IS NULL')
    if (stillOpen.length) continue // the hiscores are not answering: try again next minute, until the deadline
    // Anyone with no start (the hiscores never answered for them) is kept out of the ranking rather than guessed at.
    const members = await loadMembers(c)
    const final = freezeResults(standings(members, { startsAt: c.starts_at }))
    const { rowCount } = await pool.query(`UPDATE competitions SET status = 'finished', finished_at = now(), results = $2 WHERE id = $1 AND status = 'running'`, [c.id, JSON.stringify(final)])
    if (rowCount) console.log(`[competitions] finished "${c.title}": ${final.length} entrants`)
  }
}

// Only one run at a time in this process, and one across instances (advisory lock), like the hourly sync.
const LOCK_KEY = 872_431_002
let running = false

/** One pass: start what is due, give late joiners their starting numbers, finish what is over. Safe to call at any time. */
export async function tick() {
  if (running) return { skipped: true }
  running = true
  const lock = await pool.connect()
  try {
    const { rows } = await lock.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_KEY])
    if (!rows[0].ok) return { skipped: true }
    await startDue()
    await fillMissingBaselines()
    await finalizeDue()
    return { skipped: false }
  } finally {
    await lock.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {})
    lock.release()
    running = false
  }
}
