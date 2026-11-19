import { pool } from '../db.js'
import { mailConfigured, sendMail } from '../utils/mailer.js'
import { CLAIM_EXPIRY_HOURS, claimExpiryEmail, deadlineLabel } from '../utils/claimExpiryEmail.js'
import { claimContact } from './claims.service.js'
import { addNotification } from './inbox.service.js'
import { unsubscribeUrlFor } from './claimNudge.service.js'

// The life of a claim that is never finished:
//   - 24 hours after it was opened, the person gets an email (and a notification) saying it closes in 48 hours;
//   - 48 hours after that email, the claim is closed ('expired'). Closing it frees the profile and they can open a new claim.
// The 48 hours start when the email goes out: expires_at is moved to that moment plus 48 hours, and expiry_email_at marks the claim
// as handled, so nothing is sent or moved twice. Until email is set up with the site's own sender (NOTIFY_FROM), nobody but the
// owner could receive it, so claims keep their usual 14 days instead of closing with no warning.

export const CLAIM_EMAIL_AFTER_HOURS = 24
export { CLAIM_EXPIRY_HOURS }
const PAUSE_MS = 600 // the mail service allows about two messages a second
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const emailReady = () => mailConfigured() && Boolean(process.env.NOTIFY_FROM)

/** Closes every waiting claim whose time has run out. Returns how many were closed. */
export async function closeExpiredClaims() {
  const { rowCount } = await pool.query(`UPDATE profile_claims SET status = 'expired', decided_at = now() WHERE status = 'pending' AND expires_at <= now()`)
  return rowCount
}

/**
 * Claims opened over a day ago and still waiting: start their 48 hours, email the person, and add a notification with the
 * deadline. Someone who unsubscribed from reminder emails still gets the deadline and the notification, just not the email.
 * Returns { sent, failed, notified }.
 */
export async function sendClaimExpiryEmails(limit = 25) {
  if (!emailReady()) return { sent: 0, failed: 0, notified: 0 }
  const { rows } = await pool.query(
    `SELECT c.id, c.user_id, p.username, p.display_name, u.email, u.email_optout_at
     FROM profile_claims c JOIN players p ON p.id = c.player_id JOIN users u ON u.id = c.user_id
     WHERE c.status = 'pending' AND c.expires_at > now() AND c.expiry_email_at IS NULL AND c.created_at <= now() - make_interval(hours => $1)
     ORDER BY c.created_at ASC LIMIT $2`,
    [CLAIM_EMAIL_AFTER_HOURS, limit],
  )
  let sent = 0
  let failed = 0
  let notified = 0
  for (const c of rows) {
    // One update decides who handles the claim, so two runs at once still make one email.
    const { rows: got } = await pool.query(
      `UPDATE profile_claims SET expiry_email_at = now(), expires_at = now() + make_interval(hours => $2)
       WHERE id = $1 AND status = 'pending' AND expiry_email_at IS NULL RETURNING expires_at`,
      [c.id, CLAIM_EXPIRY_HOURS],
    )
    if (!got[0]) continue
    const deadline = got[0].expires_at
    if (!c.email_optout_at) {
      if (sent + failed) await sleep(PAUSE_MS)
      const player = { username: c.username, displayName: c.display_name }
      const unsubscribeUrl = await unsubscribeUrlFor(c.user_id)
      const mail = claimExpiryEmail({ player, deadline, contact: claimContact(), unsubscribeUrl })
      const ok = await sendMail({ to: c.email, subject: mail.subject, text: mail.text, html: mail.html, headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` } })
      if (ok) sent++
      else failed++
    }
    // The same notification the daily reminder uses (same dedupe key), now saying when the claim closes.
    const added = await addNotification(c.user_id, {
      type: 'claim_reminder',
      text: `Your claim for ${c.display_name} closes ${deadlineLabel(deadline)}. Send your code in game to finish.`,
      link: `/player/${encodeURIComponent(c.username)}`,
      dedupeKey: `claim-reminder:${c.id}`,
      subject: c.username,
    })
    if (added) notified++
  }
  return { sent, failed, notified }
}
