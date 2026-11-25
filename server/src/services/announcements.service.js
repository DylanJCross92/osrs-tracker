import { pool } from '../db.js'
import { mailConfigured, sendMail } from '../utils/mailer.js'
import { ANNOUNCEMENTS } from '../utils/announcementEmail.js'
import { buildAudience } from '../utils/announcementAudience.js'
import { unsubscribeUrlFor } from './claimNudge.service.js'
import { AuthError } from './auth.service.js'

// One-off announcement emails, sent by the owner from the admin area (see utils/announcementEmail.js for what they say).
//  - Goes to confirmed accounts and to people who asked for news, never to anyone who unsubscribed, never to the team, once per address.
//  - Each success is recorded (announcement_sends), so pressing send again, or after a restart part way through, carries on where it
//    stopped and never repeats anyone.
//  - Sends one message at a time with a short pause (the mail service allows about two a second) and stops if the mail service keeps
//    refusing, instead of working through the whole list failing.
//  - Refuses to start until the site's own sending address is set (NOTIFY_FROM): Resend's shared address only delivers to the owner.

const PAUSE_MS = 600
const STOP_AFTER_FAILURES_IN_A_ROW = 5
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const site = () => process.env.SITE_URL || 'https://tickgains.com'

// What the running send is up to (this server instance only; the sent list is in the database).
const runs = new Map()

function announcement(key) {
  const a = ANNOUNCEMENTS[key]
  if (!a) throw new AuthError('No such announcement.', 404)
  return a
}

async function lists(key) {
  const [users, subscribers, sent] = await Promise.all([
    pool.query(
      `SELECT u.id, u.email FROM users u
       WHERE u.email_verified_at IS NOT NULL AND u.email_optout_at IS NULL AND NOT (u.roles && ARRAY['admin', 'owner'])
       ORDER BY u.id`,
    ),
    pool.query('SELECT email, unsub_token FROM email_subscribers WHERE unsubscribed_at IS NULL ORDER BY id'),
    pool.query('SELECT email FROM announcement_sends WHERE key = $1', [key]),
  ])
  return { users: users.rows, subscribers: subscribers.rows, sent: sent.rows.map((r) => r.email) }
}

async function messageFor(key, recipient) {
  const unsubscribeUrl = recipient.kind === 'user' ? await unsubscribeUrlFor(recipient.userId) : `${site()}/unsubscribe?t=${recipient.token}`
  return { unsubscribeUrl, ...announcement(key).build({ unsubscribeUrl }) }
}

const readiness = () => ({ configured: mailConfigured(), ownSender: Boolean(process.env.NOTIFY_FROM) })

/** What the owner sees before sending: the email as it will look, who it goes to, how many are done, and whether a send is running. */
export async function announcementStatus(key) {
  const a = announcement(key)
  const l = await lists(key)
  const everyone = buildAudience({ users: l.users, subscribers: l.subscribers })
  const left = buildAudience({ users: l.users, subscribers: l.subscribers, alreadySent: l.sent })
  const preview = a.build({ unsubscribeUrl: `${site()}/unsubscribe` })
  const run = runs.get(key)
  return {
    key,
    subject: a.subject,
    html: preview.html,
    audience: { accounts: l.users.length, subscribers: l.subscribers.length, total: everyone.length },
    alreadySent: everyone.length - left.length,
    remaining: left.length,
    ...readiness(),
    run: run ? { ...run } : null,
  }
}

/** Sends the email to one address (the owner's own, to check it), marked as a test and not recorded. */
export async function sendAnnouncementTest(key, to) {
  const a = announcement(key)
  if (!to) throw new AuthError('Your account has no email address to send the test to.', 409)
  if (!mailConfigured()) throw new AuthError('Email is not set up on this server (no RESEND_API_KEY).', 503)
  const email = a.build({ unsubscribeUrl: `${site()}/unsubscribe` })
  const ok = await sendMail({ to, subject: `[Test] ${email.subject}`, text: email.text, html: email.html })
  if (!ok) throw new AuthError('The test email could not be sent.', 502)
  return { ok: true, sentTo: to }
}

/**
 * Works through `recipients` one at a time. `send(recipient)` resolves true when the message was accepted; `record(recipient)` saves it as
 * sent. Pure of the database and the mail service so it can be tested. Updates `state` as it goes and returns it.
 */
export async function runAnnouncement({ recipients, send, record, state = {}, pause = PAUSE_MS, wait = sleep, stopAfter = STOP_AFTER_FAILURES_IN_A_ROW }) {
  Object.assign(state, { running: true, total: recipients.length, sent: 0, failed: 0, stoppedReason: '', startedAt: state.startedAt || new Date().toISOString() })
  let inARow = 0
  for (const recipient of recipients) {
    if (state.sent + state.failed) await wait(pause)
    let ok = false
    try {
      ok = await send(recipient)
    } catch {
      ok = false
    }
    if (ok) {
      state.sent++
      inARow = 0
      await record(recipient).catch(() => {})
    } else {
      state.failed++
      inARow++
      if (inARow >= stopAfter) {
        state.stoppedReason = `Stopped after ${stopAfter} failures in a row. Check the mail service, then press send again to carry on.`
        break
      }
    }
  }
  state.running = false
  state.finishedAt = new Date().toISOString()
  return state
}

/** Starts sending to everyone who has not had it yet. Answers at once; the work carries on in the background (see announcementStatus). */
export async function startAnnouncement(key) {
  announcement(key)
  const { configured, ownSender } = readiness()
  if (!configured) throw new AuthError('Email is not set up on this server (no RESEND_API_KEY).', 503)
  if (!ownSender) throw new AuthError('The site\'s own sending address is not set (NOTIFY_FROM). Until it is, only your own address can receive email, so nothing was sent.', 503)
  if (runs.get(key)?.running) throw new AuthError('This announcement is already being sent.', 409)

  const l = await lists(key)
  const recipients = buildAudience({ users: l.users, subscribers: l.subscribers, alreadySent: l.sent })
  if (!recipients.length) return { started: false, remaining: 0 }

  const state = {}
  runs.set(key, state)
  // Not awaited: sending a long list takes minutes (a short pause between messages).
  runAnnouncement({
    recipients,
    state,
    send: async (r) => {
      const m = await messageFor(key, r)
      return sendMail({ to: r.email, subject: m.subject, text: m.text, html: m.html, headers: { 'List-Unsubscribe': `<${m.unsubscribeUrl}>` } })
    },
    record: (r) => pool.query('INSERT INTO announcement_sends (key, email) VALUES ($1, $2) ON CONFLICT DO NOTHING', [key, r.email.toLowerCase()]),
  }).catch((err) => {
    state.running = false
    state.stoppedReason = `Stopped: ${err.message}`
  })
  return { started: true, remaining: recipients.length }
}
