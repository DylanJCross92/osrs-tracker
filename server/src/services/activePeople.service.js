import { pool } from '../db.js'
import { fillHourly, shapeAreas, shapeWindows } from '../utils/activePeople.js'

// Kept light on purpose: the database is small, and this runs every minute while the statistics page is open. So nothing here sorts a
// week of events once per number. Events are first reduced to one row per browser or account (their latest moment), and only those few
// rows are counted; the hour and area charts group by person first and count the groups. Admins and owners are never counted from
// requests (users.last_seen_at); their product events are not sent by the site (see isInternalTraffic).
//
// A person is an account, or a browser that is not signed in. A browser that signed in counts as its account through visitor_links.
const PERSON = `COALESCE('a:' || e.account_id, 'a:' || vl.account_id, 'v:' || e.visitor_id)`

const SPANS = { hour: "interval '1 hour'", day: "interval '24 hours'", week: "interval '7 days'" }

// People: each person's latest sign of life in the last week (a product event, or a signed-in request), then counted per window.
const PEOPLE_SQL = `
  WITH ev AS (
    SELECT account_id, visitor_id, max(at) AS at
    FROM events
    WHERE at >= now() - interval '7 days' AND (account_id IS NOT NULL OR visitor_id IS NOT NULL)
    GROUP BY account_id, visitor_id
  ), seen AS (
    SELECT ev.at, COALESCE('a:' || ev.account_id, 'a:' || vl.account_id, 'v:' || ev.visitor_id) AS pk
    FROM ev LEFT JOIN visitor_links vl ON vl.visitor_id = ev.visitor_id
    UNION ALL
    SELECT u.last_seen_at, 'a:' || u.id
    FROM users u
    WHERE u.last_seen_at >= now() - interval '7 days' AND NOT (u.roles && ARRAY['admin', 'owner'])
  ), person AS (
    SELECT pk, max(at) AS last_at FROM seen GROUP BY pk
  )
  SELECT count(*) FILTER (WHERE last_at >= now() - interval '5 minutes')::int AS online,
    ${Object.entries(SPANS)
      .map(([key, span]) => `count(*) FILTER (WHERE last_at >= now() - ${span})::int AS ${key}_people,
    count(*) FILTER (WHERE pk LIKE 'a:%' AND last_at >= now() - ${span})::int AS ${key}_signed`)
      .join(',\n    ')}
  FROM person`

// Actions: plain counts over the week's events, no person needed. An action with neither an account nor a browser id came from a
// browser that asked not to be tracked.
const ACTIONS_SQL = `
  SELECT ${Object.entries(SPANS)
    .map(([key, span]) => `count(*) FILTER (WHERE at >= now() - ${span})::int AS ${key}_events,
    count(*) FILTER (WHERE account_id IS NULL AND visitor_id IS NULL AND at >= now() - ${span})::int AS ${key}_untracked,
    count(*) FILTER (WHERE name = 'login' AND at >= now() - ${span})::int AS ${key}_logins`)
    .join(',\n    ')}
  FROM events WHERE at >= now() - interval '7 days'`

const ACCOUNTS_SQL = `
  SELECT count(*) FILTER (WHERE created_at >= now() - interval '1 hour')::int AS hour_new_accounts,
         count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS day_new_accounts,
         count(*)::int AS week_new_accounts
  FROM users WHERE email_verified_at IS NOT NULL AND created_at >= now() - interval '7 days'`

// The last 24 hours hour by hour: one row per person and hour first, then counted.
const HOURLY_SQL = `
  SELECT hour, count(*)::int AS people, count(*) FILTER (WHERE pk LIKE 'a:%')::int AS signed_in, sum(actions)::int AS actions
  FROM (
    SELECT date_trunc('hour', e.at) AS hour, ${PERSON} AS pk, count(*) AS actions
    FROM events e LEFT JOIN visitor_links vl ON vl.visitor_id = e.visitor_id
    WHERE e.at >= date_trunc('hour', now()) - interval '23 hours' AND (e.account_id IS NOT NULL OR e.visitor_id IS NOT NULL)
    GROUP BY 1, 2
  ) per_person
  GROUP BY hour`

// The busiest parts of the site (last 24 hours). The route name is not stored (the event rules drop detail keys ending in _name), so
// the area is the first part of the page address ('/player/Zezima?x' -> 'player', '/' -> 'home'). Only that part is read.
const AREAS_SQL = `
  SELECT area, count(*)::int AS people, sum(views)::int AS views
  FROM (
    SELECT COALESCE(NULLIF(lower(left(split_part(split_part(split_part(e.props->>'page_path', '?', 1), '#', 1), '/', 2), 40)), ''), 'home') AS area,
           ${PERSON} AS pk, count(*) AS views
    FROM events e LEFT JOIN visitor_links vl ON vl.visitor_id = e.visitor_id
    WHERE e.name = 'spa_page_view' AND e.at >= now() - interval '24 hours' AND e.props->>'page_path' IS NOT NULL
      AND (e.account_id IS NOT NULL OR e.visitor_id IS NOT NULL)
    GROUP BY 1, 2
  ) per_person
  GROUP BY area`

// The answer is kept for 55 seconds, so several open tabs or quick refreshes cost one run, and a failed run is not kept.
const CACHE_MS = 55_000
let cached = null
let running = null

async function compute() {
  // One after another, not all at once: this database has little memory, and parallel runs each want their own working space.
  const people = (await pool.query(PEOPLE_SQL)).rows[0]
  const actions = (await pool.query(ACTIONS_SQL)).rows[0]
  const accounts = (await pool.query(ACCOUNTS_SQL)).rows[0]
  const hourly = (await pool.query(HOURLY_SQL)).rows
  const areas = (await pool.query(AREAS_SQL)).rows
  const shaped = shapeWindows({ ...people, ...actions, ...accounts })
  return { generatedAt: new Date().toISOString(), ...shaped, hourly: fillHourly(hourly), areas: shapeAreas(areas) }
}

/**
 * Different people active in the last hour, 24 hours and 7 days, who they were (signed in or not), the last 24 hours hour by hour, and the
 * busiest parts of the site in the last 24 hours. For the owner's statistics page.
 */
export async function activePeople() {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data
  // Calls that arrive while it is being worked out share that one run.
  running ??= compute()
    .then((data) => {
      cached = { at: Date.now(), data }
      return data
    })
    .finally(() => {
      running = null
    })
  return running
}

/** Forgets the kept answer (tests). */
export function resetActivePeopleCache() {
  cached = null
  running = null
}
