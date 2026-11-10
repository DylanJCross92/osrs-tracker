import crypto from 'node:crypto'
import { pool } from '../db.js'
import { notifyNewSubscriber } from './notify.service.js'

/**
 * Adds an address to the news list. Safe to call twice with the same address: the second call changes nothing, and an
 * address that had unsubscribed is switched back on (they asked again). The caller gets nothing back about whether the
 * address was already known, so the form cannot be used to find out who is on the list. The owner is emailed only for a
 * brand-new or returning address, never for someone who is already subscribed.
 */
export async function subscribe(email, source = '') {
  const token = crypto.randomBytes(24).toString('hex')
  const { rows } = await pool.query(
    `INSERT INTO email_subscribers (email, source, unsub_token)
     VALUES ($1, $2, $3)
     ON CONFLICT (lower(email)) DO UPDATE SET unsubscribed_at = NULL
       WHERE email_subscribers.unsubscribed_at IS NOT NULL
     RETURNING id`,
    [email, source, token],
  )
  if (!rows.length) return
  // Fire and forget: the visitor is not kept waiting on the notification.
  countActive()
    .then((total) => notifyNewSubscriber({ email, source, total }))
    .catch(() => {})
}

async function countActive() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM email_subscribers WHERE unsubscribed_at IS NULL')
  return rows[0].n
}

/** Turns an address off from the link in an email. Returns false when the token matches nobody. */
export async function unsubscribeByToken(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{48}$/.test(token)) return false
  const { rowCount } = await pool.query('UPDATE email_subscribers SET unsubscribed_at = COALESCE(unsubscribed_at, now()) WHERE unsub_token = $1', [token])
  return rowCount > 0
}

/** Everyone currently subscribed, oldest first (for the owner's export). */
export async function listActiveSubscribers() {
  const { rows } = await pool.query('SELECT email, source, unsub_token, created_at FROM email_subscribers WHERE unsubscribed_at IS NULL ORDER BY created_at, id')
  return rows
}
