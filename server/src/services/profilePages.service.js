import { pool } from '../db.js'
import { MAX_AVATAR_BYTES, sanitizeProfilePage, sniffImageType } from '../utils/profilePage.js'

export class PageError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

/** Whether this account owns this profile (a verified claim). */
export async function isOwner(userId, playerId) {
  const { rows } = await pool.query(`SELECT 1 FROM profile_claims WHERE user_id = $1 AND player_id = $2 AND status = 'verified'`, [userId, playerId])
  return rows.length > 0
}

/** The public parts of a profile's page. Everything has an empty default, so an uncustomised profile returns a blank page. */
export async function getProfilePage(playerId) {
  const { rows } = await pool.query(
    `SELECT bio, status, links, hidden_sections, (avatar IS NOT NULL) AS has_avatar, extract(epoch from avatar_updated_at)::bigint AS avatar_v FROM profile_pages WHERE player_id = $1`,
    [playerId],
  )
  const r = rows[0]
  return {
    bio: r?.bio || '',
    status: r?.status || '',
    links: r?.links || [],
    hiddenSections: r?.hidden_sections || [],
    hasAvatar: Boolean(r?.has_avatar),
    avatarV: r?.has_avatar ? Number(r.avatar_v) : null,
  }
}

/** Saves the fields that were sent (after cleaning them). */
export async function saveProfilePage(playerId, input) {
  const patch = sanitizeProfilePage(input)
  await pool.query(
    `INSERT INTO profile_pages (player_id, bio, status, links, hidden_sections)
     VALUES ($1, COALESCE($2, ''), COALESCE($3, ''), COALESCE($4::jsonb, '[]'::jsonb), COALESCE($5::jsonb, '[]'::jsonb))
     ON CONFLICT (player_id) DO UPDATE SET
       bio = COALESCE($2, profile_pages.bio),
       status = COALESCE($3, profile_pages.status),
       links = COALESCE($4::jsonb, profile_pages.links),
       hidden_sections = COALESCE($5::jsonb, profile_pages.hidden_sections),
       updated_at = now()`,
    [playerId, patch.bio ?? null, patch.status ?? null, patch.links ? JSON.stringify(patch.links) : null, patch.hiddenSections ? JSON.stringify(patch.hiddenSections) : null],
  )
  return getProfilePage(playerId)
}

export async function saveAvatar(playerId, buf) {
  if (!Buffer.isBuffer(buf) || !buf.length) throw new PageError('Choose an image first.')
  if (buf.length > MAX_AVATAR_BYTES) throw new PageError('That picture is too big. Try a smaller one.', 413)
  const type = sniffImageType(buf)
  if (!type) throw new PageError('Pictures must be JPEG, PNG or WebP.', 415)
  await pool.query(
    `INSERT INTO profile_pages (player_id, avatar, avatar_type, avatar_updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (player_id) DO UPDATE SET avatar = $2, avatar_type = $3, avatar_updated_at = now(), updated_at = now()`,
    [playerId, buf, type],
  )
}

export async function removeAvatar(playerId) {
  await pool.query('UPDATE profile_pages SET avatar = NULL, avatar_type = NULL, avatar_updated_at = NULL, updated_at = now() WHERE player_id = $1', [playerId])
}

export async function getAvatar(playerId) {
  const { rows } = await pool.query('SELECT avatar, avatar_type, extract(epoch from avatar_updated_at)::bigint AS v FROM profile_pages WHERE player_id = $1 AND avatar IS NOT NULL', [playerId])
  return rows[0] ? { data: rows[0].avatar, type: rows[0].avatar_type, version: Number(rows[0].v) } : null
}

/** Owner-only wipe for the site's admins: removes all custom content from a profile. */
export async function resetProfilePage(playerId) {
  await pool.query('DELETE FROM profile_pages WHERE player_id = $1', [playerId])
}
