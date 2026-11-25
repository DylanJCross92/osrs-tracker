import crypto from 'node:crypto'

// Rules for clans: how big they may be, what a name may contain, and the tokens that make a page and an invite link.
// Pure, so they can be tested without a database.
// Requests waiting for an answer, per clan, so a flood of them cannot bury the real ones.
export const MAX_PENDING_REQUESTS = 50
export const MAX_MEMBERS = 100
export const MAX_CLANS_PER_USER = 3
export const MAX_ACTIVE_COMPETITIONS = 3
export const NAME_MIN = 3
export const NAME_MAX = 40
export const DESCRIPTION_MAX = 200
const RSN_RE = /^[A-Za-z0-9 _-]{1,12}$/

// Control characters and line breaks collapse to a space, so a name is always one tidy line.
export const plain = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '')
const hasLink = (v) => /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|gg|io|tv|co|me|ly)\b)/i.test(v)

/** { ok: true, value: { name, description } } or { ok: false, error } from a request body. */
export function cleanClanInput(body) {
  const name = plain(body?.name, NAME_MAX)
  const description = plain(body?.description, DESCRIPTION_MAX)
  if (name.length < NAME_MIN) return { ok: false, error: `Give the clan a name of at least ${NAME_MIN} characters.` }
  if (hasLink(name) || hasLink(description)) return { ok: false, error: 'Links are not allowed in a clan name or description.' }
  return { ok: true, value: { name, description } }
}

/** An RSN the way the hiscores accept it, or null. */
export function cleanRsn(value) {
  // Checked at full length: a longer name is rejected, never quietly cut down to a different player's name.
  const rsn = plain(value, 100)
  return RSN_RE.test(rsn) ? rsn : null
}

export function slugify(name) {
  const s = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '')
  return s || 'clan'
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
const randomChars = (n) => Array.from({ length: n }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('')

/** The page address: the name plus a short random part, so a page cannot be guessed from its name. */
export const newSlug = (name) => `${slugify(name)}-${randomChars(5)}`
/** The secret in an invite link. */
export const newInviteToken = () => crypto.randomBytes(16).toString('base64url')

/**
 * The line that goes with an invite link when it is pasted somewhere: how many are in the clan and what is on.
 * `competitions` are the open ones, soonest first: [{ title, label, status }].
 */
export function describeInvite({ name, memberCount, competitions }) {
  const people = `${memberCount} member${memberCount === 1 ? '' : 's'}`
  const c = competitions?.[0]
  if (c) return `${people}. ${c.status === 'running' ? 'Running now' : 'Starting soon'}: ${c.title} (${c.label}). Ask to join with your RuneScape name.`
  return `${people}. Ask to join ${name} with your RuneScape name, no account needed.`
}


/**
 * The Clans page, from raw rows: each listed clan with its size, XP gained by its members this week, its three top gainers and
 * the competitions that are on or coming up, plus the competitions running across all of them and the page totals.
 * `clanRows`: [{ id, slug, name, description, created_at }]; `memberRows`: [{ clan_id, username, display_name, week_gain,
 * overall_level }]; `competitionRows`: [{ id, clan_id, title, label, status, starts_at, ends_at, entrants }] (open ones only).
 * Clans come back most active first (this week's XP, then size).
 */
export function summarizeClans(clanRows, memberRows, competitionRows) {
  const membersBy = new Map()
  for (const m of memberRows) {
    if (!membersBy.has(m.clan_id)) membersBy.set(m.clan_id, [])
    membersBy.get(m.clan_id).push(m)
  }
  const compsBy = new Map()
  for (const c of competitionRows) {
    if (!compsBy.has(c.clan_id)) compsBy.set(c.clan_id, [])
    compsBy.get(c.clan_id).push(c)
  }
  const clans = clanRows.map((c) => {
    const members = (membersBy.get(c.id) || []).map((m) => ({ username: m.username, displayName: m.display_name, weekGain: Math.max(Number(m.week_gain) || 0, 0), overallLevel: m.overall_level ?? null }))
    members.sort((a, b) => b.weekGain - a.weekGain || a.username.toLowerCase().localeCompare(b.username.toLowerCase()))
    const competitions = (compsBy.get(c.id) || [])
      .map((x) => ({ id: x.id, title: x.title, label: x.label, status: x.status, startsAt: x.starts_at, endsAt: x.ends_at, entrants: Number(x.entrants) || 0 }))
      // Running ones first, then the soonest to start.
      .sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running') || new Date(a.startsAt) - new Date(b.startsAt))
    const weekGain = members.reduce((sum, m) => sum + m.weekGain, 0)
    return { slug: c.slug, name: c.name, description: c.description, visibility: c.visibility, createdAt: c.created_at, acceptingRequests: c.accepting_requests !== false, openJoin: Boolean(c.open_join), official: Boolean(c.official), memberCount: members.length, weekGain, topMembers: members.slice(0, 3), competitions }
  })
  clans.sort((a, b) => b.weekGain - a.weekGain || b.memberCount - a.memberCount || a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
  const running = clans
    .flatMap((c) => c.competitions.filter((x) => x.status === 'running').map((x) => ({ ...x, clan: { slug: c.slug, name: c.name } })))
    .sort((a, b) => new Date(a.endsAt) - new Date(b.endsAt))
  return {
    clans,
    running,
    totals: { clans: clans.length, members: clans.reduce((n, c) => n + c.memberCount, 0), runningCompetitions: running.length, weekGain: clans.reduce((n, c) => n + c.weekGain, 0) },
  }
}
