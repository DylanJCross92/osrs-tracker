import { pool } from '../db.js'
import { RETENTION_DAYS, askedNotToTrack, summarizeBreakdown, summarizeEvents } from '../utils/events.js'
import { fillDailyActive } from '../utils/dailyActive.js'
import { hasRole } from '../utils/roles.js'

const today = () => new Date().toISOString().slice(0, 10)
const WINDOW = `day > (now() AT TIME ZONE 'utc')::date - $1::int`

/** Stores a batch of cleaned events (see utils/events.js). accountId is null for signed-out visitors. */
export async function recordEvents(events, accountId) {
  if (!events.length) return
  await pool.query(
    `INSERT INTO events (name, props, account_id)
     SELECT t.n, t.p::jsonb, $3::int FROM unnest($1::text[], $2::text[]) AS t(n, p)`,
    [events.map((e) => e.name), events.map((e) => JSON.stringify(e.props)), accountId],
  )
}

/** Deletes events older than the retention period. */
export async function purgeOldEvents() {
  const { rowCount } = await pool.query(`DELETE FROM events WHERE day <= (now() AT TIME ZONE 'utc')::date - $1::int`, [RETENTION_DAYS])
  return rowCount
}

/** Every event seen in the last `days` days: total, accounts, today and a count per day. */
export async function eventsOverview(days) {
  const [byDay, totals] = await Promise.all([
    pool.query(`SELECT name, day::text AS day, count(*)::int AS n FROM events WHERE ${WINDOW} GROUP BY name, day`, [days]),
    pool.query(`SELECT name, count(*)::int AS total, count(DISTINCT account_id)::int AS accounts FROM events WHERE ${WINDOW} GROUP BY name`, [days]),
  ])
  return { days, events: summarizeEvents(byDay.rows, totals.rows, days, today()) }
}

/** One event in detail: its days, plus the most common values of each detail it carries. */
export async function eventDetail(name, days) {
  const [byDay, details] = await Promise.all([
    pool.query(`SELECT day::text AS day, count(*)::int AS n FROM events WHERE name = $2 AND ${WINDOW} GROUP BY day`, [days, name]),
    pool.query(
      `SELECT kv.key AS k, kv.value AS v, count(*)::int AS n
       FROM events e, jsonb_each_text(e.props) AS kv
       WHERE e.name = $2 AND e.${WINDOW}
       GROUP BY kv.key, kv.value`,
      [days, name],
    ),
  ])
  const overview = summarizeEvents(byDay.rows.map((r) => ({ ...r, name })), [{ name, total: byDay.rows.reduce((s, r) => s + r.n, 0), accounts: 0 }], days, today())[0]
  return { name, days, daily: overview.daily, breakdown: summarizeBreakdown(details.rows) }
}

// --- sign-ins and returning visits -------------------------------------------------------------------------------------
// Counted here, on the server, so every way of signing in is included and nothing depends on the browser. The same rules as
// the browser events apply: admins and owners are not counted, and a request with Do Not Track / Global Privacy Control is
// never tied to an account (a sign-in is still counted, without one).

const isAdmin = (user) => hasRole(user.roles, 'admin', 'owner')
// The last day each account was noted in this process, so a busy account costs one database call a day, not one a request.
const noted = new Map()

/** A sign-in (method: password, email_link or password_reset). Never throws: counting must not get in the way of signing in. */
export async function recordLogin(user, method, headers = {}) {
  try {
    const dnt = askedNotToTrack(headers)
    if (!dnt) {
      await pool.query('UPDATE users SET last_seen_day = $2::date WHERE id = $1', [user.id, today()])
      noted.set(user.id, today())
    }
    if (!isAdmin(user)) await recordEvents([{ name: 'login', props: { method } }], dnt ? null : user.id)
  } catch (err) {
    console.warn('[events] could not record a sign-in:', err.message)
  }
}

/**
 * An account making a request while signed in. The first one of each day, when it was not a sign-in, is a returning visit
 * (session_resumed): that is what makes "active accounts per day" complete, since a session lasts 30 days.
 */
export async function noteActivity(user, headers = {}) {
  try {
    if (!user || askedNotToTrack(headers)) return
    const day = today()
    if (noted.get(user.id) === day) return
    if (noted.size > 5000) noted.clear()
    noted.set(user.id, day)
    // One atomic update decides who counts, so two requests at once still make one event.
    const { rowCount } = await pool.query('UPDATE users SET last_seen_day = $2::date WHERE id = $1 AND last_seen_day IS DISTINCT FROM $2::date', [user.id, day])
    if (rowCount && !isAdmin(user)) await recordEvents([{ name: 'session_resumed', props: {} }], user.id)
  } catch (err) {
    console.warn('[events] could not note activity:', err.message)
  }
}

/** Different accounts active on each of the last `days` days (UTC), with how many signed in and how many just came back. */
export async function dailyActive(days = 30) {
  const n = Math.min(Math.max(Math.floor(Number(days)) || 30, 7), 90)
  const { rows } = await pool.query(
    `SELECT day::text AS day,
            count(DISTINCT account_id)::int AS active,
            count(*) FILTER (WHERE name = 'login')::int AS logins,
            count(DISTINCT account_id) FILTER (WHERE name = 'session_resumed')::int AS resumed
     FROM events WHERE account_id IS NOT NULL AND ${WINDOW} GROUP BY day`,
    [n],
  )
  return { days: fillDailyActive(rows, n, today()) }
}
