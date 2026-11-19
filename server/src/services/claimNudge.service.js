import crypto from 'node:crypto'
import { pool } from '../db.js'
import { mailConfigured, sendMail } from '../utils/mailer.js'
import { claimNudgeEmail } from '../utils/claimNudgeEmail.js'
import { AuthError } from './auth.service.js'

// The reminder email for confirmed accounts that never claimed a player (see utils/claimNudgeEmail.js).
//  - By hand: the owner sends it to one account from the row menu on User Management.
//  - Automatically: an hourly job emails each new account about a day after it confirmed its email (once NOTIFY_FROM is set).
//    Accounts that already existed when this shipped are marked 'legacy' in claim_nudge_state, so the job never touches them.
// The job never emails anyone twice, nobody who claimed or started a claim, nobody who unsubscribed, and never the team.

export const NUDGE_AFTER_HOURS = 24
const PAUSE_MS = 600 // the mail service allows about two messages a second
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const site = () => process.env.SITE_URL || 'https://tickgains.com'

// Confirmed, not unsubscribed, not on the team, and no claim done or in progress.
const ELIGIBLE = `u.email_verified_at IS NOT NULL AND u.email_optout_at IS NULL
  AND NOT ('admin' = ANY(u.roles) OR 'owner' = ANY(u.roles))
  AND NOT EXISTS (SELECT 1 FROM profile_claims c WHERE c.user_id = u.id AND (c.status = 'verified' OR (c.status = 'pending' AND c.expires_at > now())))`

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

async function deliver(user) {
  const unsubscribeUrl = await unsubscribeUrlFor(user.id)
  const email = claimNudgeEmail({ unsubscribeUrl })
  const ok = await sendMail({ to: user.email, subject: email.subject, text: email.text, html: email.html, headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` } })
  if (ok) await pool.query(`UPDATE users SET claim_nudge_state = 'sent', claim_nudge_at = now() WHERE id = $1`, [user.id])
  return ok
}

/**
 * The owner's choice: email this one account the reminder now. Refused (with a plain reason) when the account is unconfirmed,
 * already owns a profile, unsubscribed, or is on the team. Sending again is allowed. Returns { ok, email, sentAt }.
 */
export async function sendClaimNudgeToUser(userId) {
  const id = Number(userId)
  if (!Number.isInteger(id) || id < 1) throw new AuthError('No such account.', 404)
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.email_verified_at, u.email_optout_at, u.roles,
            EXISTS (SELECT 1 FROM profile_claims c WHERE c.user_id = u.id AND c.status = 'verified') AS claimed
     FROM users u WHERE u.id = $1`,
    [id],
  )
  const u = rows[0]
  if (!u) throw new AuthError('No such account.', 404)
  if (u.roles?.includes('admin') || u.roles?.includes('owner')) throw new AuthError('Team accounts do not get this email.', 409)
  if (!u.email_verified_at) throw new AuthError('This account has not confirmed its email yet.', 409)
  if (u.claimed) throw new AuthError('This account has already claimed a player.', 409)
  if (u.email_optout_at) throw new AuthError('This person unsubscribed from reminder emails.', 409)
  if (!mailConfigured()) throw new AuthError('Email is not set up on this server (no RESEND_API_KEY).', 503)
  if (!(await deliver(u))) throw new AuthError('The email could not be sent. Until NOTIFY_FROM is set, only your own address can receive it.', 502)
  return { ok: true, email: u.email, sentAt: new Date().toISOString() }
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
  let sent = 0
  let failed = 0
  for (const u of rows) {
    if (sent + failed) await sleep(PAUSE_MS)
    if (await deliver(u)) sent++
    else failed++
  }
  return { sent, failed }
}
