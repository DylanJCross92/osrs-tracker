import { pool } from '../db.js'
import { buildFunnel, buildJourney } from '../utils/funnel.js'

const UTC_TODAY = `(now() AT TIME ZONE 'utc')::date`
const MAX_PEOPLE = 50_000
const iso = (d) => (d ? new Date(d).toISOString() : null)

/**
 * The conversion funnel and the user journey for the last `days` days (see utils/funnel.js). One row per person: an account when the
 * browser's id (or the event) belongs to one, otherwise a browser id. People who already had an account before the window are
 * left out, since they are not prospects; accounts created inside it are included even when no event was recorded for them.
 * Admins and owners are never counted.
 */
export async function funnelOverview(days) {
  const { rows } = await pool.query(
    `WITH ev AS (
       SELECT COALESCE(e.account_id, l.account_id) AS aid, e.visitor_id AS vid, e.name, e.at
       FROM events e LEFT JOIN visitor_links l ON l.visitor_id = e.visitor_id
       WHERE e.day > ${UTC_TODAY} - $1::int AND (e.visitor_id IS NOT NULL OR e.account_id IS NOT NULL)
     ), people AS (
       SELECT max(aid) AS aid, min(at) AS first_at,
              min(at) FILTER (WHERE name IN ('player_added', 'profile_view')) AS player_at,
              coalesce(bool_or(name = 'player_added'), false) AS added,
              coalesce(bool_or(name = 'profile_view'), false) AS viewed
       FROM ev GROUP BY CASE WHEN aid IS NOT NULL THEN 'a:' || aid ELSE 'v:' || vid END
     ), fresh AS (
       SELECT u.id, u.created_at, u.email_verified_at, coalesce(u.last_seen_at, u.last_login_at) AS last_seen,
              (SELECT min(coalesce(c.decided_at, c.created_at)) FROM profile_claims c WHERE c.user_id = u.id AND c.status = 'verified') AS claimed_at
       FROM users u
       WHERE (u.created_at AT TIME ZONE 'utc')::date > ${UTC_TODAY} - $1::int
         AND NOT ('admin' = ANY(u.roles) OR 'owner' = ANY(u.roles))
     )
     SELECT p.first_at, p.player_at, coalesce(p.added, false) AS added, coalesce(p.viewed, false) AS viewed,
            f.created_at, f.email_verified_at, f.last_seen, f.claimed_at
     FROM people p FULL JOIN fresh f ON f.id = p.aid
     WHERE p.aid IS NULL OR f.id IS NOT NULL
     LIMIT ${MAX_PEOPLE}`,
    [days],
  )
  const people = rows.map((r) => ({
    first: iso(r.first_at && r.created_at ? (new Date(r.first_at) < new Date(r.created_at) ? r.first_at : r.created_at) : r.first_at || r.created_at),
    played: iso(r.player_at),
    added: r.added,
    viewed: r.viewed,
    signedUp: iso(r.created_at),
    confirmed: iso(r.email_verified_at),
    claimed: iso(r.claimed_at),
    back: iso(r.last_seen),
  }))
  return { days, capped: rows.length >= MAX_PEOPLE, funnel: buildFunnel(people), journey: buildJourney(people) }
}
