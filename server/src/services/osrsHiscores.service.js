// Thin client for the official OSRS hiscores lite feed. No API key, it's a
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

/** Hiscores couldn't be reached or are rate-limiting us, even after retrying. */
export class HiscoresUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.status = 503
  }
}

const MAX_ATTEMPTS = 3
const REQUEST_TIMEOUT_MS = 15_000
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Seconds from a Retry-After header (numeric form only), capped so one slow
// response can't stall a whole sync run for long.
function retryAfterMs(res) {
  const n = Number(res.headers.get('retry-after'))
  return Number.isFinite(n) && n > 0 ? Math.min(n * 1000, 30_000) : null
}

// Fetches with a timeout and retries 429 / 5xx / network errors with
// exponential backoff + jitter. 404 (unknown player) and other 4xx are
// answers, not outages, so they return immediately.
async function fetchWithRetry(url) {
  let lastReason = 'unknown error'
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let wait = null
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
      if (res.status !== 429 && res.status < 500) return res
      lastReason = `status ${res.status}`
      wait = retryAfterMs(res)
    } catch (err) {
      lastReason = err?.name === 'TimeoutError' ? 'request timed out' : `network error (${err?.message || err})`
    }
    if (attempt < MAX_ATTEMPTS) {
      const backoff = wait ?? 1000 * 3 ** (attempt - 1) // 1s, then 3s
      await sleep(backoff + Math.random() * 500)
    }
  }
  throw new HiscoresUnavailableError(`OSRS hiscores are unavailable right now (${lastReason}).`)
}

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
  const res = await fetchWithRetry(url)

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
