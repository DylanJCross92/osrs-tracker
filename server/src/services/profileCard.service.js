import { pool } from '../db.js'
import { getLatestSnapshot } from './players.service.js'
import { getWeeklyCardData } from './cards.service.js'
import { getAvatar } from './profilePages.service.js'
import { ownerOfPlayer } from './inbox.service.js'

/**
 * Everything the profile link preview card shows: the picture, name, level and XP, rank, this week's gain and the
 * skills that moved most. Returns null for a player with no snapshots yet.
 */
export async function getProfileCardData(player) {
  const [latest, weekly, badgeRow, ownerId, avatar] = await Promise.all([
    getLatestSnapshot(player.id),
    getWeeklyCardData(player.id, 'Overall', 'week').catch(() => null),
    pool.query('SELECT badge FROM players WHERE id = $1', [player.id]),
    ownerOfPlayer(player.id),
    getAvatar(player.id),
  ])
  if (!latest) return null

  const skills = Object.entries(latest.skills || {})
  const highest = skills.sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp)[0]
  // The satori renderer reads JPEG and PNG; a WebP upload falls back to the generated picture on the card.
  const photo = avatar && (avatar.type === 'image/jpeg' || avatar.type === 'image/png') ? `data:${avatar.type};base64,${Buffer.from(avatar.data).toString('base64')}` : null

  return {
    username: player.username,
    displayName: player.displayName,
    overallLevel: latest.overallLevel,
    overallXp: latest.overallXp,
    overallRank: latest.overallRank > 0 ? latest.overallRank : null,
    weekXp: weekly?.xpGained > 0 ? weekly.xpGained : 0,
    topSkills: (weekly?.topSkills || []).slice(0, 3),
    highest: highest ? { skill: highest[0], level: highest[1].level } : null,
    claimed: Boolean(ownerId),
    badge: badgeRow.rows[0]?.badge || null,
    photo,
    capturedAt: latest.capturedAt,
  }
}
