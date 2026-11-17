import { pool } from '../db.js'
import { KINDS } from '../utils/feedback.js'
import { notifyFeedback } from './notify.service.js'

/**
 * Saves a piece of feedback (see utils/feedback.js cleanFeedback), then emails it to the owner. The email is sent in the
 * background so the sender is not kept waiting; the message is safe in the database either way.
 */
export async function saveFeedback({ kind, message, email, page, viewport }, accountId) {
  const { rows } = await pool.query(
    `INSERT INTO feedback (kind, message, reply_email, page, viewport, account_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [kind, message, email, page || null, viewport || null, accountId],
  )
  const id = rows[0].id
  notifyFeedback({ id, kind, kindLabel: KINDS[kind], message, email, page, viewport, signedIn: Boolean(accountId) })
    .then((sent) => sent && pool.query('UPDATE feedback SET emailed_at = now() WHERE id = $1', [id]))
    .catch(() => {})
  return id
}
