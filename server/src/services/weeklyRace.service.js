import { pool } from '../db.js'
import { newInviteToken } from '../utils/clans.js'
import { WEEKLY_CLAN, weeklyRaceWindow } from '../utils/weeklyRace.js'
import { listClanCompetitions, getCompetition } from './competitions.service.js'

// The site's own weekly race: one official clan, "TickGains Weekly", that anyone can join with their RuneScape name (no approval), and an
// overall-XP competition for it that runs Monday midnight to Monday midnight Eastern, replaced by the next one when it ends. Made and kept
// going by the job in jobs/competitions.js, once a minute (cheap when nothing is due). The clan belongs to the site owner's account, so the
// owner can remove anyone who abuses it, like any clan.

async function ownerAccountId() {
  const { rows } = await pool.query(`SELECT id FROM users WHERE 'owner' = ANY(roles) ORDER BY id LIMIT 1`)
  return rows[0]?.id ?? null
}

async function officialClan() {
  const { rows } = await pool.query('SELECT * FROM clans WHERE official AND slug = $1', [WEEKLY_CLAN.slug])
  return rows[0] || null
}

let warnedNoOwner = false

/** Makes the weekly clan when it does not exist yet. Null when there is no owner account to give it to (nothing is made until there is). */
async function ensureClan() {
  const existing = await officialClan()
  if (existing) return existing
  const owner = await ownerAccountId()
  if (!owner) {
    if (!warnedNoOwner) console.warn('[weekly] no owner account yet, so the weekly race is not set up')
    warnedNoOwner = true
    return null
  }
  const { rows } = await pool.query(
    `INSERT INTO clans (slug, name, description, owner_user_id, invite_token, visibility, open_join, official)
     VALUES ($1, $2, $3, $4, $5, 'public', true, true) ON CONFLICT (slug) DO NOTHING RETURNING *`,
    [WEEKLY_CLAN.slug, WEEKLY_CLAN.name, WEEKLY_CLAN.description, owner, newInviteToken()],
  )
  if (rows[0]) console.log('[weekly] made the TickGains Weekly clan')
  return rows[0] || officialClan()
}

/**
 * Makes sure there is a weekly race: when the clan has no competition scheduled or running, starts the one for this week (the one that
 * began on Monday, running to next Monday) for everyone in the clan. It never starts a second one for the same week, so a race the owner
 * cancelled stays cancelled until the next week. Safe to call as often as you like.
 */
export async function ensureWeeklyRace(now = Date.now()) {
  const clan = await ensureClan()
  if (!clan) return null
  const { rows: open } = await pool.query(`SELECT id FROM competitions WHERE clan_id = $1 AND status IN ('scheduled', 'running') LIMIT 1`, [clan.id])
  if (open.length) return null
  const w = weeklyRaceWindow(now)
  const { rows: same } = await pool.query('SELECT id FROM competitions WHERE clan_id = $1 AND ends_at = $2 LIMIT 1', [clan.id, w.endsAt])
  if (same.length) return null
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO competitions (clan_id, title, metric, skill, starts_at, ends_at, created_by) VALUES ($1, $2, 'overall_xp', '', $3, $4, $5) RETURNING id`,
      [clan.id, w.title, w.startsAt, w.endsAt, clan.owner_user_id],
    )
    await client.query('INSERT INTO competition_members (competition_id, player_id) SELECT $1, player_id FROM clan_members WHERE clan_id = $2', [rows[0].id, clan.id])
    await client.query('COMMIT')
    console.log(`[weekly] started "${w.title}"`)
    return rows[0].id
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/**
 * What the Clans page shows about the weekly race: the clan, this week's race with its leaders and how long is left, and last week's
 * winner. Null when the weekly clan has not been made yet.
 */
export async function weeklyRaceView() {
  const clan = await officialClan()
  if (!clan) return null
  // Everyone in the clan by name (at most 100), so the page can tell a visitor their player is already in.
  const { rows: members } = await pool.query('SELECT lower(p.username) AS username FROM clan_members cm JOIN players p ON p.id = cm.player_id WHERE cm.clan_id = $1 ORDER BY cm.joined_at LIMIT 200', [clan.id])
  const list = await listClanCompetitions(clan.id, 6)
  const current = list.find((c) => c.status === 'running') || list.find((c) => c.status === 'scheduled') || null
  const last = list.find((c) => c.status === 'finished') || null
  let top = []
  if (current) {
    const full = await getCompetition(current.id)
    top = (full?.standings || []).filter((r) => !r.pending).slice(0, 5).map((r) => ({ rank: r.rank, username: r.username, displayName: r.displayName, gain: r.gain }))
  }
  return {
    clan: { slug: clan.slug, name: clan.name, description: clan.description, memberCount: members.length },
    current: current && { id: current.id, title: current.title, status: current.status, startsAt: current.startsAt, endsAt: current.endsAt, entrants: current.entrants },
    members: members.map((m) => m.username),
    top,
    last: last && { id: last.id, title: last.title, winners: last.winners },
  }
}
