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
  clan_share: 'clan',
}
// Events that are always a copied link.
const LINK_EVENTS = { calc_share: 'calculator', compare_share_copy: 'compare', shared_plan_link_copied: 'plan' }

/**
 * { kind, method, item } when an analytics event is somebody sharing a link or image, otherwise null. `item` is what was shared
 * (a player's name, a clan or plan name, a skill), when the share button said; it goes to the site's own share count only.
 */
export function shareFromEvent(event, params = {}) {
  const item = typeof params?.item === 'string' && params.item.trim() ? { item: params.item.trim().slice(0, 80) } : {}
  if (LINK_EVENTS[event]) return { kind: LINK_EVENTS[event], method: 'link', ...item }
  const kind = SHARE_EVENTS[event]
  const method = METHOD_GROUP[params?.method]
  return kind && method ? { kind, method, ...item } : null
}

/**
 * Which player (or player and record) a shared link is about, in the same words the share buttons use, so a share and the
 * visits it brings add up on one line. '' for links that name nothing public (a clan invite, a plan).
 */
export function sharedLinkItem(path) {
  const p = String(path || '')
  const decode = (v) => {
    try {
      return decodeURIComponent(v).toLowerCase()
    } catch {
      return String(v).toLowerCase()
    }
  }
  let m = /^\/challenge\/([^/?#]+)/i.exec(p)
  if (m) return decode(m[1])
  m = /^\/player\/([^/?#]+)\/records\/([^/?#]+)/i.exec(p)
  if (m) return `${decode(m[1])} · ${decode(m[2])}`
  m = /^\/player\/([^/?#]+)\/(?:goals|card\/weekly)(?:\/|$|\?)/i.exec(p)
  return m ? decode(m[1]) : ''
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
  if (/^\/join\/[^/]+/i.test(p)) return 'clan'
  if (query?.from === 'share') {
    if (/^\/planner/i.test(p)) return 'plan'
    if (/^\/compare/i.test(p)) return 'compare'
    if (/^\/calculators/i.test(p)) return 'calculator'
  }
  return null
}

// Where a visitor came from. Must match SOURCES on the server (server/src/utils/shareStats.js), which counts anything else as direct.
const TAG_ALIASES = { twitter: 'x', fb: 'facebook', ig: 'instagram', yt: 'youtube', ddg: 'duckduckgo', runescape_wiki: 'wiki' }
const TAGGED = ['discord', 'x', 'reddit', 'facebook', 'instagram', 'tiktok', 'youtube', 'twitch', 'google', 'bing', 'duckduckgo', 'wiki']

/** The referring site's name without "www." ('l.facebook.com'), or '' when there is none, it is junk or it is this site. */
export function referrerHost(referrer, ownHost = '') {
  if (!referrer) return ''
  let host
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
  const own = String(ownHost).toLowerCase().replace(/^www\./, '')
  return own && (host === own || host.endsWith(`.${own}`)) ? '' : host
}

/**
 * Where a visitor came from. In order:
 *  1. a tag on the link itself, ?utm_source=facebook (so a link you post somewhere says where it was posted);
 *  2. the site that sent them, from document.referrer;
 *  3. with no referrer at all (apps often send none): Facebook's click id (?fbclid) or the in-app browser of Facebook, Instagram or TikTok;
 *  4. otherwise direct.
 * Visits from this site itself count as direct. `search` is location.search, `userAgent` navigator.userAgent.
 */
export function referrerSource(referrer, ownHost = '', { search = '', userAgent = '' } = {}) {
  try {
    const tag = String(new URLSearchParams(search).get('utm_source') || '').toLowerCase().trim()
    const id = TAG_ALIASES[tag] || tag
    if (TAGGED.includes(id)) return id
  } catch {
    /* no usable query: carry on */
  }
  if (!referrer) return appSource(search, userAgent)
  const host = referrerHost(referrer, ownHost)
  if (!host) return 'direct'
  const is = (...domains) => domains.some((d) => host === d || host.endsWith(`.${d}`))
  if (is('discord.com', 'discordapp.com', 'discord.gg')) return 'discord'
  if (is('twitter.com', 'x.com', 't.co')) return 'x'
  if (is('reddit.com', 'redd.it')) return 'reddit'
  if (is('facebook.com', 'fb.com', 'fb.me', 'messenger.com')) return 'facebook'
  if (is('instagram.com')) return 'instagram'
  if (is('tiktok.com')) return 'tiktok'
  if (is('youtube.com', 'youtu.be')) return 'youtube'
  if (is('twitch.tv')) return 'twitch'
  if (host.split('.').includes('google')) return 'google'
  if (is('bing.com')) return 'bing'
  if (is('duckduckgo.com')) return 'duckduckgo'
  if (is('oldschool.runescape.wiki')) return 'wiki'
  return 'other'
}

// Links opened inside an app often arrive with no referrer; the app still leaves its mark.
function appSource(search, userAgent) {
  try {
    if (new URLSearchParams(search).has('fbclid')) return 'facebook'
  } catch {
    /* ignore */
  }
  const ua = String(userAgent || '')
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'facebook'
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/musical_ly|TikTok|BytedanceWebview/i.test(ua)) return 'tiktok'
  return 'direct'
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
