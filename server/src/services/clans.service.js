import { pool } from '../db.js'
import { HiscoresUnavailableError, PlayerNotFoundError } from './osrsHiscores.service.js'
import { addPlayer, getPlayerByUsername } from './players.service.js'
import { addEntrantToOpenCompetitions, listClanCompetitions, removeEntrantFromOpenCompetitions } from './competitions.service.js'
import { MAX_CLANS_PER_USER, MAX_MEMBERS, VISIBILITIES, cleanClanInput, cleanRsn, newInviteToken, newSlug, summarizeClans } from '../utils/clans.js'
import { metricLabel } from '../utils/competitions.js'

/** An error that is safe to show as-is. */
export class ClanError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

const shapeClan = (r, memberCount) => ({ slug: r.slug, name: r.name, description: r.description, visibility: r.visibility, createdAt: r.created_at, memberCount })

export async function clanBySlug(slug) {
  const { rows } = await pool.query('SELECT * FROM clans WHERE slug = $1', [String(slug || '').toLowerCase()])
  return rows[0] || null
}

/** The profiles (players) an account owns: its verified claims. */
async function ownedPlayerIds(userId) {
  if (!userId) return []
  const { rows } = await pool.query(`SELECT player_id FROM profile_claims WHERE user_id = $1 AND status = 'verified'`, [userId])
  return rows.map((r) => r.player_id)
}

/**
 * What this account can do in a clan: 'owner', 'mod' (an RSN it owns is a moderator), 'member' (an RSN it owns is in the
 * clan), or null for anyone else.
 */
export async function roleOf(clan, userId) {
  if (!userId) return null
  if (clan.owner_user_id === userId) return 'owner'
  const owned = await ownedPlayerIds(userId)
  if (!owned.length) return null
  const { rows } = await pool.query('SELECT role FROM clan_members WHERE clan_id = $1 AND player_id = ANY($2::int[])', [clan.id, owned])
  if (!rows.length) return null
  return rows.some((r) => r.role === 'mod') ? 'mod' : 'member'
}
export const canManage = (role) => role === 'owner' || role === 'mod'

async function memberCount(clanId) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM clan_members WHERE clan_id = $1', [clanId])
  return rows[0].n
}

// --- creating and reading --------------------------------------------------------------------------------------------

export async function createClan(user, body) {
  const parsed = cleanClanInput(body)
  if (!parsed.ok) throw new ClanError(parsed.error)
  const { rows: owned } = await pool.query('SELECT count(*)::int AS n FROM clans WHERE owner_user_id = $1', [user.id])
  if (owned[0].n >= MAX_CLANS_PER_USER) throw new ClanError(`An account can own up to ${MAX_CLANS_PER_USER} clans.`, 409)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO clans (slug, name, description, owner_user_id, invite_token, visibility) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [newSlug(parsed.value.name), parsed.value.name, parsed.value.description, user.id, newInviteToken(), parsed.value.visibility],
      )
      // The owner's own profile joins straight away, when they have one.
      const mine = await ownedPlayerIds(user.id)
      if (mine.length) await pool.query(`INSERT INTO clan_members (clan_id, player_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [rows[0].id, mine[0], user.id])
      return shapeClan(rows[0], mine.length ? 1 : 0)
    } catch (err) {
      if (err.code !== '23505') throw err // a clash on the random slug or token (rare) tries again
    }
  }
  throw new ClanError('Could not create the clan, please try again.', 500)
}

async function loadMembers(clanId) {
  const { rows } = await pool.query(
    `SELECT p.username, p.display_name, gm.role, (gm.user_id IS NOT NULL) AS verified, gm.joined_at, ls.overall_level, ls.overall_xp,
            COALESCE(ls.overall_xp - COALESCE(ws.overall_xp, fs.overall_xp), 0) AS week_gain
     FROM clan_members gm
     JOIN players p ON p.id = gm.player_id
     LEFT JOIN LATERAL (SELECT overall_level, overall_xp FROM snapshots WHERE player_id = p.id ORDER BY captured_at DESC LIMIT 1) ls ON true
     LEFT JOIN LATERAL (SELECT overall_xp FROM snapshots WHERE player_id = p.id AND captured_at <= now() - interval '7 days' ORDER BY captured_at DESC LIMIT 1) ws ON true
     LEFT JOIN LATERAL (SELECT overall_xp FROM snapshots WHERE player_id = p.id ORDER BY captured_at ASC LIMIT 1) fs ON true
     WHERE gm.clan_id = $1
     ORDER BY week_gain DESC, p.username`,
    [clanId],
  )
  return rows.map((r) => ({
    username: r.username,
    displayName: r.display_name,
    role: r.role,
    verified: r.verified,
    joinedAt: r.joined_at,
    overallLevel: r.overall_level,
    overallXp: r.overall_xp == null ? null : Number(r.overall_xp),
    weekGain: Math.max(Number(r.week_gain) || 0, 0),
  }))
}

/** Everything on a clan's page, for any visitor. The invite link is only shown to those who can pass it on. */
export async function getClanView(slug, user) {
  const clan = await clanBySlug(slug)
  if (!clan) return null
  const [members, competitions, role] = await Promise.all([loadMembers(clan.id), listClanCompetitions(clan.id), roleOf(clan, user?.id)])
  return {
    clan: shapeClan(clan, members.length),
    members,
    competitions,
    viewer: { role, canManage: canManage(role), canInvite: Boolean(role), inviteToken: role ? clan.invite_token : null },
  }
}

/** What someone sees opening an invite link, before joining. Null when the link is not valid. */
export async function previewInvite(token) {
  const { rows } = await pool.query('SELECT * FROM clans WHERE invite_token = $1', [String(token || '')])
  if (!rows[0]) return null
  return shapeClan(rows[0], await memberCount(rows[0].id))
}

/**
 * Every clan an account owns or has a profile in, newest first, each with what the page shows (size, this week's XP,
 * top gainers, open competitions) and the account's role in it: 'owner', 'mod' or 'member'.
 */
export async function myClans(user) {
  const owned = await ownedPlayerIds(user.id)
  const { rows } = await pool.query(
    `SELECT g.id, g.slug, g.name, g.description, g.visibility, g.created_at, g.owner_user_id
     FROM clans g
     WHERE g.owner_user_id = $1 OR g.id IN (SELECT clan_id FROM clan_members WHERE player_id = ANY($2::int[]))
     ORDER BY g.created_at DESC`,
    [user.id, owned],
  )
  if (!rows.length) return []
  const { rows: mods } = await pool.query(`SELECT DISTINCT clan_id FROM clan_members WHERE role = 'mod' AND player_id = ANY($1::int[])`, [owned])
  const modOf = new Set(mods.map((r) => r.clan_id))
  const { clans } = await summarize(rows)
  const bySlug = new Map(clans.map((c) => [c.slug, c]))
  return rows.map((r) => {
    const c = bySlug.get(r.slug)
    const owner = r.owner_user_id === user.id
    return { ...c, owner, role: owner ? 'owner' : modOf.has(r.id) ? 'mod' : 'member', openCompetitions: c.competitions.length }
  })
}

// --- joining and leaving ---------------------------------------------------------------------------------------------

/** Joins through an invite link with an RSN. A name not tracked yet is added; the hiscores must know it. */
export async function joinClan({ token, rsn, user }) {
  const name = cleanRsn(rsn)
  if (!name) throw new ClanError('Enter a RuneScape name: up to 12 letters, numbers, spaces, hyphens or underscores.')
  const { rows } = await pool.query('SELECT * FROM clans WHERE invite_token = $1', [String(token || '')])
  const clan = rows[0]
  if (!clan) throw new ClanError('That invite link is not valid any more. Ask for a new one.', 404)
  if ((await memberCount(clan.id)) >= MAX_MEMBERS) throw new ClanError(`This clan is full (${MAX_MEMBERS} members).`, 409)

  let player = await getPlayerByUsername(name)
  if (!player) {
    try {
      await addPlayer(name)
    } catch (err) {
      if (err instanceof PlayerNotFoundError) throw new ClanError(`"${name}" was not found on the OSRS hiscores. Check the spelling.`, 404)
      if (err instanceof HiscoresUnavailableError) throw new ClanError('The OSRS hiscores are not answering right now. Please try again in a minute.', 503)
      if (err.status !== 409) throw err // someone else added the same name a moment ago: fine, carry on
    }
    player = await getPlayerByUsername(name)
    if (!player) throw new ClanError('Could not add that player, please try again.', 500)
  }

  // An account that owns this RSN gets the verified tick.
  const mine = await ownedPlayerIds(user?.id)
  const verifiedBy = mine.includes(player.id) ? user.id : null
  const { rowCount } = await pool.query('INSERT INTO clan_members (clan_id, player_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [clan.id, player.id, verifiedBy])
  if (rowCount) await addEntrantToOpenCompetitions(clan.id, player).catch((err) => console.error('[clans] could not add the new member to competitions:', err.message))
  else if (verifiedBy) await pool.query('UPDATE clan_members SET user_id = $3 WHERE clan_id = $1 AND player_id = $2 AND user_id IS NULL', [clan.id, player.id, verifiedBy])
  return { slug: clan.slug, name: clan.name, player: { username: player.username, displayName: player.displayName }, alreadyMember: !rowCount, verified: Boolean(verifiedBy) }
}

/** Takes a member out. Owners and moderators can remove anyone (only the owner a moderator); the account that owns an RSN can remove its own. */
export async function removeMember(user, clan, username) {
  const player = await getPlayerByUsername(username)
  if (!player) throw new ClanError('That player is not in this clan.', 404)
  const { rows } = await pool.query('SELECT role FROM clan_members WHERE clan_id = $1 AND player_id = $2', [clan.id, player.id])
  if (!rows[0]) throw new ClanError('That player is not in this clan.', 404)
  const role = await roleOf(clan, user.id)
  const owned = await ownedPlayerIds(user.id)
  const isSelf = owned.includes(player.id)
  const allowed = isSelf || role === 'owner' || (role === 'mod' && rows[0].role !== 'mod')
  if (!allowed) throw new ClanError('Only the clan owner or a moderator can remove members.', 403)
  await pool.query('DELETE FROM clan_members WHERE clan_id = $1 AND player_id = $2', [clan.id, player.id])
  await removeEntrantFromOpenCompetitions(clan.id, player.id)
}

/** Makes a member a moderator, or an ordinary member again. Owner only. */
export async function setModerator(clan, username, isMod) {
  const player = await getPlayerByUsername(username)
  if (!player) throw new ClanError('That player is not in this clan.', 404)
  const { rowCount } = await pool.query('UPDATE clan_members SET role = $3 WHERE clan_id = $1 AND player_id = $2', [clan.id, player.id, isMod ? 'mod' : 'member'])
  if (!rowCount) throw new ClanError('That player is not in this clan.', 404)
}

/** A new invite link; the old one stops working. */
export async function resetInvite(clan) {
  const { rows } = await pool.query('UPDATE clans SET invite_token = $2 WHERE id = $1 RETURNING invite_token', [clan.id, newInviteToken()])
  return rows[0].invite_token
}

export async function deleteClan(clan) {
  await pool.query('DELETE FROM clans WHERE id = $1', [clan.id])
}

// --- the invite card ---------------------------------------------------------------------------------------------------

const CARD_MEMBERS = 5

/**
 * What the invite picture shows, for an invite link: the clan, who is in it already (the top gainers this week, with their
 * own pictures where they have one) and the competition that is on or coming up. Null when the link is not valid.
 */
export async function getInviteCardData(token) {
  const { rows } = await pool.query('SELECT * FROM clans WHERE invite_token = $1', [String(token || '')])
  const clan = rows[0]
  if (!clan) return null
  const members = await loadMembers(clan.id)
  const shown = members.slice(0, CARD_MEMBERS)
  const { rows: pics } = shown.length
    ? await pool.query(
        `SELECT lower(p.username) AS username, pp.avatar, pp.avatar_type FROM profile_pages pp JOIN players p ON p.id = pp.player_id WHERE lower(p.username) = ANY($1::text[]) AND pp.avatar IS NOT NULL`,
        [shown.map((m) => m.username.toLowerCase())],
      )
    : { rows: [] }
  const photos = new Map(pics.map((r) => [r.username, `data:${r.avatar_type};base64,${Buffer.from(r.avatar).toString('base64')}`]))
  const { rows: comps } = await pool.query(
    `SELECT id, title, metric, skill, status, starts_at, ends_at FROM competitions WHERE clan_id = $1 AND status IN ('scheduled', 'running') ORDER BY (status = 'running') DESC, starts_at LIMIT 2`,
    [clan.id],
  )
  return {
    name: clan.name,
    description: clan.description,
    memberCount: members.length,
    members: shown.map((m) => ({ username: m.username, displayName: m.displayName, overallLevel: m.overallLevel, weekGain: m.weekGain, photo: photos.get(m.username.toLowerCase()) || null })),
    moreMembers: Math.max(members.length - shown.length, 0),
    competitions: comps.map((c) => ({ id: c.id, title: c.title, label: metricLabel({ metric: c.metric, skill: c.skill }), status: c.status, startsAt: c.starts_at, endsAt: c.ends_at })),
  }
}

// --- the Clans page ---------------------------------------------------------------------------------------------------

const LISTED_LIMIT = 100

/** Loads the members and open competitions of some clan rows and sums them up the way the Clans page shows them. */
async function summarize(clans) {
  if (!clans.length) return summarizeClans([], [], [])
  const ids = clans.map((c) => c.id)
  const { rows: members } = await pool.query(
    `SELECT gm.clan_id, p.username, p.display_name, ls.overall_level,
            COALESCE(ls.overall_xp - COALESCE(ws.overall_xp, fs.overall_xp), 0) AS week_gain
     FROM clan_members gm
     JOIN players p ON p.id = gm.player_id
     LEFT JOIN LATERAL (SELECT overall_level, overall_xp FROM snapshots WHERE player_id = p.id ORDER BY captured_at DESC LIMIT 1) ls ON true
     LEFT JOIN LATERAL (SELECT overall_xp FROM snapshots WHERE player_id = p.id AND captured_at <= now() - interval '7 days' ORDER BY captured_at DESC LIMIT 1) ws ON true
     LEFT JOIN LATERAL (SELECT overall_xp FROM snapshots WHERE player_id = p.id ORDER BY captured_at ASC LIMIT 1) fs ON true
     WHERE gm.clan_id = ANY($1::int[])`,
    [ids],
  )
  const { rows: comps } = await pool.query(
    `SELECT c.id, c.clan_id, c.title, c.metric, c.skill, c.status, c.starts_at, c.ends_at,
            (SELECT count(*)::int FROM competition_members cm WHERE cm.competition_id = c.id) AS entrants
     FROM competitions c WHERE c.clan_id = ANY($1::int[]) AND c.status IN ('scheduled', 'running')`,
    [ids],
  )
  return summarizeClans(clans, members, comps.map((c) => ({ ...c, label: metricLabel({ metric: c.metric, skill: c.skill }) })))
}

/** The clans that chose to be listed, with their size, this week's XP, top gainers and competitions. */
export async function listPublicClans() {
  const { rows } = await pool.query(`SELECT id, slug, name, description, visibility, created_at FROM clans WHERE visibility = 'public' ORDER BY created_at DESC LIMIT $1`, [LISTED_LIMIT])
  return summarize(rows)
}

/** Lists a clan on the Clans page, or takes it off. Owner only (checked by the route). */
export async function setVisibility(clan, visibility) {
  if (!VISIBILITIES.includes(visibility)) throw new ClanError('Choose listed or unlisted.')
  await pool.query('UPDATE clans SET visibility = $2 WHERE id = $1', [clan.id, visibility])
  return visibility
}
