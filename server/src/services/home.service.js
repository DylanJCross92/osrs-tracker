import { pool } from '../db.js'
import { getDiscover } from './discover.service.js'

// Homepage data: community stats + a real example profile. Built entirely from
// the already-cached Discover payload (no extra player queries) plus one small
// snapshot query for the example's chart, and cached itself so visiting the
// homepage never triggers hiscores / Wise Old Man calls or heavy SQL.
const TTL = 60_000
let cache = { value: null, at: 0, promise: null }

export function invalidateHomeCache() {
  cache.at = 0
}

const positive = (n) => (Number.isFinite(n) && n > 0 ? n : 0)

// Pick a profile that shows off the product: lots of history first, then most XP.
async function pickExample(players) {
  const { rows } = await pool.query(
    `SELECT player_id, COUNT(*)::int AS n, MIN(captured_at) AS first
     FROM snapshots GROUP BY player_id`,
  )
  const stats = new Map(rows.map((r) => [r.player_id, { n: r.n, spanDays: (Date.now() - new Date(r.first).getTime()) / 86_400_000 }]))
  const ranked = players
    .map((p) => ({ p, s: stats.get(p.id) || { n: 0, spanDays: 0 } }))
    .filter(({ p }) => p.overallXp != null)
    .sort((a, b) => {
      const richA = a.s.n >= 10 && a.s.spanDays >= 14 ? 1 : 0
      const richB = b.s.n >= 10 && b.s.spanDays >= 14 ? 1 : 0
      return richB - richA || b.p.overallXp - a.p.overallXp
    })
  return ranked[0]?.p || null
}

// Total-XP series for the preview chart, thinned to ~60 points.
async function exampleSeries(playerId) {
  for (const days of [30, 90, 3650]) {
    const { rows } = await pool.query(
      `SELECT captured_at, overall_xp FROM snapshots
       WHERE player_id = $1 AND captured_at >= now() - ($2::int * interval '1 day')
       ORDER BY captured_at ASC`,
      [playerId, days],
    )
    if (rows.length >= 3 || days === 3650) {
      const step = Math.max(Math.ceil(rows.length / 60), 1)
      const thinned = rows.filter((_, i) => i % step === 0 || i === rows.length - 1)
      return thinned.map((r) => ({ t: new Date(r.captured_at).getTime(), xp: Number(r.overall_xp) }))
    }
  }
  return []
}

async function build() {
  const discover = await getDiscover()
  const players = discover.players || []

  const xpToday = players.reduce((s, p) => s + positive(p.gains?.day?.xp), 0)
  const xpWeek = players.reduce((s, p) => s + positive(p.gains?.week?.xp), 0)

  // Most-trained skills this week: XP gained across all tracked players.
  const skillTotals = new Map()
  for (const p of players) {
    for (const [skill, xp] of Object.entries(p.skillGains?.week || {})) {
      const cur = skillTotals.get(skill) || { skill, xp: 0, players: 0 }
      cur.xp += xp
      cur.players += 1
      skillTotals.set(skill, cur)
    }
  }
  const topSkills = [...skillTotals.values()].sort((a, b) => b.xp - a.xp).slice(0, 5)

  // Top five gainers: today, falling back to the week when today is empty.
  const period = players.some((p) => p.gains?.day?.xp > 0) ? 'day' : 'week'
  const topGainers = players
    .filter((p) => p.gains?.[period]?.xp > 0)
    .sort((a, b) => b.gains[period].xp - a.gains[period].xp)
    .slice(0, 5)
    .map((p) => ({ username: p.username, displayName: p.displayName, badge: p.badge, xp: p.gains[period].xp, topSkill: p.gains[period].topSkill }))

  const achievements = discover.insights?.achievements || []
  const recentMilestones = achievements.slice(0, 4).map((a) => ({
    key: a.key, username: a.username, displayName: a.displayName, badge: a.badge, skill: a.skill, title: a.title, detectedAt: a.detectedAt,
  }))

  const ex = await pickExample(players)
  let example = null
  if (ex) {
    const series = await exampleSeries(ex.id)
    const mine = achievements.filter((a) => a.id === ex.id)
    const topWeekSkills = Object.entries(ex.skillGains?.week || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([skill, xp]) => ({ skill, xp }))
    example = {
      username: ex.username,
      displayName: ex.displayName,
      badge: ex.badge,
      overallLevel: ex.overallLevel,
      overallXp: ex.overallXp,
      overallRank: ex.overallRank,
      weekXp: positive(ex.gains?.week?.xp),
      dayXp: positive(ex.gains?.day?.xp),
      recentSkills: topWeekSkills,
      highest: ex.highest,
      featured: mine[0] ? { title: mine[0].title, skill: mine[0].skill, detectedAt: mine[0].detectedAt } : null,
      series,
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    community: { totalPlayers: players.length, xpToday, xpWeek, topSkills, topGainers, gainersPeriod: period, recentMilestones },
    example,
  }
}

export function getHome() {
  if (cache.value && Date.now() - cache.at < TTL) return Promise.resolve(cache.value)
  if (cache.promise) return cache.value ? Promise.resolve(cache.value) : cache.promise
  cache.promise = build()
    .then((v) => {
      cache.value = v
      cache.at = Date.now()
      return v
    })
    .finally(() => {
      cache.promise = null
    })
  return cache.value ? Promise.resolve(cache.value) : cache.promise
}
