import { pool } from '../db.js'
import { RETENTION_DAYS, askedNotToTrack, summarizeBreakdown, summarizeEvents } from '../utils/events.js'
import { fillDailyActive } from '../utils/dailyActive.js'
import { ANON_KEY, buildJourney, parsePersonKey } from '../utils/journeys.js'
import { hasRole } from '../utils/roles.js'
import { describeOwners, findPlanOwners } from '../utils/planMatch.js'

const today = () => new Date().toISOString().slice(0, 10)
const WINDOW = `day > (now() AT TIME ZONE 'utc')::date - $1::int`

/**
 * Stores a batch of cleaned events (see utils/events.js). accountId is null for signed-out visitors. visitorId is the random id
 * the browser keeps (null when it asked not to be tracked); with an account, the id is linked to it, so what the person did
 * before signing in joins their account.
 */
export async function recordEvents(events, accountId, visitorId = null) {
  if (!events.length) return
  await pool.query(
    `INSERT INTO events (name, props, account_id, visitor_id)
     SELECT t.n, t.p::jsonb, $3::int, $4::text FROM unnest($1::text[], $2::text[]) AS t(n, p)`,
    [events.map((e) => e.name), events.map((e) => JSON.stringify(e.props)), accountId, visitorId],
  )
  if (visitorId && accountId) await linkVisitor(visitorId, accountId)
}

/**
 * Remembers which account a browser id belongs to. Written when it changes, and at most once a day otherwise. keepPlans leaves the
 * plans copied from that browser where they are: at sign-up the browser is not signed in yet, so its plans have not reached the account.
 */
export async function linkVisitor(visitorId, accountId, { keepPlans = false } = {}) {
  const { rowCount } = await pool.query(
    `INSERT INTO visitor_links (visitor_id, account_id) VALUES ($1, $2)
     ON CONFLICT (visitor_id) DO UPDATE SET account_id = EXCLUDED.account_id, linked_at = now()
     WHERE visitor_links.account_id IS DISTINCT FROM EXCLUDED.account_id OR visitor_links.linked_at < now() - interval '1 day'`,
    [visitorId, accountId],
  )
  // Their plans now sync to the account, so the copy kept under the visitor id is not needed.
  if (rowCount && !keepPlans) await pool.query('DELETE FROM visitor_data WHERE visitor_id = $1', [visitorId])
}

/** Deletes events older than the retention period, and browser links nobody has refreshed for as long. */
export async function purgeOldEvents() {
  const { rowCount } = await pool.query(`DELETE FROM events WHERE day <= (now() AT TIME ZONE 'utc')::date - $1::int`, [RETENTION_DAYS])
  await pool.query(`DELETE FROM visitor_links WHERE linked_at < now() - $1::int * interval '1 day'`, [RETENTION_DAYS])
  await pool.query(`DELETE FROM visitor_data WHERE updated_at < now() - $1::int * interval '1 day'`, [RETENTION_DAYS])
  return rowCount
}

// --- following one visitor ---------------------------------------------------------------------------------------------------
// A person is an account when the event (or the browser id behind it) belongs to one, otherwise a browser id. Only events with a
// time and either of those can be followed, so this starts from when the ids shipped.

const PERSON = `COALESCE(e.account_id, l.account_id)`

/** The people active in the last `days` days, most recently active first: [{ key, kind, label, players, events, pages, first, last }]. */
export async function visitors(days) {
  const { rows } = await pool.query(
    `SELECT CASE WHEN ${PERSON} IS NOT NULL THEN 'a:' || ${PERSON} ELSE 'v:' || e.visitor_id END AS key,
            ${PERSON} AS account_id,
            count(*)::int AS events,
            count(*) FILTER (WHERE e.name = 'spa_page_view')::int AS pages,
            min(e.at) AS first, max(e.at) AS last
     FROM events e LEFT JOIN visitor_links l ON l.visitor_id = e.visitor_id
     WHERE e.at > now() - $1::int * interval '1 day' AND (e.visitor_id IS NOT NULL OR e.account_id IS NOT NULL)
     GROUP BY 1, 2
     ORDER BY max(e.at) DESC
     LIMIT 150`,
    [days],
  )
  const ids = rows.filter((r) => r.account_id).map((r) => r.account_id)
  const who = new Map()
  if (ids.length) {
    const { rows: accounts } = await pool.query(
      `SELECT u.id, u.email,
              (SELECT string_agg(p.display_name, ', ' ORDER BY p.display_name) FROM profile_claims c JOIN players p ON p.id = c.player_id
                WHERE c.user_id = u.id AND c.status = 'verified') AS players
       FROM users u WHERE u.id = ANY($1::int[])`,
      [ids],
    )
    for (const a of accounts) who.set(a.id, a)
  }
  const { rows: anon } = await pool.query(
    `SELECT count(*)::int AS events, count(*) FILTER (WHERE name = 'spa_page_view')::int AS pages, min(at) AS first, max(at) AS last
     FROM events WHERE at > now() - $1::int * interval '1 day' AND visitor_id IS NULL AND account_id IS NULL`,
    [days],
  )
  const unfollowed = anon[0]?.events
    ? [{ key: ANON_KEY, kind: 'anon', label: 'Not followed', players: '', note: 'Do Not Track, a blocked request or no storage: several people mixed together', events: anon[0].events, pages: anon[0].pages, first: new Date(anon[0].first).toISOString(), last: new Date(anon[0].last).toISOString() }]
    : []
  return {
    days,
    visitors: [...unfollowed, ...rows.map((r) => {
      const a = r.account_id ? who.get(r.account_id) : null
      return {
        key: r.key,
        kind: r.account_id ? 'account' : 'visitor',
        label: a ? a.email : `Visitor ${r.key.slice(2, 8)}`,
        players: a?.players || '',
        events: r.events,
        pages: r.pages,
        first: new Date(r.first).toISOString(),
        last: new Date(r.last).toISOString(),
      }
    })].sort((a, b) => new Date(b.last) - new Date(a.last)),
  }
}

/**
 * A shared planner link someone opened carries a code for the plan in it (see utils/planMatch.js). For each such event, adds
 * `same_plan_as`: the people who have saved a plan with the same code, so the owner can see who the link probably came from.
 */
async function addPlanOwners(rows, viewedKey) {
  const opened = rows.filter((r) => r.name === 'planner_share_link_opened' && typeof r.props?.plan === 'string' && r.props.plan)
  if (!opened.length) return
  const [{ rows: accounts }, { rows: visitorRows }] = await Promise.all([
    pool.query(`SELECT id, email, data->'plans' AS plans, data->'planner' AS planner FROM users WHERE data ? 'plans' OR data ? 'planner'`),
    pool.query('SELECT visitor_id AS id, plans, planner FROM visitor_data'),
  ])
  for (const r of opened) {
    const owners = findPlanOwners(r.props.plan, accounts, visitorRows, viewedKey)
    if (owners.length) r.props = { ...r.props, same_plan_as: describeOwners(owners) }
  }
}

/** One person's journey over the last `days` days (see utils/journeys.js), or null for a key that is not one. */
/**
 * Deletes one browser visitor's records: their events and the plans copied from their browser. Only a visitor who never signed in
 * can be removed this way (an account is deleted from the accounts list). Returns { events } removed, or null for a key that is not a
 * browser visitor or a visitor who belongs to an account.
 */
export async function deleteVisitor(key) {
  const person = parsePersonKey(key)
  if (!person || person.kind !== 'visitor') return null
  const { rows } = await pool.query('SELECT 1 FROM visitor_links WHERE visitor_id = $1', [person.id])
  if (rows.length) return null
  const del = await pool.query('DELETE FROM events WHERE visitor_id = $1 AND account_id IS NULL', [person.id])
  await pool.query('DELETE FROM visitor_data WHERE visitor_id = $1', [person.id])
  return { events: del.rowCount }
}

export async function journeyOf(key, days) {
  const person = parsePersonKey(key)
  if (!person) return null
  const where = person.kind === 'anon' ? 'e.visitor_id IS NULL AND e.account_id IS NULL' : person.kind === 'account' ? `${PERSON} = $2::int` : `e.visitor_id = $2::text AND ${PERSON} IS NULL`
  const [{ rows }, { rows: info }] = await Promise.all([
    pool.query(
      `SELECT e.at, e.name, e.props FROM events e LEFT JOIN visitor_links l ON l.visitor_id = e.visitor_id
       WHERE e.at > now() - $1::int * interval '1 day' AND ${where} ORDER BY e.at, e.id LIMIT 1500`,
      person.kind === 'anon' ? [days] : [days, person.id],
    ),
    person.kind === 'account'
      ? pool.query(
          `SELECT u.email, (SELECT string_agg(p.display_name, ', ' ORDER BY p.display_name) FROM profile_claims c JOIN players p ON p.id = c.player_id
                             WHERE c.user_id = u.id AND c.status = 'verified') AS players FROM users u WHERE u.id = $1`,
          [person.id],
        )
      : Promise.resolve({ rows: [] }),
  ])
  await addPlanOwners(rows, key)
  const a = info[0]
  return {
    key,
    kind: person.kind,
    label: person.kind === 'anon' ? 'Not followed' : a ? a.email : `Visitor ${String(person.id).slice(0, 6)}`,
    players: a?.players || '',
    days,
    ...buildJourney(rows, days, today()),
  }
}

/** Every event seen in the last `days` days: total, different accounts (overall and today), today and a count per day. */
export async function eventsOverview(days) {
  const [byDay, totals] = await Promise.all([
    pool.query(`SELECT name, day::text AS day, count(*)::int AS n FROM events WHERE ${WINDOW} GROUP BY name, day`, [days]),
    pool.query(`SELECT name, count(*)::int AS total, count(DISTINCT account_id)::int AS accounts,
              count(DISTINCT account_id) FILTER (WHERE day = (now() AT TIME ZONE 'utc')::date)::int AS accounts_today
       FROM events WHERE ${WINDOW} GROUP BY name`, [days]),
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
// When each account's last-seen time was last written in this process, so it costs one database call every few minutes, not one a request.
const touched = new Map()
const TOUCH_EVERY_MS = 5 * 60_000

async function touchLastSeen(user) {
  const now = Date.now()
  if (now - (touched.get(user.id) || 0) < TOUCH_EVERY_MS) return
  if (touched.size > 5000) touched.clear()
  touched.set(user.id, now)
  await pool.query('UPDATE users SET last_seen_at = now() WHERE id = $1', [user.id])
}

/** A sign-in (method: password, email_link or password_reset). Never throws: counting must not get in the way of signing in. */
export async function recordLogin(user, method, headers = {}) {
  try {
    const dnt = askedNotToTrack(headers)
    if (!dnt) {
      await pool.query('UPDATE users SET last_seen_day = $2::date, last_seen_at = now() WHERE id = $1', [user.id, today()])
      noted.set(user.id, today())
      touched.set(user.id, Date.now())
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
    await touchLastSeen(user)
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

/**
 * Which accounts were active on one UTC day (YYYY-MM-DD): { day, accounts: [{ email, players, logins, returned, lastSeen }] }, busiest
 * first. For the site owner only. players is the OSRS names the account has claimed, if any.
 */
export async function activeAccounts(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day)) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) return null
  const { rows } = await pool.query(
    `SELECT u.email,
            (SELECT string_agg(p.display_name, ', ' ORDER BY p.display_name)
               FROM profile_claims c JOIN players p ON p.id = c.player_id
              WHERE c.user_id = u.id AND c.status = 'verified') AS players,
            count(*) FILTER (WHERE e.name = 'login')::int AS logins,
            coalesce(bool_or(e.name = 'session_resumed'), false) AS returned,
            coalesce(u.last_seen_at, u.last_login_at) AS last_seen,
            count(*)::int AS events
     FROM events e JOIN users u ON u.id = e.account_id
     WHERE e.day = $1::date
     GROUP BY u.id
     ORDER BY events DESC, u.email
     LIMIT 100`,
    [day],
  )
  return { day, accounts: rows.map((r) => ({ email: r.email, players: r.players || '', logins: r.logins, returned: r.returned, lastSeen: r.last_seen ? new Date(r.last_seen).toISOString() : null })) }
}
