import { pool } from '../db.js'
import { HiscoresUnavailableError, PlayerNotFoundError } from './osrsHiscores.service.js'
import { addPlayer, getPlayerByUsername } from './players.service.js'
import { addNotification, ownerOfPlayer } from './inbox.service.js'
import { addEntrantToOpenCompetitions, getCompetition, listClanCompetitions, removeEntrantFromOpenCompetitions } from './competitions.service.js'
import { MAX_CLANS_PER_USER, MAX_MEMBERS, MAX_PENDING_REQUESTS, cleanClanInput, cleanRsn, newInviteToken, newSlug, summarizeClans } from '../utils/clans.js'
import { metricLabel } from '../utils/competitions.js'
import { APP_TIMEZONE } from '../utils/dates.js'

/** An error that is safe to show as-is. */
export class ClanError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

const shapeClan = (r, memberCount) => ({ slug: r.slug, name: r.name, description: r.description, visibility: r.visibility, createdAt: r.created_at, memberCount, acceptingRequests: r.accepting_requests !== false })

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
        `INSERT INTO clans (slug, name, description, owner_user_id, invite_token, visibility) VALUES ($1, $2, $3, $4, $5, 'public') RETURNING *`,
        [newSlug(parsed.value.name), parsed.value.name, parsed.value.description, user.id, newInviteToken()],
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
     LEFT JOIN LATERAL (SELECT overall_xp FROM snapshots WHERE player_id = p.id AND captured_at <= (date_trunc('day', (now() AT TIME ZONE $2) - interval '6 hours') - interval '6 days' + interval '6 hours') AT TIME ZONE $2 ORDER BY captured_at DESC LIMIT 1) ws ON true
     LEFT JOIN LATERAL (SELECT overall_xp FROM snapshots WHERE player_id = p.id ORDER BY captured_at ASC LIMIT 1) fs ON true
     WHERE gm.clan_id = $1
     ORDER BY week_gain DESC, p.username`,
    [clanId, APP_TIMEZONE],
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
    requests: canManage(role) ? await listJoinRequests(clan.id) : [],
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
  const waiting = new Map((await pendingRequestCounts(user.id)).map((r) => [r.slug, r.n]))
  await addMyStandings(clans, owned)
  return rows.map((r) => {
    const c = bySlug.get(r.slug)
    const owner = r.owner_user_id === user.id
    return { ...c, owner, role: owner ? 'owner' : modOf.has(r.id) ? 'mod' : 'member', openCompetitions: c.competitions.length, pendingRequests: waiting.get(r.slug) || 0 }
  })
}

/**
 * For each running competition in these clans, where the account's own profiles stand in it: `my` = { username, displayName, rank,
 * gain, of } for the best placed of them, or null when none of them is an entrant. At most a dozen competitions are looked up.
 */
async function addMyStandings(clans, ownedIds) {
  const running = clans.flatMap((c) => c.competitions.filter((k) => k.status === 'running'))
  if (!running.length || !ownedIds.length) return
  const { rows } = await pool.query('SELECT lower(username) AS u FROM players WHERE id = ANY($1::int[])', [ownedIds])
  const mine = new Set(rows.map((r) => r.u))
  for (const k of running.slice(0, 12)) {
    k.my = null
    try {
      const detail = await getCompetition(k.id)
      const table = detail?.standings || []
      const best = table.filter((r) => mine.has(String(r.username).toLowerCase())).sort((a, b) => a.rank - b.rank)[0]
      if (best) k.my = { username: best.username, displayName: best.displayName, rank: best.rank, gain: best.gain, pending: Boolean(best.pending), of: table.length }
    } catch (err) {
      console.error('[clans] could not work out a standing:', err.message)
    }
  }
}

// --- joining and leaving ---------------------------------------------------------------------------------------------

/** The tracked player with this name; one not tracked yet is added from the OSRS hiscores first. */
async function resolvePlayer(name) {
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
  return player
}

/**
 * The owner or a moderator adds a player to the clan straight away, with no request to answer. A player not tracked yet is
 * added to the site first. Any request that player had waiting is cleared. Returns { player, alreadyMember }.
 */
export async function addMemberDirect(clan, user, rsn) {
  const name = cleanRsn(rsn)
  if (!name) throw new ClanError('Enter a RuneScape name: up to 12 letters, numbers, spaces, hyphens or underscores.')
  const player = await resolvePlayer(name)
  const who = { username: player.username, displayName: player.displayName }
  const { rowCount: isMember } = await pool.query('SELECT 1 FROM clan_members WHERE clan_id = $1 AND player_id = $2', [clan.id, player.id])
  if (isMember) return { player: who, alreadyMember: true }
  if ((await memberCount(clan.id)) >= MAX_MEMBERS) throw new ClanError(`This clan is full (${MAX_MEMBERS} members).`, 409)
  // The verified tick says the profile's owner joined, so adding someone else never gives it; adding your own profile does.
  const mine = await ownedPlayerIds(user.id)
  await addMember(clan, player, mine.includes(player.id) ? user.id : null)
  await pool.query('DELETE FROM clan_join_requests WHERE clan_id = $1 AND player_id = $2', [clan.id, player.id])
  await notifyAdded(clan, player, user.id)
  return { player: who, alreadyMember: false }
}

export async function joinClan({ token, rsn, user }) {
  const name = cleanRsn(rsn)
  if (!name) throw new ClanError('Enter a RuneScape name: up to 12 letters, numbers, spaces, hyphens or underscores.')
  const { rows } = await pool.query('SELECT * FROM clans WHERE invite_token = $1', [String(token || '')])
  const clan = rows[0]
  if (!clan) throw new ClanError('That invite link is not valid any more. Ask for a new one.', 404)
  if ((await memberCount(clan.id)) >= MAX_MEMBERS) throw new ClanError(`This clan is full (${MAX_MEMBERS} members).`, 409)

  const player = await resolvePlayer(name)

  // An account that owns this RSN gets the verified tick.
  const mine = await ownedPlayerIds(user?.id)
  const verifiedBy = mine.includes(player.id) ? user.id : null
  const who = { username: player.username, displayName: player.displayName }
  const base = { slug: clan.slug, name: clan.name, player: who, verified: Boolean(verifiedBy) }

  const { rowCount: isMember } = await pool.query('SELECT 1 FROM clan_members WHERE clan_id = $1 AND player_id = $2', [clan.id, player.id])
  if (isMember) {
    if (verifiedBy) await pool.query('UPDATE clan_members SET user_id = $3 WHERE clan_id = $1 AND player_id = $2 AND user_id IS NULL', [clan.id, player.id, verifiedBy])
    return { ...base, status: 'member', alreadyMember: true }
  }

  // The owner and moderators add people straight away; everyone else asks, and one of them answers.
  if (user && canManage(await roleOf(clan, user.id))) {
    await addMember(clan, player, verifiedBy)
    return { ...base, status: 'member', alreadyMember: false }
  }

  if (clan.accepting_requests === false) throw new ClanError('This clan is not taking new join requests right now.', 403)
  const { rows: waiting } = await pool.query('SELECT count(*)::int AS n FROM clan_join_requests WHERE clan_id = $1', [clan.id])
  const { rowCount: existing } = await pool.query('SELECT 1 FROM clan_join_requests WHERE clan_id = $1 AND player_id = $2', [clan.id, player.id])
  if (!existing && waiting[0].n >= MAX_PENDING_REQUESTS) throw new ClanError('This clan has too many requests waiting. Try again once some have been answered.', 429)
  await pool.query(
    `INSERT INTO clan_join_requests (clan_id, player_id, user_id) VALUES ($1, $2, $3)
     ON CONFLICT (clan_id, player_id) DO UPDATE SET user_id = COALESCE(clan_join_requests.user_id, EXCLUDED.user_id)`,
    [clan.id, player.id, user?.id ?? null],
  )
  return { ...base, status: 'pending', alreadyMember: false, alreadyRequested: Boolean(existing) }
}

/**
 * Tells the account that owns this profile (a verified claim) it is in the clan now. Nothing for a profile nobody has verified,
 * and nothing for the account that did it itself. `approved` words it as the answer to that account's own request.
 */
async function notifyAdded(clan, player, byUserId, approved = false) {
  try {
    const owner = await ownerOfPlayer(player.id)
    if (!owner || owner === byUserId) return
    await addNotification(owner, {
      type: 'clan_added',
      text: approved ? `Your request to join ${clan.name} was approved` : `You were added to ${clan.name}`,
      link: `/clans/${clan.slug}`,
      // Once per add; adding them again after they were removed is a new notice.
      dedupeKey: `clan-added:${clan.id}:${player.id}:${Math.floor(Date.now() / 60_000)}`,
      subject: player.username,
    })
  } catch (err) {
    console.error('[clans] could not notify the added player:', err.message)
  }
}

/** Puts a player in the clan (and in its competitions that have not finished). */
async function addMember(clan, player, verifiedBy) {
  const { rowCount } = await pool.query('INSERT INTO clan_members (clan_id, player_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [clan.id, player.id, verifiedBy])
  if (rowCount) await addEntrantToOpenCompetitions(clan.id, player).catch((err) => console.error('[clans] could not add the new member to competitions:', err.message))
  return rowCount > 0
}

// --- join requests ----------------------------------------------------------------------------------------------------------

/** Turns new join requests on or off for a clan. Requests already waiting can still be answered. Owner only (checked by the route). */
export async function setAcceptingRequests(clan, accepting) {
  await pool.query('UPDATE clans SET accepting_requests = $2 WHERE id = $1', [clan.id, Boolean(accepting)])
  return Boolean(accepting)
}

/** The requests waiting in a clan, oldest first, for its owner and moderators. */
export async function listJoinRequests(clanId) {
  const { rows } = await pool.query(
    `SELECT p.username, p.display_name, r.created_at, r.user_id, ls.overall_level
     FROM clan_join_requests r
     JOIN players p ON p.id = r.player_id
     LEFT JOIN LATERAL (SELECT overall_level FROM snapshots WHERE player_id = p.id ORDER BY captured_at DESC LIMIT 1) ls ON true
     WHERE r.clan_id = $1 ORDER BY r.created_at`,
    [clanId],
  )
  return rows.map((r) => ({ username: r.username, displayName: r.display_name, requestedAt: r.created_at, overallLevel: r.overall_level, signedIn: r.user_id != null }))
}

async function requestFor(clan, username) {
  const player = await getPlayerByUsername(username)
  const { rows } = player ? await pool.query('SELECT * FROM clan_join_requests WHERE clan_id = $1 AND player_id = $2', [clan.id, player.id]) : { rows: [] }
  if (!rows[0]) throw new ClanError('That request is not waiting any more.', 404)
  return { player, request: rows[0] }
}

/** Lets a waiting player in. The verified tick goes to the account that asked, when it owns that RSN. */
export async function approveRequest(clan, username, byUserId = null) {
  const { player, request } = await requestFor(clan, username)
  if ((await memberCount(clan.id)) >= MAX_MEMBERS) throw new ClanError(`This clan is full (${MAX_MEMBERS} members).`, 409)
  const owned = await ownedPlayerIds(request.user_id)
  await addMember(clan, player, owned.includes(player.id) ? request.user_id : null)
  await pool.query('DELETE FROM clan_join_requests WHERE id = $1', [request.id])
  // When the account that asked is the one that owns the profile, the notice answers its request.
  await notifyAdded(clan, player, byUserId, owned.includes(player.id))
}

/** Turns a request down. It is simply removed. */
export async function declineRequest(clan, username) {
  const { request } = await requestFor(clan, username)
  await pool.query('DELETE FROM clan_join_requests WHERE id = $1', [request.id])
}

/** Each request waiting in the clans this account answers for, newest first: [{ slug, clanName, username, displayName, requestedAt }]. */
export async function pendingRequestsFor(userId, limit = 50) {
  const owned = await ownedPlayerIds(userId)
  const { rows } = await pool.query(
    `SELECT c.slug, c.name AS clan_name, p.username, p.display_name, r.created_at
     FROM clan_join_requests r
     JOIN clans c ON c.id = r.clan_id
     JOIN players p ON p.id = r.player_id
     WHERE c.owner_user_id = $1 OR c.id IN (SELECT clan_id FROM clan_members WHERE role = 'mod' AND player_id = ANY($2::int[]))
     ORDER BY r.created_at DESC LIMIT $3`,
    [userId, owned, limit],
  )
  return rows.map((r) => ({ slug: r.slug, clanName: r.clan_name, username: r.username, displayName: r.display_name, requestedAt: r.created_at }))
}

/** The clans where this account answers requests (it owns them, or a profile it has verified is a moderator), with how many wait. */
export async function pendingRequestCounts(userId) {
  const owned = await ownedPlayerIds(userId)
  const { rows } = await pool.query(
    `SELECT c.slug, c.name, count(r.id)::int AS n
     FROM clans c JOIN clan_join_requests r ON r.clan_id = c.id
     WHERE c.owner_user_id = $1 OR c.id IN (SELECT clan_id FROM clan_members WHERE role = 'mod' AND player_id = ANY($2::int[]))
     GROUP BY c.id, c.slug, c.name ORDER BY max(r.created_at) DESC`,
    [userId, owned],
  )
  return rows
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
    acceptingRequests: clan.accepting_requests !== false,
    description: clan.description,
    memberCount: members.length,
    members: shown.map((m) => ({ username: m.username, displayName: m.displayName, overallLevel: m.overallLevel, weekGain: m.weekGain, photo: photos.get(m.username.toLowerCase()) || null })),
    moreMembers: Math.max(members.length - shown.length, 0),
    competitions: comps.map((c) => ({ id: c.id, title: c.title, label: metricLabel({ metric: c.metric, skill: c.skill }), status: c.status, startsAt: c.starts_at, endsAt: c.ends_at })),
  }
}

// --- search engines -----------------------------------------------------------------------------------------------------

/** Every clan's page address and when it last changed (created, or a competition started or finished), for the sitemap. */
export async function listClansForSitemap(limit = 5000) {
  const { rows } = await pool.query(
    `SELECT c.slug, GREATEST(c.created_at, COALESCE(max(k.started_at), c.created_at), COALESCE(max(k.finished_at), c.created_at)) AS touched
     FROM clans c LEFT JOIN competitions k ON k.clan_id = c.id
     GROUP BY c.id ORDER BY c.created_at DESC LIMIT $1`,
    [limit],
  )
  return rows.map((r) => ({ slug: r.slug, lastmod: new Date(r.touched).toISOString().slice(0, 10) }))
}

/** What a clan's page says about itself in its title and description, or null when there is no such clan. */
export async function getClanSeo(slug) {
  const clan = await clanBySlug(slug)
  if (!clan) return null
  const { rows } = await pool.query(
    `SELECT p.display_name FROM clan_members m JOIN players p ON p.id = m.player_id WHERE m.clan_id = $1 ORDER BY m.joined_at LIMIT 3`,
    [clan.id],
  )
  return { slug: clan.slug, name: clan.name, description: clan.description, memberCount: await memberCount(clan.id), members: rows.map((r) => r.display_name) }
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
     LEFT JOIN LATERAL (SELECT overall_xp FROM snapshots WHERE player_id = p.id AND captured_at <= (date_trunc('day', (now() AT TIME ZONE $2) - interval '6 hours') - interval '6 days' + interval '6 hours') AT TIME ZONE $2 ORDER BY captured_at DESC LIMIT 1) ws ON true
     LEFT JOIN LATERAL (SELECT overall_xp FROM snapshots WHERE player_id = p.id ORDER BY captured_at ASC LIMIT 1) fs ON true
     WHERE gm.clan_id = ANY($1::int[])`,
    [ids, APP_TIMEZONE],
  )
  const { rows: comps } = await pool.query(
    `SELECT c.id, c.clan_id, c.title, c.metric, c.skill, c.status, c.starts_at, c.ends_at,
            (SELECT count(*)::int FROM competition_members cm WHERE cm.competition_id = c.id) AS entrants
     FROM competitions c WHERE c.clan_id = ANY($1::int[]) AND c.status IN ('scheduled', 'running')`,
    [ids],
  )
  return summarizeClans(clans, members, comps.map((c) => ({ ...c, label: metricLabel({ metric: c.metric, skill: c.skill }) })))
}

/** Every clan, newest first, with their size, this week's XP, top gainers and competitions. */
export async function listPublicClans() {
  const { rows } = await pool.query(`SELECT id, slug, name, description, visibility, created_at FROM clans WHERE visibility = 'public' ORDER BY created_at DESC LIMIT $1`, [LISTED_LIMIT])
  return summarize(rows)
}

