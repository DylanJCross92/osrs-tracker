import { pool } from '../db.js'
import { achievementDefinitions, MAX_TOTAL_LEVEL } from './milestones.service.js'
import { SKILL_NAMES } from './osrsHiscores.service.js'
import { localDay, addDays, diffDays } from '../utils/dates.js'

// Everything here is derived from data TickGains already stores (latest
// snapshots, snapshot history, the milestones table) and is cached by
// discover.service.js — nothing is recomputed per page view.

const HOUR = 3_600_000
const DAY = 24 * HOUR

// Total xp needed for a level (same formula as the client's osrsSkills.js).
function xpForLevel(level) {
  let points = 0
  let xp = 0
  for (let l = 1; l < level; l++) {
    points += Math.floor(l + 300 * 2 ** (l / 7))
    xp = Math.floor(points / 4)
  }
  return xp
}
const XP90 = xpForLevel(90)
const XP99 = xpForLevel(99)

const fmtXp = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${parseFloat((n / 1e6).toFixed(n >= 1e7 ? 1 : 2))}M` : n >= 1e3 ? `${parseFloat((n / 1e3).toFixed(1))}K` : String(n))

/** The player summary every featured card shares. */
function who(p) {
  return { id: p.id, username: p.username, displayName: p.displayName, badge: p.badge }
}

// ---------------------------------------------------------------------------
// 3.1 Players near milestones
// ---------------------------------------------------------------------------
const SKILL_XP_TARGETS = [10_000_000, 50_000_000, 100_000_000, 200_000_000]
const TOTAL_LEVEL_TARGETS = [1000, 1500, 2000, 2200, MAX_TOTAL_LEVEL]
const MIN_PROGRESS = 0.7 // only players genuinely close

/** Each player's single closest upcoming milestone (so the list has variety), best first. */
export function nearMilestones(players) {
  const best = []
  for (const p of players) {
    const candidates = []
    for (const [skill, s] of Object.entries(p.latest.skills || {})) {
      const targets = [
        { label: 'Level 90', xp: XP90, kind: 'level', target: 90, need: s.level < 90 },
        { label: 'Level 99', xp: XP99, kind: 'level', target: 99, need: s.level < 99 },
        ...SKILL_XP_TARGETS.map((x) => ({ label: `${fmtXp(x)} XP`, xp: x, kind: 'xp', target: x, need: s.xp < x })),
      ]
      for (const t of targets) {
        if (!t.need) continue
        const progress = s.xp / t.xp
        if (progress < MIN_PROGRESS) continue
        candidates.push({ skill, label: t.label, kind: t.kind, target: t.target, progress, remainingXp: t.xp - s.xp, currentLevel: s.level })
      }
    }
    const nextTotal = TOTAL_LEVEL_TARGETS.find((t) => t > p.latest.overallLevel)
    if (nextTotal && p.latest.overallLevel / nextTotal >= MIN_PROGRESS) {
      candidates.push({ skill: null, label: `${nextTotal.toLocaleString()} Overall`, kind: 'total', target: nextTotal, progress: p.latest.overallLevel / nextTotal, remainingLevels: nextTotal - p.latest.overallLevel, currentLevel: p.latest.overallLevel })
    }
    if (!candidates.length) continue
    // Closest to completing = highest progress; tie → fewer XP/levels left.
    candidates.sort((a, b) => b.progress - a.progress)
    const c = candidates[0]
    best.push({ ...who(p), skill: c.skill, milestone: c.label, progress: Math.min(Math.round(c.progress * 1000) / 10, 99.9), remainingXp: c.remainingXp ?? null, remainingLevels: c.remainingLevels ?? null, currentLevel: c.currentLevel })
  }
  return best.sort((a, b) => b.progress - a.progress).slice(0, 15)
}

// ---------------------------------------------------------------------------
// 3.3 Recent achievements (from the milestones table)
// ---------------------------------------------------------------------------
const NOTABLE = (m) =>
  (m.milestone_type === 'skill_level' && Number(m.value) === 99) ||
  (m.milestone_type === 'skill_xp' && Number(m.value) >= 100_000_000) ||
  (m.milestone_type === 'total_level' && Number(m.value) >= 1500) ||
  (m.milestone_type === 'total_xp' && Number(m.value) >= 100_000_000)

export async function recentAchievements(byId) {
  const { rows } = await pool.query(
    `SELECT m.player_id, m.milestone_type, m.skill, m.value, m.occurred_at,
            (SELECT MAX(s.captured_at) FROM snapshots s WHERE s.player_id = m.player_id AND s.captured_at < m.occurred_at) AS occurred_after
     FROM player_milestones m
     WHERE m.occurred_at IS NOT NULL
     ORDER BY m.occurred_at DESC
     LIMIT 200`,
  )
  const titles = new Map(achievementDefinitions().map((d) => [`${d.type}|${d.skill}|${d.value}`, d]))
  const out = []
  for (const m of rows) {
    if (!byId.has(m.player_id) || !NOTABLE(m)) continue
    const def = titles.get(`${m.milestone_type}|${m.skill}|${Number(m.value)}`)
    if (!def) continue
    const p = byId.get(m.player_id)
    const gap = m.occurred_after ? new Date(m.occurred_at) - new Date(m.occurred_after) > 48 * HOUR : false
    out.push({
      ...who(p),
      key: `${m.player_id}:${m.milestone_type}:${m.skill}:${m.value}`,
      skill: m.skill || null,
      type: m.milestone_type,
      value: Number(m.value),
      title: def.title,
      description: def.description,
      detectedAt: m.occurred_at,
      // A wide gap before the detecting snapshot = the real moment is only known to be inside it.
      after: gap ? m.occurred_after : null,
    })
    if (out.length >= 30) break
  }
  return out
}

// ---------------------------------------------------------------------------
// XP at fixed points in the past (for trending / most improved)
// ---------------------------------------------------------------------------
async function xpAt(timeMs, toleranceMs) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (player_id) player_id, captured_at, overall_xp
     FROM snapshots WHERE captured_at <= $1 ORDER BY player_id, captured_at DESC`,
    [new Date(timeMs)],
  )
  const out = new Map()
  for (const r of rows) {
    // A snapshot far older than the boundary can't speak for it — leave it out.
    if (timeMs - new Date(r.captured_at).getTime() <= toleranceMs) out.set(r.player_id, Number(r.overall_xp))
  }
  return out
}

async function loadHistory(now) {
  const [x0, x24, x7, x14, x21, x28, x35] = await Promise.all([
    xpAt(now, 12 * HOUR),
    xpAt(now - DAY, 2 * DAY),
    xpAt(now - 7 * DAY, 2 * DAY),
    xpAt(now - 14 * DAY, 2 * DAY),
    xpAt(now - 21 * DAY, 2 * DAY),
    xpAt(now - 28 * DAY, 2 * DAY),
    xpAt(now - 35 * DAY, 2 * DAY),
  ])
  return { x0, x24, x7, x14, x21, x28, x35 }
}

// ---------------------------------------------------------------------------
// 3.6 Most improved: last 7 days vs the previous four-week weekly average
// ---------------------------------------------------------------------------
const MIN_CURRENT_WEEK = 250_000 // meaningful gain
const MIN_PREVIOUS_AVG = 25_000 // avoids huge % off a tiny baseline
const MIN_IMPROVEMENT = 0.25

export function mostImproved(players, h) {
  const out = []
  let withHistory = 0
  for (const p of players) {
    const a = h.x0.get(p.id)
    const b = h.x7.get(p.id)
    const c = h.x35.get(p.id)
    // Needs real history across all five weeks — no guessing from sparse data.
    if (a == null || b == null || c == null || [h.x14, h.x21, h.x28].some((m) => !m.has(p.id))) continue
    withHistory++
    const current = a - b
    const prevAvg = (b - c) / 4
    if (current < MIN_CURRENT_WEEK || prevAvg < MIN_PREVIOUS_AVG) continue
    const pct = (current - prevAvg) / prevAvg
    if (pct < MIN_IMPROVEMENT) continue
    out.push({ ...who(p), currentWeek: current, previousAvg: Math.round(prevAvg), pct: Math.round(pct * 100) })
  }
  out.sort((x, y) => y.pct - x.pct)
  return { list: out.slice(0, 10), withHistory, total: players.length }
}

// ---------------------------------------------------------------------------
// 3.5 Trending: recent XP, fresh milestones, and pace vs. their own norm
// ---------------------------------------------------------------------------
export async function trending(players, h) {
  const ms = await pool.query(
    `SELECT m.player_id, COUNT(*)::int AS n
     FROM player_milestones m
     WHERE m.occurred_at >= now() - interval '7 days'
       -- only milestones seen within ~2 days of the snapshot before them — one reached across
       -- a long data gap (e.g. before daily tracking) isn't "this week" activity
       AND (SELECT m.occurred_at - MAX(s.captured_at) FROM snapshots s WHERE s.player_id = m.player_id AND s.captured_at < m.occurred_at) <= interval '48 hours'
     GROUP BY m.player_id`,
  )
  const milestones = new Map(ms.rows.map((r) => [r.player_id, r.n]))
  const out = []
  for (const p of players) {
    const a = h.x0.get(p.id)
    const d24 = a != null && h.x24.has(p.id) ? a - h.x24.get(p.id) : null
    const d7 = a != null && h.x7.has(p.id) ? a - h.x7.get(p.id) : p.gains?.week?.xp ?? null
    const prev = h.x7.has(p.id) && h.x35.has(p.id) ? (h.x7.get(p.id) - h.x35.get(p.id)) / 4 : null
    const ratio = d7 != null && prev && prev >= MIN_PREVIOUS_AVG ? d7 / prev : null
    const m = milestones.get(p.id) || 0
    if (!(d7 > 0) && !m) continue

    const reasons = []
    let score = 0
    if (d24 > 0) {
      score += Math.log10(1 + d24)
      reasons.push({ weight: Math.log10(1 + d24), text: `+${fmtXp(d24)} XP in the last 24 hours` })
    }
    if (d7 > 0) score += Math.log10(1 + d7) * 0.6
    if (m > 0) {
      score += m * 1.5
      reasons.push({ weight: m * 1.5, text: `${m} new milestone${m === 1 ? '' : 's'} this week` })
    }
    if (ratio && ratio >= 1.5) {
      score += Math.min(ratio, 5)
      reasons.push({ weight: Math.min(ratio, 5), text: `gaining ${ratio.toFixed(1)}× their usual weekly pace` })
    }
    if (!reasons.length && d7 > 0) reasons.push({ weight: 0, text: `+${fmtXp(d7)} XP this week` })
    reasons.sort((x, y) => y.weight - x.weight)
    out.push({ ...who(p), score, d24, d7, reason: reasons.slice(0, 2).map((r) => r.text).join(' · ') })
  }
  return out.sort((x, y) => y.score - x.score).slice(0, 10)
}

// ---------------------------------------------------------------------------
// 3.2 Player spotlight — one per week, stored so it never changes mid-week
// ---------------------------------------------------------------------------
function weekKey(now) {
  // Monday of the current week in the app's timezone.
  const today = localDay(now)
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay() // 0 = Sun
  return addDays(today, -((dow + 6) % 7))
}

const CATEGORIES = ['xp', 'levels', 'achievement', 'improved']

function achievementWeight(a) {
  if (a.type === 'skill_xp' && a.value >= 200_000_000) return 100
  if (a.type === 'skill_xp') return 80
  if (a.type === 'skill_level') return 70
  if (a.type === 'total_level') return 60
  return 50
}

export async function pickSpotlight(players, { activity, achievements, improved, now = Date.now() }) {
  const key = weekKey(now)
  const existing = await pool.query('SELECT payload FROM discover_spotlights WHERE period_key = $1', [key])
  if (existing.rowCount) return existing.rows[0].payload

  const recentlyUsed = await pool.query('SELECT player_id FROM discover_spotlights ORDER BY period_key DESC LIMIT 2')
  const avoid = new Set(recentlyUsed.rows.map((r) => r.player_id))
  const pool_ = players.filter((p) => !avoid.has(p.id))
  const eligible = pool_.length ? pool_ : players // tiny populations: repeat rather than show nothing

  const levelsBy = new Map()
  for (const e of activity) if (e.kind === 'levelup' || e.kind === 'max') levelsBy.set(e.playerId, (levelsBy.get(e.playerId) || 0) + (e.to - e.from))

  const candidates = {
    xp: eligible.filter((p) => p.gains?.week?.xp > 0).sort((a, b) => b.gains.week.xp - a.gains.week.xp)[0],
    levels: eligible.filter((p) => levelsBy.get(p.id) > 0).sort((a, b) => levelsBy.get(b.id) - levelsBy.get(a.id))[0],
    achievement: [...achievements].filter((a) => eligible.some((p) => p.id === a.id)).sort((a, b) => achievementWeight(b) - achievementWeight(a) || new Date(b.detectedAt) - new Date(a.detectedAt))[0],
    improved: improved.list.find((i) => eligible.some((p) => p.id === i.id)),
  }
  const available = CATEGORIES.filter((c) => candidates[c])
  if (!available.length) return null

  // Rotate by week number so consecutive weeks showcase different kinds of success.
  const weekIndex = Math.floor(diffDays('2024-01-01', key) / 7)
  const category = available[weekIndex % available.length]
  const byId = new Map(players.map((p) => [p.id, p]))

  let player
  let headline
  let reason
  let stats
  if (category === 'xp') {
    player = candidates.xp
    const g = player.gains.week
    headline = `+${g.xp.toLocaleString()} XP this week`
    reason = 'Highest weekly XP gain'
    stats = [{ label: 'Top skill', value: g.topSkill ? `${g.topSkill} (+${fmtXp(g.topSkillXp)})` : '—' }, { label: 'Overall', value: player.latest.overallLevel.toLocaleString() }]
  } else if (category === 'levels') {
    player = candidates.levels
    const n = levelsBy.get(player.id)
    headline = `${n} skill level${n === 1 ? '' : 's'} gained this week`
    reason = 'Most skill levels gained'
    stats = [{ label: 'Weekly XP', value: `+${fmtXp(player.gains?.week?.xp || 0)}` }, { label: 'Overall', value: player.latest.overallLevel.toLocaleString() }]
  } else if (category === 'achievement') {
    const a = candidates.achievement
    player = byId.get(a.id)
    headline = a.title
    reason = 'Most notable recent achievement'
    stats = [{ label: 'Detected', value: new Date(a.detectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }, { label: 'Overall', value: player.latest.overallLevel.toLocaleString() }]
  } else {
    const i = candidates.improved
    player = byId.get(i.id)
    headline = `${i.pct}% more XP than their usual week`
    reason = 'Biggest improvement over previous activity'
    stats = [{ label: 'This week', value: `+${fmtXp(i.currentWeek)}` }, { label: 'Usual week', value: `+${fmtXp(i.previousAvg)}` }]
  }

  const payload = {
    periodKey: key,
    periodStart: key,
    periodEnd: addDays(key, 6),
    category,
    ...who(player),
    skill: category === 'xp' ? player.gains.week.topSkill : category === 'achievement' ? candidates.achievement.skill : null,
    headline,
    reason,
    stats,
  }
  await pool.query('INSERT INTO discover_spotlights (period_key, player_id, category, payload) VALUES ($1, $2, $3, $4) ON CONFLICT (period_key) DO NOTHING', [key, player.id, category, JSON.stringify(payload)])
  return payload
}

/** Builds every extra Discover section from one set of inputs. */
export async function buildInsights({ players, activity, byId }) {
  const now = Date.now()
  const history = await loadHistory(now)
  const [achievements, trendingList] = await Promise.all([recentAchievements(byId), trending(players, history)])
  const improvedResult = mostImproved(players, history)
  const improved = improvedResult
  const spotlight = await pickSpotlight(players, { activity, achievements, improved, now })
  return {
    nearMilestones: nearMilestones(players),
    achievements,
    trending: trendingList.slice(0, 5),
    improved: improvedResult.list.slice(0, 5),
    improvedMeta: { withHistory: improvedResult.withHistory, total: improvedResult.total, minWeek: MIN_CURRENT_WEEK, minUsual: MIN_PREVIOUS_AVG, minPct: Math.round(MIN_IMPROVEMENT * 100) },
    spotlight,
    skills: SKILL_NAMES,
    computedAt: new Date(now).toISOString(),
  }
}
