import { pool } from '../db.js'
import { fillHourly, shapeAreas, shapeWindows } from '../utils/activePeople.js'

// Every sign of someone being around in the last week: a product event (an account, or a browser that is not signed in) or an account
// making a request while signed in (users.last_seen_at, which events do not always carry). A browser that signed in is counted as its
// account through visitor_links. Admins and owners are never counted.
const PERSON = `COALESCE('a:' || e.account_id, 'a:' || vl.account_id, 'v:' || e.visitor_id)`
const SEEN = `
  SELECT e.at, ${PERSON} AS pk, e.name, 'e' AS src
  FROM events e LEFT JOIN visitor_links vl ON vl.visitor_id = e.visitor_id
  WHERE e.at >= now() - interval '7 days'
  UNION ALL
  SELECT u.last_seen_at, 'a:' || u.id, NULL, 'u'
  FROM users u
  WHERE u.last_seen_at >= now() - interval '7 days' AND NOT (u.roles && ARRAY['admin', 'owner'])`

const SPANS = { hour: "interval '1 hour'", day: "interval '24 hours'", week: "interval '7 days'" }

function windowColumns() {
  return Object.entries(SPANS)
    .map(
      ([key, span]) => `
    count(DISTINCT pk) FILTER (WHERE pk IS NOT NULL AND at >= now() - ${span})::int AS ${key}_people,
    count(DISTINCT pk) FILTER (WHERE pk LIKE 'a:%' AND at >= now() - ${span})::int AS ${key}_signed,
    count(*) FILTER (WHERE src = 'e' AND at >= now() - ${span})::int AS ${key}_events,
    count(*) FILTER (WHERE src = 'e' AND pk IS NULL AND at >= now() - ${span})::int AS ${key}_untracked,
    count(*) FILTER (WHERE name = 'login' AND at >= now() - ${span})::int AS ${key}_logins`,
    )
    .join(',')
}

/**
 * Different people active in the last hour, 24 hours and 7 days, who they were (signed in or not), the last 24 hours hour by hour, and the
 * busiest parts of the site in the last 24 hours. For the owner's statistics page.
 */
export async function activePeople() {
  const [counts, accounts, hourly, areas] = await Promise.all([
    pool.query(`WITH seen AS (${SEEN}) SELECT count(DISTINCT pk) FILTER (WHERE pk IS NOT NULL AND at >= now() - interval '5 minutes')::int AS online, ${windowColumns()} FROM seen`),
    pool.query(
      `SELECT count(*) FILTER (WHERE created_at >= now() - interval '1 hour')::int AS hour_new_accounts,
              count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS day_new_accounts,
              count(*)::int AS week_new_accounts
       FROM users WHERE email_verified_at IS NOT NULL AND created_at >= now() - interval '7 days'`,
    ),
    pool.query(
      `SELECT date_trunc('hour', e.at) AS hour, count(DISTINCT ${PERSON})::int AS people
       FROM events e LEFT JOIN visitor_links vl ON vl.visitor_id = e.visitor_id
       WHERE e.at >= date_trunc('hour', now()) - interval '23 hours' AND ${PERSON} IS NOT NULL
       GROUP BY 1`,
    ),
    pool.query(
      `SELECT e.props->>'route_name' AS route, count(DISTINCT ${PERSON})::int AS people, count(*)::int AS views
       FROM events e LEFT JOIN visitor_links vl ON vl.visitor_id = e.visitor_id
       WHERE e.name = 'spa_page_view' AND e.at >= now() - interval '24 hours' AND e.props->>'route_name' <> ''
       GROUP BY 1`,
    ),
  ])
  const shaped = shapeWindows({ ...counts.rows[0], ...accounts.rows[0] })
  return { generatedAt: new Date().toISOString(), ...shaped, hourly: fillHourly(hourly.rows), areas: shapeAreas(areas.rows) }
}
