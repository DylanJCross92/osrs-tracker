import { pool } from '../db.js'
import { MAX_AVATAR_BYTES, sanitizeProfilePage, sniffImageType } from '../utils/profilePage.js'
import { getProfileAchievements } from './milestones.service.js'

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
    `SELECT bio, links, pinned_achievement, (avatar IS NOT NULL) AS has_avatar, extract(epoch from avatar_updated_at)::bigint AS avatar_v FROM profile_pages WHERE player_id = $1`,
    [playerId],
  )
  const r = rows[0]
  return {
    bio: r?.bio || '',
    links: r?.links || [],
    pinnedAchievement: r?.pinned_achievement || null,
    hasAvatar: Boolean(r?.has_avatar),
    avatarV: r?.has_avatar ? Number(r.avatar_v) : null,
  }
}

/** Saves the fields that were sent (after cleaning them). */
export async function saveProfilePage(playerId, input) {
  const patch = sanitizeProfilePage(input)
  // Only an achievement the profile has really earned can be pinned.
  if (patch.pinnedAchievement) {
    const { achievements } = await getProfileAchievements(playerId)
    if (!achievements.some((a) => a.key === patch.pinnedAchievement && a.completed)) throw new PageError('You can only pin an achievement this profile has earned.')
  }
  const hasPinned = 'pinnedAchievement' in patch
  await pool.query(
    `INSERT INTO profile_pages (player_id, bio, links, pinned_achievement)
     VALUES ($1, COALESCE($2, ''), COALESCE($3::jsonb, '[]'::jsonb), $5::text)
     ON CONFLICT (player_id) DO UPDATE SET
       bio = COALESCE($2, profile_pages.bio),
       links = COALESCE($3::jsonb, profile_pages.links),
       pinned_achievement = CASE WHEN $4::boolean THEN $5::text ELSE profile_pages.pinned_achievement END,
       updated_at = now()`,
    [playerId, patch.bio ?? null, patch.links ? JSON.stringify(patch.links) : null, hasPinned, hasPinned && patch.pinnedAchievement ? patch.pinnedAchievement : null],
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
