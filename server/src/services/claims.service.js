import { pool } from '../db.js'
import { generateClaimCode, normalizeClaimCode } from '../utils/claimCode.js'

// Who to message in game. Change it with CLAIM_CONTACT_RSN if the account ever changes.
export const claimContact = () => process.env.CLAIM_CONTACT_RSN || 'Dylanz297'

export const CLAIM_DAYS = 14
const MAX_PENDING_PER_USER = 3
const MAX_OWNED_PER_USER = 5

/** An error that is safe to show as-is. */
export class ClaimError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

const shape = (r) => ({
  id: r.id,
  status: r.status,
  player: { username: r.username, displayName: r.display_name, avatarV: r.avatar_v ? Number(r.avatar_v) : null },
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  expired: r.status === 'pending' && new Date(r.expires_at) < new Date(),
})

const CLAIM_SELECT = `SELECT c.*, p.username, p.display_name, u.email,
  (SELECT extract(epoch from pp.avatar_updated_at)::bigint FROM profile_pages pp WHERE pp.player_id = p.id AND pp.avatar IS NOT NULL) AS avatar_v
  FROM profile_claims c
  JOIN players p ON p.id = c.player_id JOIN users u ON u.id = c.user_id`

async function ownerRow(playerId) {
  const { rows } = await pool.query(`SELECT user_id FROM profile_claims WHERE player_id = $1 AND status = 'verified'`, [playerId])
  return rows[0] || null
}

/**
 * What a visitor may see about a profile's claim. Anyone learns whether it is claimed (not by whom). A signed-in
 * person also learns whether it is theirs, and, if they have a claim waiting, their own code.
 */
export async function getClaimState(player, user) {
  const owner = await ownerRow(player.id)
  const state = { claimed: Boolean(owner), mine: 'none', contact: claimContact() }
  if (!user) return state
  if (owner && owner.user_id === user.id) return { ...state, mine: 'owner' }
  if (owner) return { ...state, mine: 'taken' }
  const { rows } = await pool.query(`SELECT * FROM profile_claims WHERE user_id = $1 AND player_id = $2 AND status = 'pending'`, [user.id, player.id])
  const pending = rows[0]
  if (pending && new Date(pending.expires_at) > new Date()) return { ...state, mine: 'pending', code: pending.code, expiresAt: pending.expires_at }
  return state
}

/** Starts (or renews) a claim and returns the code to send in game. */
export async function startClaim(user, player) {
  if (await ownerRow(player.id)) throw new ClaimError('This profile has already been claimed.', 409)

  const { rows: owned } = await pool.query(`SELECT count(*)::int AS n FROM profile_claims WHERE user_id = $1 AND status = 'verified'`, [user.id])
  if (owned[0].n >= MAX_OWNED_PER_USER) throw new ClaimError(`An account can own up to ${MAX_OWNED_PER_USER} profiles.`, 400)

  const { rows: mine } = await pool.query(`SELECT * FROM profile_claims WHERE user_id = $1 AND status = 'pending'`, [user.id])
  const existing = mine.find((c) => c.player_id === player.id)
  if (existing && new Date(existing.expires_at) > new Date()) return { code: existing.code, expiresAt: existing.expires_at, created: false }
  // An old, expired claim for this profile is replaced by a fresh code.
  if (existing) await pool.query(`UPDATE profile_claims SET status = 'cancelled', decided_at = now() WHERE id = $1`, [existing.id])
  const live = mine.filter((c) => c.id !== existing?.id && new Date(c.expires_at) > new Date())
  if (live.length >= MAX_PENDING_PER_USER) throw new ClaimError(`You can have ${MAX_PENDING_PER_USER} claims waiting at once. Finish or cancel one first.`, 400)

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO profile_claims (user_id, player_id, code, expires_at) VALUES ($1, $2, $3, now() + make_interval(days => $4)) RETURNING code, expires_at`,
        [user.id, player.id, generateClaimCode(), CLAIM_DAYS],
      )
      return { code: rows[0].code, expiresAt: rows[0].expires_at, created: true }
    } catch (err) {
      if (err.code !== '23505') throw err
      // A code clash (rare) retries with a new code; a clash on the (account, profile) pair means a parallel request won.
      if (String(err.constraint).includes('user_player')) return startClaim(user, player)
    }
  }
  throw new ClaimError('Could not create a code, please try again.', 500)
}

export async function cancelClaim(user, player) {
  const { rowCount } = await pool.query(
    `UPDATE profile_claims SET status = 'cancelled', decided_at = now() WHERE user_id = $1 AND player_id = $2 AND status = 'pending'`,
    [user.id, player.id],
  )
  return rowCount > 0
}

/** Everything an account has claimed or is waiting on, newest first. */
export async function listMyClaims(user) {
  const { rows } = await pool.query(`${CLAIM_SELECT} WHERE c.user_id = $1 AND c.status IN ('pending', 'verified') ORDER BY c.created_at DESC`, [user.id])
  return rows.map((r) => ({ ...shape(r), ...(r.status === 'pending' && !shape(r).expired ? { code: r.code } : {}) }))
}

// --- for the site owner --------------------------------------------------------------------------------------------

/** The waiting claim a code belongs to, for the owner to check before approving. Null when no live claim has that code. */
export async function lookupByCode(rawCode) {
  const code = normalizeClaimCode(rawCode)
  if (!code) return null
  const { rows } = await pool.query(`${CLAIM_SELECT} WHERE c.code = $1 AND c.status = 'pending' AND c.expires_at > now()`, [code])
  return rows[0] ? { ...shape(rows[0]), email: rows[0].email, userId: rows[0].user_id } : null
}

/** Approves the claim a code belongs to: that account now owns the profile. Returns the claim (with the owner's email). */
export async function approveByCode(admin, rawCode) {
  const claim = await lookupByCode(rawCode)
  if (!claim) throw new ClaimError('No waiting claim has that code. It may be wrong, expired or already used.', 404)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Any other claims for the same profile are closed; the unique index guarantees a single owner.
    await client.query(`UPDATE profile_claims SET status = 'rejected', decided_at = now(), decided_by = $2 WHERE player_id = (SELECT player_id FROM profile_claims WHERE id = $1) AND status = 'pending' AND id <> $1`, [claim.id, admin.id])
    await client.query(`UPDATE profile_claims SET status = 'verified', decided_at = now(), decided_by = $2 WHERE id = $1 AND status = 'pending'`, [claim.id, admin.id])
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    if (err.code === '23505') throw new ClaimError('This profile already has an owner.', 409)
    throw err
  } finally {
    client.release()
  }
  return { ...claim, status: 'verified' }
}

export async function rejectClaim(admin, id) {
  const { rows } = await pool.query(
    `UPDATE profile_claims c SET status = 'rejected', decided_at = now(), decided_by = $2 FROM players p
     WHERE c.id = $1 AND c.status = 'pending' AND p.id = c.player_id RETURNING c.user_id, p.username, p.display_name`,
    [id, admin.id],
  )
  if (!rows[0]) throw new ClaimError('That claim is not waiting any more.', 404)
  return { userId: rows[0].user_id, player: { username: rows[0].username, displayName: rows[0].display_name } }
}

export async function revokeClaim(admin, id) {
  const { rowCount } = await pool.query(`UPDATE profile_claims SET status = 'revoked', decided_at = now(), decided_by = $2 WHERE id = $1 AND status = 'verified'`, [id, admin.id])
  if (!rowCount) throw new ClaimError('That profile is not claimed any more.', 404)
}

/** Waiting and verified claims for the owner's page. Codes are left out on purpose: the owner types in the one they received. */
export async function adminOverview() {
  const { rows } = await pool.query(`${CLAIM_SELECT} WHERE c.status IN ('pending', 'verified') ORDER BY c.created_at DESC LIMIT 300`)
  const all = rows.map((r) => ({ ...shape(r), email: r.email }))
  return { pending: all.filter((c) => c.status === 'pending'), verified: all.filter((c) => c.status === 'verified') }
}

export async function countPending() {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM profile_claims WHERE status = 'pending' AND expires_at > now()`)
  return rows[0].n
}
