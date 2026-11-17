import { pool } from '../db.js'
import { RETENTION_DAYS, summarizeBreakdown, summarizeEvents } from '../utils/events.js'

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
