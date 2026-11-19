import crypto from 'node:crypto'
import { pool } from '../db.js'
import { mailConfigured, sendMail } from '../utils/mailer.js'
import { claimNudgeEmail } from '../utils/claimNudgeEmail.js'

// The reminder email for confirmed accounts that never claimed a player (see utils/claimNudgeEmail.js).
//  - New accounts: an hourly job emails each one about a day after it confirmed its email (once NOTIFY_FROM is set).
//  - Accounts that already existed when this shipped are marked 'legacy' and are only emailed when the owner asks for it on the
//    User Management page.
// Nobody is emailed twice, nobody who claimed or started a claim, nobody who unsubscribed, and never the team.

export const NUDGE_AFTER_HOURS = 24
const PAUSE_MS = 600 // the mail service allows about two messages a second
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const site = () => process.env.SITE_URL || 'https://tickgains.com'

// Confirmed, not unsubscribed, not on the team, and no claim done or in progress.
const ELIGIBLE = `u.email_verified_at IS NOT NULL AND u.email_optout_at IS NULL
  AND NOT ('admin' = ANY(u.roles) OR 'owner' = ANY(u.roles))
  AND NOT EXISTS (SELECT 1 FROM profile_claims c WHERE c.user_id = u.id AND (c.status = 'verified' OR (c.status = 'pending' AND c.expires_at > now())))`

const iso = (d) => (d ? new Date(d).toISOString() : null)

/** What the User Management page shows: who has been emailed, who is waiting, and who is left over from before this existed. */
export async function claimNudgeOverview() {
  const [{ rows: legacy }, { rows: counts }] = await Promise.all([
    pool.query(`SELECT u.id, u.email, u.email_verified_at, u.created_at FROM users u WHERE u.claim_nudge_state = 'legacy' AND ${ELIGIBLE} ORDER BY u.created_at DESC, u.id DESC LIMIT 500`),
    pool.query(
      `SELECT count(*) FILTER (WHERE u.claim_nudge_state = 'sent')::int AS sent,
              count(*) FILTER (WHERE u.claim_nudge_state IS NULL AND ${ELIGIBLE})::int AS waiting,
              count(*) FILTER (WHERE u.email_optout_at IS NOT NULL)::int AS opted_out
       FROM users u`,
    ),
  ])
  return {
    mail: { configured: mailConfigured(), sharedSender: !process.env.NOTIFY_FROM },
    afterHours: NUDGE_AFTER_HOURS,
    sent: counts[0].sent,
    waiting: counts[0].waiting,
    optedOut: counts[0].opted_out,
    legacy: legacy.map((r) => ({ id: r.id, email: r.email, verifiedAt: iso(r.email_verified_at), createdAt: iso(r.created_at) })),
  }
}

async function unsubscribeUrlFor(userId) {
  const { rows } = await pool.query('SELECT unsub_token FROM users WHERE id = $1', [userId])
  let token = rows[0]?.unsub_token
  if (!token) {
    token = crypto.randomBytes(24).toString('hex')
    await pool.query('UPDATE users SET unsub_token = COALESCE(unsub_token, $2) WHERE id = $1', [userId, token])
    const again = await pool.query('SELECT unsub_token FROM users WHERE id = $1', [userId])
    token = again.rows[0].unsub_token
  }
  return `${site()}/unsubscribe?t=${token}`
}

async function deliver(user, { mark }) {
  const unsubscribeUrl = await unsubscribeUrlFor(user.id)
  const email = claimNudgeEmail({ unsubscribeUrl })
  const ok = await sendMail({ to: user.email, subject: email.subject, text: email.text, html: email.html, headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` } })
  if (ok && mark) await pool.query(`UPDATE users SET claim_nudge_state = 'sent', claim_nudge_at = now() WHERE id = $1`, [user.id])
  return ok
}

async function sendAll(users) {
  let sent = 0
  let failed = 0
  for (const u of users) {
    if (sent + failed) await sleep(PAUSE_MS)
    if (await deliver(u, { mark: true })) sent++
    else failed++
  }
  return { sent, failed }
}

/**
 * The hourly job: new accounts whose email was confirmed over a day ago. Does nothing until email is set up with the site's own
 * sender (NOTIFY_FROM): Resend's shared sender only delivers to the owner, so every other address would be refused, hour after hour.
 */
export async function sendDueClaimNudges(limit = 25) {
  if (!mailConfigured() || !process.env.NOTIFY_FROM) return { sent: 0, failed: 0 }
  const { rows } = await pool.query(
    `SELECT u.id, u.email FROM users u
     WHERE u.claim_nudge_state IS NULL AND u.email_verified_at <= now() - make_interval(hours => $1) AND ${ELIGIBLE}
     ORDER BY u.email_verified_at ASC LIMIT $2`,
    [NUDGE_AFTER_HOURS, limit],
  )
  return sendAll(rows)
}

/** The owner's button: the accounts from before this existed (all of them, or just these ids). At most 100 at a time. */
export async function sendLegacyClaimNudges(ids = null) {
  if (!mailConfigured()) return { sent: 0, failed: 0, notConfigured: true }
  const wanted = Array.isArray(ids) ? ids.map(Number).filter(Number.isInteger).slice(0, 100) : null
  const { rows } = await pool.query(
    `SELECT u.id, u.email FROM users u
     WHERE u.claim_nudge_state = 'legacy' AND ${ELIGIBLE} ${wanted ? 'AND u.id = ANY($1::int[])' : ''}
     ORDER BY u.created_at DESC, u.id DESC LIMIT 100`,
    wanted ? [wanted] : [],
  )
  return { ...(await sendAll(rows)), remaining: Math.max(0, (await claimNudgeOverview()).legacy.length) }
}

/** One email to the person asking (the owner), so they can see it in a real inbox. Nobody is marked as emailed. */
export async function sendClaimNudgeTest(user) {
  if (!mailConfigured()) return false
  return deliver({ id: user.id, email: user.email }, { mark: false })
}
