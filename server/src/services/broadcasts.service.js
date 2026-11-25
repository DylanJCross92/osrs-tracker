import { pool } from '../db.js'
import { BROADCASTS, MAX_NOTICE_TEXT, broadcastDedupeKey } from '../utils/broadcasts.js'
import { AuthError } from './auth.service.js'

// One-off in-app notices to every account, sent by the owner (what they say is in utils/broadcasts.js). Every account gets it once:
// the notifications table keeps one notice per account and dedupe key, so pressing send again only reaches accounts created since.

function broadcast(key) {
  const b = BROADCASTS[key]
  if (!b) throw new AuthError('No such notice.', 404)
  return b
}

/** What the owner sees before sending: the notice, how many accounts exist and how many already have it. */
export async function broadcastStatus(key) {
  const b = broadcast(key)
  const dedupe = broadcastDedupeKey(key)
  const [{ rows: accounts }, { rows: sent }] = await Promise.all([
    pool.query('SELECT count(*)::int AS n FROM users'),
    pool.query('SELECT count(*)::int AS n FROM notifications WHERE dedupe_key = $1', [dedupe]),
  ])
  return { key, text: b.text, link: b.link, accounts: accounts[0].n, alreadySent: sent[0].n, remaining: Math.max(accounts[0].n - sent[0].n, 0) }
}

/** Adds the notice for every account that does not have it yet, in one go. Returns how many accounts it reached. */
export async function sendBroadcast(key) {
  const b = broadcast(key)
  if (b.text.length > MAX_NOTICE_TEXT) throw new AuthError('That notice is too long.', 500)
  const { rowCount } = await pool.query(
    `INSERT INTO notifications (user_id, type, text, link, dedupe_key)
     SELECT id, $1, $2, $3, $4 FROM users
     ON CONFLICT DO NOTHING`,
    [b.type, b.text, b.link, broadcastDedupeKey(key)],
  )
  return { sent: rowCount }
}
