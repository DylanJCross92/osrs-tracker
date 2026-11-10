import { pool } from '../db.js'
import { listPlayers } from './players.service.js'
import { achievementDefinitions } from './milestones.service.js'
import { buildInsights } from './discoverInsights.service.js'
import { MAX_TOTAL_LEVEL } from './milestones.service.js'

function card(p, featured = null) {
  const skills = p.latest?.skills || {}
  const entries = Object.entries(skills)
  const highest = entries.sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp)[0]
  return {
    id: p.id,
    username: p.username,
    displayName: p.displayName,
    badge: p.badge,
    claimed: p.claimed,
    overallLevel: p.latest?.overallLevel ?? null,
    overallXp: p.latest?.overallXp ?? null,
    overallRank: p.latest?.overallRank ?? null,
    featured: featured || (highest ? { kind: 'skill', skill: highest[0], text: `Level ${highest[1].level} ${highest[0]}` } : null),
  }
}

const gainText = (g) => (g ? { kind: 'gain', skill: g.topSkill, xp: g.xp, text: `+${Math.round(g.xp).toLocaleString('en-US')} XP` } : null)

// Compact per-player record the client uses for interactive leaderboards.
function compact(p) {
  const l = p.latest
  const highest = Object.entries(l?.skills || {}).sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp)[0]
  return {
    id: p.id,
    username: p.username,
    displayName: p.displayName,
    badge: p.badge,
    claimed: p.claimed,
    overallLevel: l?.overallLevel ?? null,
    overallXp: l?.overallXp ?? null,
    overallRank: l?.overallRank ?? null,
    capturedAt: l?.capturedAt ?? null,
    highest: highest ? { skill: highest[0], level: highest[1].level } : null,
    gains: {
      day: p.gains?.day ? { xp: p.gains.day.xp, topSkill: p.gains.day.topSkill, topSkillXp: p.gains.day.topSkillXp, topSkills: p.gains.day.topSkills } : null,
      week: p.gains?.week ? { xp: p.gains.week.xp, topSkill: p.gains.week.topSkill, topSkillXp: p.gains.week.topSkillXp, topSkills: p.gains.week.topSkills } : null,
      month: p.gains?.month ? { xp: p.gains.month.xp, topSkill: p.gains.month.topSkill, topSkillXp: p.gains.month.topSkillXp, topSkills: p.gains.month.topSkills } : null,
    },
    skillGains: p.skillGains,
    skillLevels: Object.fromEntries(Object.entries(l?.skills || {}).map(([k, v]) => [k, { level: v.level, xp: v.xp }])),
  }
}

const ACTIVITY_WINDOW_DAYS = 7

/**
 * Newest-first feed of what just happened across all players: level-ups and
 * 99s (from consecutive snapshots), big XP gains, and XP / total-level
 * milestones. Only consecutive snapshots a few hours apart count, so a gap in
 * old data is never reported as something that "just" happened.
 */
async function getActivity(byId) {
  const snaps = await pool.query(
    `SELECT player_id, captured_at, overall_xp, overall_level, skills
     FROM snapshots
     WHERE captured_at >= now() - ($1::int * interval '1 day')
     ORDER BY player_id ASC, captured_at ASC`,
    [ACTIVITY_WINDOW_DAYS],
  )
  const events = []
  let prev = null
  for (const row of snaps.rows) {
    const p = byId.get(row.player_id)
    if (!p) continue
    if (prev && prev.player_id === row.player_id && row.captured_at - prev.captured_at <= 36 * 3_600_000) {
      const at = row.captured_at
      for (const [skill, s] of Object.entries(row.skills || {})) {
        const before = prev.skills?.[skill]?.level
        if (before != null && s.level > before) {
          events.push({ id: `lvl:${row.player_id}:${skill}:${s.level}`, kind: s.level >= 99 ? 'max' : 'levelup', playerId: p.id, skill, from: before, to: s.level, at, ...(s.level >= 99 ? { cheer: { type: 'skill_level', value: 99 } } : {}) })
        }
      }
      const gained = Number(row.overall_xp) - Number(prev.overall_xp)
      if (gained >= 250_000) events.push({ id: `gain:${row.player_id}:${at.getTime()}`, kind: 'gain', playerId: p.id, xp: gained, at })
    }
    prev = row
  }

  const ms = await pool.query(
    `SELECT player_id, milestone_type, skill, value, occurred_at
     FROM player_milestones
     WHERE occurred_at >= now() - ($1::int * interval '1 day') AND milestone_type IN ('skill_xp','total_level','total_xp')`,
    [ACTIVITY_WINDOW_DAYS],
  )
  const titles = new Map(achievementDefinitions().map((d) => [`${d.type}|${d.skill}|${d.value}`, d.title]))
  for (const r of ms.rows) {
    if (!byId.has(r.player_id)) continue
    events.push({
      id: `ms:${r.player_id}:${r.milestone_type}:${r.skill}:${r.value}`,
      kind: 'milestone',
      playerId: r.player_id,
      skill: r.skill || null,
      title: titles.get(`${r.milestone_type}|${r.skill}|${Number(r.value)}`) || 'Milestone',
      at: r.occurred_at,
      ...(r.milestone_type === 'skill_xp' && Number(r.value) === 200_000_000 ? { cheer: { type: 'skill_xp', value: 200_000_000 } } : {}),
    })
  }

  const feed = events
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 60)
    .map((e) => {
      const p = byId.get(e.playerId)
      return { ...e, username: p.username, displayName: p.displayName, badge: p.badge, claimed: p.claimed }
    })

  // Congratulation counts for the 99s and 200M milestones in the feed (visitors can congratulate right from it).
  const cheerable = feed.filter((e) => e.cheer)
  if (cheerable.length) {
    const counts = await pool.query(
      `SELECT player_id, milestone_type, skill, value, COUNT(*)::int AS n FROM milestone_cheers
       WHERE player_id = ANY($1) GROUP BY player_id, milestone_type, skill, value`,
      [[...new Set(cheerable.map((e) => e.playerId))]],
    )
    const byKey = new Map(counts.rows.map((r) => [`${r.player_id}|${r.milestone_type}|${r.skill}|${Number(r.value)}`, r.n]))
    for (const e of cheerable) e.cheer.count = byKey.get(`${e.playerId}|${e.cheer.type}|${e.skill || ''}|${e.cheer.value}`) || 0
  }
  return feed
}

// Cached: live pieces for 45s (the page polls every minute), the heavier
// insights (history comparisons, spotlight) for 10 minutes. Both are dropped
// when a scheduled sync finishes, so fresh data shows up without a page-load
// recompute.
const LIVE_TTL = 45_000
const INSIGHTS_TTL = 10 * 60_000
let liveCache = { value: null, at: 0, promise: null }
let insightsCache = { value: null, at: 0, promise: null }

export function invalidateDiscoverCache() {
  liveCache.at = 0
  insightsCache.at = 0
}

async function cached(cache, ttl, build) {
  if (cache.value && Date.now() - cache.at < ttl) return cache.value
  if (cache.promise) return cache.value && cache.at ? cache.value : cache.promise
  cache.promise = build()
    .then((v) => {
      cache.value = v
      cache.at = Date.now()
      return v
    })
    .finally(() => {
      cache.promise = null
    })
  // Serve the stale copy immediately while it refreshes in the background.
  return cache.value || cache.promise
}

export function getDiscover() {
  return cached(liveCache, LIVE_TTL, buildDiscover)
}

/** Public discovery data: interactive leaderboards + a live activity feed + curated lists + insights. */
async function buildDiscover() {
  const all = await listPlayers({ skillGains: true })
  const players = all.filter((p) => p.latest)
  const byId = new Map(players.map((p) => [p.id, p]))

  const recentlyTracked = [...players].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8).map((p) => ({ ...card(p), trackedAt: p.createdAt }))

  const gainsBy = (period) =>
    players
      .filter((p) => p.gains?.[period]?.xp > 0)
      .sort((a, b) => b.gains[period].xp - a.gains[period].xp)
      .slice(0, 8)
      .map((p) => card(p, gainText(p.gains[period])))

  const approachingMax = players
    .filter((p) => p.latest.overallLevel < MAX_TOTAL_LEVEL)
    .sort((a, b) => b.latest.overallLevel - a.latest.overallLevel)
    .slice(0, 8)
    .map((p) => {
      const left = Object.values(p.latest.skills).filter((s) => s.level < 99).length
      return card(p, { kind: 'progress', text: `${left} skill${left === 1 ? '' : 's'} from 99` })
    })

  const recent99Rows = await pool.query(
    `SELECT DISTINCT ON (player_id) player_id, skill, occurred_at
     FROM player_milestones
     WHERE milestone_type = 'skill_level' AND value = 99 AND occurred_at IS NOT NULL
     ORDER BY player_id, occurred_at DESC`,
  )
  const recent99 = recent99Rows.rows
    .filter((r) => byId.has(r.player_id))
    .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
    .slice(0, 8)
    .map((r) => card(byId.get(r.player_id), { kind: 'milestone', skill: r.skill, text: `99 ${r.skill}`, at: r.occurred_at }))

  const activity = await getActivity(byId)
  const insights = await cached(insightsCache, INSIGHTS_TTL, () => buildInsights({ players, activity, byId }))

  return {
    generatedAt: new Date().toISOString(),
    players: players.map(compact),
    activity,
    recentlyTracked,
    recent99,
    topWeek: gainsBy('week'),
    topMonth: gainsBy('month'),
    approachingMax,
    insights,
  }
}

/** Case-insensitive partial RSN match among tracked players, with enough detail to show a useful suggestion row. */
export async function searchPlayers(rawQuery) {
  const q = String(rawQuery || '').trim().slice(0, 12)
  if (q.length < 2) return []
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`)
  const { rows } = await pool.query(
    `SELECT p.id, p.username, p.display_name, p.badge
     FROM players p
     WHERE p.username ILIKE $1 ESCAPE '\\'
     ORDER BY (lower(p.username) = lower($2)) DESC, (p.username ILIKE $3 ESCAPE '\\') DESC, p.username ASC
     LIMIT 8`,
    [`%${escaped}%`, q, `${escaped}%`],
  )
  if (!rows.length) return []
  // Level, XP, rank and this week's gain come from the same query the rest of the site uses, so a suggestion can
  // never disagree with the player's own page.
  const detail = new Map((await listPlayers({ ids: rows.map((r) => r.id) })).map((p) => [p.id, p]))
  return rows.map((r) => {
    const d = detail.get(r.id)
    const latest = d?.latest
    // The skill icon for the avatar: highest level, ties broken by XP (same rule as the profile page).
    const top = Object.entries(latest?.skills || {}).sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp)[0]
    return {
      username: r.username,
      displayName: r.display_name,
      badge: r.badge,
      claimed: Boolean(d?.claimed),
      overallLevel: latest?.overallLevel ?? null,
      overallXp: latest?.overallXp ?? null,
      overallRank: latest?.overallRank > 0 ? latest.overallRank : null,
      topSkill: top ? top[0] : null,
      weekGain: d?.gains?.week?.xp > 0 ? d.gains.week.xp : 0,
    }
  })
}
