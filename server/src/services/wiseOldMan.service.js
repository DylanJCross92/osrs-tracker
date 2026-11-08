import { SKILL_NAMES } from './osrsHiscores.service.js'

// Thin client for Wise Old Man's public API, used only to backfill history
// for a brand-new player, our own hourly sync is the source of truth
// going forward. No API key: https://docs.wiseoldman.net/api, 20 req/min,
// so deep history (years of densely-tracked snapshots) takes real wall time
// to pull; callers should surface progress rather than assume this is fast.
const WOM_BASE_URL = 'https://api.wiseoldman.net/v2'

// WOM keys its skills in lowercase, matching our names, except Runecraft.
const WOM_SKILL_KEY_OVERRIDES = { Runecraft: 'runecrafting' }
function womSkillKey(name) {
  return WOM_SKILL_KEY_OVERRIDES[name] ?? name.toLowerCase()
}

const PAGE_SIZE = 200
const MAX_PAGES = 75 // up to 15,000 snapshots, enough for years of dense history
const REQUEST_DELAY_MS = 3200 // keeps us under WOM's 20-req/min unauthenticated limit
const RATE_LIMIT_BACKOFF_MS = 65_000 // a minute-window reset, plus a little slack

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeWomEntry(entry) {
  return {
    level: entry?.level > 0 ? entry.level : 1,
    xp: Math.max(entry?.experience ?? 0, 0),
    rank: entry?.rank > 0 ? entry.rank : null,
  }
}

function mapSnapshot(snap) {
  const capturedAt = new Date(snap.createdAt)
  const skillsData = snap.data?.skills ?? {}
  const skills = {}
  for (const name of SKILL_NAMES) skills[name] = normalizeWomEntry(skillsData[womSkillKey(name)])
  return { capturedAt, overall: normalizeWomEntry(skillsData.overall), skills }
}

/**
 * Fetches one page of snapshots, retrying once after a backoff on a 429.
 * Returns null (never throws) on anything else going wrong, so the caller
 * can just stop paginating and use whatever it already has.
 */
async function fetchPage(username, offset) {
  const url = `${WOM_BASE_URL}/players/${encodeURIComponent(username)}/snapshots?limit=${PAGE_SIZE}&offset=${offset}`
  for (let attempt = 0; attempt < 2; attempt++) {
    let res
    try {
      res = await fetch(url)
    } catch {
      return null
    }
    if (res.status === 429) {
      if (attempt === 0) {
        await sleep(RATE_LIMIT_BACKOFF_MS)
        continue
      }
      return null
    }
    if (!res.ok) return null // 404 (not tracked on WOM), etc.
    try {
      return await res.json()
    } catch {
      return null
    }
  }
  return null
}

/**
 * Fetches a player's full historical snapshots from Wise Old Man, oldest
 * first, mapped to our own snapshot shape ({ capturedAt, overall, skills }).
 * WOM only has data going back to whenever the community started tracking
 * that player, which varies hugely, this is a best-effort backfill, not a
 * guarantee of full account history. Never throws: returns [] if WOM
 * doesn't know the player, is unreachable, or returns anything unexpected.
 *
 * This runs in the background (see players.service.js) and can take well
 * over a minute for a densely-tracked account, since WOM's rate limit caps
 * us at ~20 req/min, hence the console logging, our only visibility into
 * a long-running import once it's detached from the request that started it.
 */
export async function fetchWomHistory(username) {
  const batches = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await fetchPage(username, page * PAGE_SIZE)
    if (!Array.isArray(batch) || batch.length === 0) break

    batches.push(...batch)
    console.log(`Wise Old Man import for "${username}": ${batches.length} snapshots so far...`)
    if (batch.length < PAGE_SIZE) break // last page
    if (page < MAX_PAGES - 1) await sleep(REQUEST_DELAY_MS)
  }

  return batches
    .map(mapSnapshot)
    .filter((s) => !Number.isNaN(s.capturedAt.getTime()))
    .sort((a, b) => a.capturedAt - b.capturedAt)
}
