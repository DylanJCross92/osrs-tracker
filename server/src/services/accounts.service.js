import { pool } from '../db.js'

const MAX_ACCOUNTS = 500
const iso = (d) => (d ? new Date(d).toISOString() : null)

/**
 * Everyone who has signed up, for the Users tab of the statistics page, most recently seen first. Per account: when it was
 * created, whether the email is confirmed, which players it has claimed (and how many claims are waiting), when it was last
 * seen, and how much it did in the last `days` days (steps and the number of different days, from the product events).
 * Admins and owners are never counted in the events, so they carry a `team` flag and no activity.
 */
export async function accountsOverview(days) {
  const [{ rows }, { rows: totals }] = await Promise.all([
    pool.query(
      `SELECT u.id, u.email, u.created_at, u.email_verified_at, u.roles,
              coalesce(u.last_seen_at, u.last_login_at) AS last_seen,
              u.last_login_at,
              coalesce((SELECT array_agg(p.display_name ORDER BY p.display_name) FROM profile_claims c JOIN players p ON p.id = c.player_id
                         WHERE c.user_id = u.id AND c.status = 'verified'), '{}') AS players,
              (SELECT count(*)::int FROM profile_claims c WHERE c.user_id = u.id AND c.status = 'pending') AS pending,
              coalesce(a.steps, 0) AS steps, coalesce(a.active_days, 0) AS active_days
       FROM users u
       LEFT JOIN (
         SELECT account_id, count(*)::int AS steps, count(DISTINCT day)::int AS active_days
         FROM events
         WHERE day > ((now() AT TIME ZONE 'utc')::date - $1::int) AND account_id IS NOT NULL
         GROUP BY account_id
       ) a ON a.account_id = u.id
       ORDER BY coalesce(u.last_seen_at, u.last_login_at, u.created_at) DESC, u.id DESC
       LIMIT ${MAX_ACCOUNTS}`,
      [days],
    ),
    pool.query('SELECT count(*)::int AS n FROM users'),
  ])
  return {
    days,
    total: totals[0].n,
    accounts: rows.map((r) => ({
      id: r.id,
      email: r.email,
      createdAt: iso(r.created_at),
      verifiedAt: iso(r.email_verified_at),
      lastSeen: iso(r.last_seen),
      players: r.players || [],
      pending: r.pending,
      steps: r.steps,
      activeDays: r.active_days,
      team: Array.isArray(r.roles) && (r.roles.includes('admin') || r.roles.includes('owner')),
    })),
  }
}
