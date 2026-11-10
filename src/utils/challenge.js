import { BASE_URL } from '@/api/client'

const enc = encodeURIComponent

// A challenge is a link, nothing is stored. The server draws its preview image from the player's live week.
export const challengeUrl = (username) => `${window.location.origin}/challenge/${enc(username)}`
export const challengeImageUrl = (username) => `${BASE_URL}/players/${enc(username)}/challenge/image.png`

// The line that goes with the link. A week with no XP falls back to a plain dare.
export function challengeText(displayName, weekXp) {
  const gain = weekXp > 0 ? `I gained ${weekXp.toLocaleString('en-US')} XP in OSRS this week. ` : ''
  return `${gain}Think you can beat my week? Compare us on TickGains.`
}
