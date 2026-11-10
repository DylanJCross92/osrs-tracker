import { pool } from '../db.js'
import { hasRole } from '../utils/roles.js'
import { countPending } from './claims.service.js'

/**
 * What needs this account's attention right now, worked out live from the data (nothing is stored, so there is nothing
 * to mark as read: an item disappears once the thing it points at is dealt with). Each item is
 * { id, type, count, text, to }, where `to` is a path in the app. The avatar's red badge shows the total count.
 */
export async function getNotifications(user) {
  const items = []

  // Site admins: profile claims waiting for a code to be checked.
  if (hasRole(user.roles, 'admin', 'owner')) {
    const waiting = await countPending()
    if (waiting > 0) items.push({ id: 'claims-waiting', type: 'claims_waiting', count: waiting, text: waiting === 1 ? '1 profile claim waiting' : `${waiting} profile claims waiting`, to: '/admin/claims' })
  }

  // Everyone: their own claims that still need the in-game code sent.
  const { rows } = await pool.query(
    `SELECT c.id, p.username, p.display_name FROM profile_claims c JOIN players p ON p.id = c.player_id
     WHERE c.user_id = $1 AND c.status = 'pending' AND c.expires_at > now() ORDER BY c.created_at DESC LIMIT 10`,
    [user.id],
  )
  for (const r of rows) {
    items.push({ id: `claim-${r.id}`, type: 'claim_code', count: 1, text: `Send your code to finish claiming ${r.display_name}`, to: `/player/${encodeURIComponent(r.username)}` })
  }

  return { items, total: items.reduce((sum, i) => sum + i.count, 0) }
}
