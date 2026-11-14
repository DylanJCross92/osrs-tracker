// Pure rules for the site's own share statistics: which analytics events are shares, and which page loads are people
// arriving through a shared link. Kept free of imports so they are easy to test; the sending happens in analytics.js
// (shares) and the router (visits).

// How each share button describes itself, in the three groups the admin page reports.
const METHOD_GROUP = {
  copy_link: 'link',
  copy_message: 'link',
  live: 'link',
  snapshot: 'link',
  download: 'image',
  copy_image: 'image',
  x: 'social',
  reddit: 'social',
  native: 'social',
}

// The analytics event for each thing that can be shared, and what it is called in the statistics.
const SHARE_EVENTS = {
  share_card: 'weekly_card',
  challenge_share: 'challenge',
  record_share: 'record',
  goal_share: 'goal',
  plan_share: 'plan',
}
// Events that are always a copied link.
const LINK_EVENTS = { calc_share: 'calculator', compare_share_copy: 'compare', shared_plan_link_copied: 'plan' }

/** { kind, method } when an analytics event is somebody sharing a link or image, otherwise null. */
export function shareFromEvent(event, params = {}) {
  if (LINK_EVENTS[event]) return { kind: LINK_EVENTS[event], method: 'link' }
  const kind = SHARE_EVENTS[event]
  const method = METHOD_GROUP[params?.method]
  return kind && method ? { kind, method } : null
}

/**
 * What a page load was, if it came through a shared link: a challenge, a record, a goal, a weekly card, a plan, or (for
 * links that carry ?from=share) a planner, compare or calculator link. `path` is where the person first asked to go,
 * before the app redirected them. Returns null for everything else.
 */
export function sharedLinkKind(path, query = {}) {
  const p = String(path || '')
  if (/^\/challenge\/[^/]+/i.test(p)) return 'challenge'
  if (/^\/player\/[^/]+\/records\/[^/]+/i.test(p)) return 'record'
  if (/^\/player\/[^/]+\/goals\/[^/]+/i.test(p)) return 'goal'
  if (/^\/player\/[^/]+\/card\/weekly/i.test(p)) return 'weekly_card'
  if (/^\/plan\/[^/]+/i.test(p)) return 'plan'
  if (query?.from === 'share') {
    if (/^\/planner/i.test(p)) return 'plan'
    if (/^\/compare/i.test(p)) return 'compare'
    if (/^\/calculators/i.test(p)) return 'calculator'
  }
  return null
}

/** Where a visitor came from, from document.referrer. Links opened in an app that sends no referrer count as direct. */
export function referrerSource(referrer, ownHost = '') {
  if (!referrer) return 'direct'
  let host
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return 'direct'
  }
  const own = String(ownHost).toLowerCase().replace(/^www\./, '')
  if (own && (host === own || host.endsWith(`.${own}`))) return 'direct'
  const is = (...domains) => domains.some((d) => host === d || host.endsWith(`.${d}`))
  if (is('discord.com', 'discordapp.com', 'discord.gg')) return 'discord'
  if (is('twitter.com', 'x.com', 't.co')) return 'x'
  if (is('reddit.com', 'redd.it')) return 'reddit'
  if (is('facebook.com', 'fb.com', 'fb.me')) return 'facebook'
  if (host.split('.').includes('google')) return 'google'
  return 'other'
}

/**
 * Whether this browser still owes the server a visit of this kind today, remembering it when it does. A person who
 * opens the same shared link five times in a day, or refreshes, is one visit. `store` is only for tests.
 */
export function claimVisit(key, now = new Date(), store) {
  const KEY = 'tickgains-visits-v1'
  const today = now.toISOString().slice(0, 10)
  try {
    const s = store || window.localStorage
    const seen = JSON.parse(s.getItem(KEY) || '{}')
    if (seen[key] === today) return false
    const next = { [key]: today }
    // Keep only today's entries so the record stays tiny.
    for (const [k, v] of Object.entries(seen)) if (v === today) next[k] = v
    s.setItem(KEY, JSON.stringify(next))
    return true
  } catch {
    // Without storage we cannot tell, so count it once per page load rather than never.
    return true
  }
}
