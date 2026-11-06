// Thin client for the official OSRS hiscores lite feed. No API key — it's a
// public endpoint Jagex also uses for the in-game hiscores widget.
const HISCORES_URL = 'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json'

// Every trainable skill, in no particular order (the JSON feed is keyed by
// name, unlike the old CSV feed where order mattered).
export const SKILL_NAMES = [
  'Attack',
  'Defence',
  'Strength',
  'Hitpoints',
  'Ranged',
  'Prayer',
  'Magic',
  'Cooking',
  'Woodcutting',
  'Fletching',
  'Fishing',
  'Firemaking',
  'Crafting',
  'Smithing',
  'Mining',
  'Herblore',
  'Agility',
  'Thieving',
  'Slayer',
  'Farming',
  'Runecraft',
  'Hunter',
  'Construction',
  'Sailing',
]

export class PlayerNotFoundError extends Error {}

function normalizeEntry(entry) {
  return {
    level: entry?.level ?? 1,
    xp: Math.max(entry?.xp ?? 0, 0),
    rank: entry?.rank > 0 ? entry.rank : null,
  }
}

/**
 * Fetches a single player's current hiscores and returns
 * { overall: {level, xp, rank}, skills: { [skillName]: {level, xp, rank} } }.
 * Throws PlayerNotFoundError for an unknown/never-logged-in RSN.
 */
export async function fetchHiscores(username) {
  const url = `${HISCORES_URL}?player=${encodeURIComponent(username)}`
  const res = await fetch(url)

  if (res.status === 404) {
    throw new PlayerNotFoundError(`"${username}" wasn't found on the OSRS hiscores.`)
  }
  if (!res.ok) {
    throw new Error(`OSRS hiscores request failed with status ${res.status}.`)
  }

  const data = await res.json()
  const byName = Object.fromEntries((data.skills || []).map((s) => [s.name, s]))

  const skills = {}
  for (const name of SKILL_NAMES) {
    skills[name] = normalizeEntry(byName[name])
  }

  return {
    overall: normalizeEntry(byName.Overall),
    skills,
  }
}
