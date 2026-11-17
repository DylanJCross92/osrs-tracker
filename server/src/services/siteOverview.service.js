import { pool } from '../db.js'
import { dayLabels, growthItems, mergeFeed } from '../utils/siteOverview.js'

const today = () => new Date().toISOString().slice(0, 10)
const UTC_TODAY = `(now() AT TIME ZONE 'utc')::date`

// What the site keeps growing, and where each thing's creation time lives. These are fixed strings (nothing from a request).
const SOURCES = [
  { key: 'accounts', label: 'Accounts', table: 'users', ts: 'created_at', where: 'email_verified_at IS NOT NULL' },
  { key: 'players', label: 'Tracked players', table: 'players', ts: 'created_at' },
  { key: 'claims', label: 'Claimed profiles', table: 'profile_claims', ts: 'decided_at', where: "status = 'verified'" },
  { key: 'follows', label: 'Follows', table: 'follows', ts: 'created_at' },
  { key: 'goals', label: 'Goals set', table: 'profile_goals', ts: 'created_at' },
  { key: 'plans', label: 'Shared plans', table: 'shared_plans', ts: 'created_at' },
  { key: 'clans', label: 'Clans', table: 'clans', ts: 'created_at' },
  { key: 'competitions', label: 'Competitions', table: 'competitions', ts: 'created_at' },
  { key: 'subscribers', label: 'Email subscribers', table: 'email_subscribers', ts: 'created_at', where: 'unsubscribed_at IS NULL' },
  { key: 'feedback', label: 'Feedback', table: 'feedback', ts: 'created_at' },
]
const where = (s) => s.where || 'true'

const FEED_EACH = 12

/**
 * What is going on across the site, for the owner's statistics page: how much of everything exists and how fast it is growing
 * (per UTC day, like the events), plus a merged list of the latest things people did.
 */
export async function siteOverview(days) {
  const n = Math.min(Math.max(Math.floor(Number(days)) || 30, 7), 90)
  const perDay = SOURCES.map(
    (s) => `SELECT '${s.key}' AS key, (${s.ts} AT TIME ZONE 'utc')::date::text AS day, count(*)::int AS n FROM ${s.table}
            WHERE ${where(s)} AND ${s.ts} IS NOT NULL AND (${s.ts} AT TIME ZONE 'utc')::date > ${UTC_TODAY} - $1::int GROUP BY 2`,
  ).join(' UNION ALL ')
  const totals = SOURCES.map((s) => `SELECT '${s.key}' AS key, count(*)::int AS n FROM ${s.table} WHERE ${where(s)}`).join(' UNION ALL ')

  const [dayRows, totalRows, extra, feed] = await Promise.all([
    pool.query(perDay, [n]),
    pool.query(totals),
    pool.query(
      `SELECT (SELECT count(*)::int FROM users WHERE email_verified_at IS NULL) AS unverified,
              (SELECT count(*)::int FROM profile_claims WHERE status = 'pending' AND expires_at > now()) AS pending_claims,
              (SELECT count(*)::int FROM users WHERE email_verified_at IS NOT NULL AND last_seen_day >= ${UTC_TODAY} - 6) AS active_week`,
    ),
    Promise.all([
      pool.query(`SELECT created_at AS at, display_name AS text FROM players ORDER BY created_at DESC LIMIT ${FEED_EACH}`),
      pool.query(`SELECT created_at AS at, email AS text, (email_verified_at IS NOT NULL) AS verified FROM users ORDER BY created_at DESC LIMIT ${FEED_EACH}`),
      pool.query(
        `SELECT coalesce(c.decided_at, c.created_at) AS at, p.display_name AS text, c.status AS detail
         FROM profile_claims c JOIN players p ON p.id = c.player_id
         WHERE c.status IN ('pending', 'verified') ORDER BY coalesce(c.decided_at, c.created_at) DESC LIMIT ${FEED_EACH}`,
      ),
      pool.query(`SELECT created_at AS at, kind AS detail, left(message, 90) AS text FROM feedback ORDER BY created_at DESC LIMIT ${FEED_EACH}`),
      pool.query(`SELECT f.created_at AS at, p.display_name AS text FROM follows f JOIN players p ON p.id = f.player_id ORDER BY f.created_at DESC LIMIT ${FEED_EACH}`),
      pool.query(`SELECT created_at AS at, name AS text FROM clans ORDER BY created_at DESC LIMIT ${FEED_EACH}`),
      pool.query(`SELECT created_at AS at, title AS text FROM competitions ORDER BY created_at DESC LIMIT ${FEED_EACH}`),
    ]),
  ])

  const totalByKey = Object.fromEntries(totalRows.rows.map((r) => [r.key, r.n]))
  const [players, accounts, claims, feedback, follows, clans, competitions] = feed
  const tag = (rows, kind, map = (r) => ({})) => rows.rows.map((r) => ({ at: r.at, kind, text: r.text, ...map(r) }))
  const e = extra.rows[0]
  return {
    days: n,
    labels: dayLabels(n, today()),
    growth: growthItems(SOURCES, totalByKey, dayRows.rows, n, today()),
    unverified: e.unverified,
    pendingClaims: e.pending_claims,
    activeWeek: e.active_week,
    feed: mergeFeed(
      [
        tag(players, 'player'),
        tag(accounts, 'account', (r) => ({ detail: r.verified ? 'verified' : 'waiting for email' })),
        tag(claims, 'claim', (r) => ({ detail: r.detail })),
        tag(feedback, 'feedback', (r) => ({ detail: r.detail })),
        tag(follows, 'follow'),
        tag(clans, 'clan'),
        tag(competitions, 'competition'),
      ],
      30,
    ),
  }
}
