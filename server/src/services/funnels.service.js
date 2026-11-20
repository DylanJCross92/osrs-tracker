import { pool } from '../db.js'
import { DAY_MS, FUNNELS, SEGMENTS, buildAnalysis, withFirst } from '../utils/funnels.js'

const MAX_EVENTS = 400_000
// The events the funnels and the flow read; everything else is left in the database.
const NAMES = [
  ...new Set([
    'spa_page_view', 'login', 'session_resumed',
    'player_search', 'player_added', 'profile_view', 'search_suggestion_selected', 'profile_tab', 'profile_gain_period', 'profile_table_toggle',
    'profile_check_history', 'profile_customize', 'profile_refresh', 'profile_skill_planner',
    'planner_goal_added', 'planner_template_used', 'planner_recommended_used', 'planner_route_picked', 'quick_planner_goal', 'planner_plan_saved',
    'plan_share', 'plan_shared', 'plan_share_updated', 'planner_share_link_opened', 'shared_plan_viewed',
    'clan_invite_open', 'clan_join_request', 'clan_create', 'clan_member_add', 'competition_create',
  ]),
]
const iso = (d) => (d ? new Date(d).getTime() : null)

/**
 * The conversion funnels, the user flow and the insights (see utils/funnels.js) for the people first seen in the last `days` days
 * (null: everyone ever recorded), in one group of people. One person is an account when the browser's id (or the event) belongs to
 * one, otherwise a browser id; admins and owners are never counted, and accounts are included even when no event was recorded.
 */
export async function funnelsOverview({ days = null, segment = 'all' } = {}) {
  const [{ rows: events }, { rows: users }] = await Promise.all([
    pool.query(
      `SELECT COALESCE(e.account_id, l.account_id) AS aid, e.visitor_id AS vid, e.name, e.at, e.props->>'page_path' AS path
       FROM events e LEFT JOIN visitor_links l ON l.visitor_id = e.visitor_id
       WHERE (e.visitor_id IS NOT NULL OR e.account_id IS NOT NULL) AND e.name = ANY($1::text[])
       ORDER BY e.at, e.id LIMIT ${MAX_EVENTS}`,
      [NAMES],
    ),
    pool.query(
      `SELECT u.id, u.email, u.created_at, u.email_verified_at, coalesce(u.last_seen_at, u.last_login_at) AS last_seen,
              ('admin' = ANY(u.roles) OR 'owner' = ANY(u.roles)) AS is_admin,
              (SELECT min(coalesce(c.decided_at, c.created_at)) FROM profile_claims c WHERE c.user_id = u.id AND c.status = 'verified') AS claimed_at
       FROM users u`,
    ),
  ])
  const accounts = new Map(users.map((u) => [u.id, u]))
  const byKey = new Map()
  const person = (key, kind, label) => {
    if (!byKey.has(key)) byKey.set(key, { key, kind, label, events: [], signedUpAt: null, confirmedAt: null, claimedAt: null, lastSeenAt: null })
    return byKey.get(key)
  }
  for (const e of events) {
    if (e.aid && accounts.get(e.aid)?.is_admin) continue
    const p = e.aid ? person(`a:${e.aid}`, 'account', accounts.get(e.aid)?.email || `Account ${e.aid}`) : person(`v:${e.vid}`, 'visitor', `Visitor ${String(e.vid).slice(0, 6)}`)
    p.events.push({ name: e.name, at: new Date(e.at).getTime(), path: e.path })
  }
  for (const u of users) {
    if (u.is_admin) continue
    const p = byKey.get(`a:${u.id}`) || person(`a:${u.id}`, 'account', u.email)
    p.signedUpAt = iso(u.created_at)
    p.confirmedAt = iso(u.email_verified_at)
    p.claimedAt = iso(u.claimed_at)
    p.lastSeenAt = iso(u.last_seen)
  }
  const since = days ? Date.now() - days * DAY_MS : null
  const cohort = withFirst([...byKey.values()]).filter((p) => since == null || p.first >= since)
  return { days, capped: events.length >= MAX_EVENTS, ...buildAnalysis(cohort, SEGMENTS.some((s) => s.key === segment) ? segment : 'all'), funnelKeys: FUNNELS.map((f) => f.key) }
}
