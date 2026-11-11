import crypto from 'node:crypto'
import { pool } from '../db.js'
import { normalizeEmail } from '../utils/email.js'
import { DUMMY_HASH, hashPassword, passwordProblem, verifyPassword } from '../utils/password.js'
import { sanitizeSettings } from '../utils/settings.js'
import { sanitizeUserData } from '../utils/userData.js'
import { OWNER_ROLES, hasRole, isOwnerEmail, normalizeRoles } from '../utils/roles.js'

export const SESSION_DAYS = 30
const RESET_MINUTES = 60

/** An error that is safe to show the visitor as-is. */
export class AuthError extends Error {
  // code lets the app react to a specific case (for example an account that still needs its email confirmed).
  constructor(message, status = 400, code = '') {
    super(message)
    this.status = status
    this.code = code
  }
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const newToken = () => crypto.randomBytes(32).toString('base64url')

/**
 * The owner's account (the address in OWNER_EMAIL) is an admin and the owner. Granted only to a confirmed account, so
 * nobody can get it by signing up with that address without being able to read its inbox.
 */
async function ensureOwnerRoles(row) {
  if (!row || !row.email_verified_at || !isOwnerEmail(row.email)) return row
  if (hasRole(row.roles, 'owner') && hasRole(row.roles, 'admin')) return row
  const { rows } = await pool.query('UPDATE users SET roles = $2::text[] WHERE id = $1 RETURNING *', [row.id, OWNER_ROLES])
  return rows[0] || row
}

// What the browser is allowed to know about an account.
const publicUser = (row) => ({ id: row.id, email: row.email, settings: row.settings || {}, createdAt: row.created_at, emailVerified: Boolean(row.email_verified_at), roles: normalizeRoles(row.roles) })
const VERIFY_HOURS = 24
const RESEND_COOLDOWN_SECONDS = 60

// --- sessions -----------------------------------------------------------------------------------------------------

export async function createSession(userId) {
  const token = newToken()
  await pool.query(`INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`, [sha256(token), userId, SESSION_DAYS])
  // Tidy up while we are here, so the table does not collect dead rows.
  pool.query('DELETE FROM user_sessions WHERE expires_at < now()').catch(() => {})
  return token
}

export async function getUserBySession(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null
  const { rows } = await pool.query(
    `SELECT u.* FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  )
  return rows[0] ? publicUser(await ensureOwnerRoles(rows[0])) : null
}

export async function deleteSession(token) {
  if (typeof token !== 'string') return
  await pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [sha256(token)])
}

// --- sign up and log in -------------------------------------------------------------------------------------------

/**
 * Creates an account that cannot be used until the email is confirmed (see createVerification). An address that was
 * signed up before but never confirmed is simply taken over by the new sign-up, so nobody can lock the real owner of an
 * address out by registering it first. Returns the account row's public shape, never a session.
 */
export async function signUp(rawEmail, password, confirm, settings = {}) {
  const email = normalizeEmail(rawEmail)
  if (!email) throw new AuthError('That does not look like an email address.')
  const problem = passwordProblem(password)
  if (problem) throw new AuthError(problem)
  if (password !== confirm) throw new AuthError('The two passwords do not match.')
  const hash = await hashPassword(password)
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, settings) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (lower(email)) DO UPDATE SET password_hash = EXCLUDED.password_hash, settings = EXCLUDED.settings
       WHERE users.email_verified_at IS NULL
     RETURNING *`,
    [email, hash, JSON.stringify(sanitizeSettings(settings))],
  )
  if (!rows[0]) throw new AuthError('There is already an account with that email. Try logging in instead.', 409)
  return publicUser(rows[0])
}

// --- email confirmation -------------------------------------------------------------------------------------------

/** A fresh confirmation token for an account (older ones stop working). Returns the token to put in the email link. */
export async function createVerification(userId, newsletter = false) {
  const token = newToken()
  await pool.query('DELETE FROM email_verifications WHERE user_id = $1', [userId])
  await pool.query(
    `INSERT INTO email_verifications (token_hash, user_id, newsletter, expires_at) VALUES ($1, $2, $3, now() + make_interval(hours => $4))`,
    [sha256(token), userId, Boolean(newsletter), VERIFY_HOURS],
  )
  return token
}

/**
 * Another confirmation email for an account that has not confirmed yet. Returns { email, token }, or null when there is
 * nothing to send (unknown address, already confirmed, or one was sent under a minute ago). The route answers the same
 * way every time, so it cannot be used to find out which addresses have accounts.
 */
export async function resendVerification(rawEmail) {
  const email = normalizeEmail(rawEmail)
  if (!email) return null
  const { rows } = await pool.query('SELECT id, email, email_verified_at FROM users WHERE lower(email) = $1', [email])
  const user = rows[0]
  if (!user || user.email_verified_at) return null
  const { rows: last } = await pool.query(
    `SELECT newsletter, created_at > now() - make_interval(secs => $2) AS recent FROM email_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [user.id, RESEND_COOLDOWN_SECONDS],
  )
  if (last[0]?.recent) return null
  return { email: user.email, token: await createVerification(user.id, last[0]?.newsletter) }
}

/** Uses a confirmation link: marks the email as confirmed. Returns { user, newsletter }. */
export async function verifyEmail(token) {
  const invalid = () => new AuthError('That confirmation link is not valid or has expired. Log in to get a new one.', 400, 'invalid_link')
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) throw invalid()
  const { rows } = await pool.query(
    'DELETE FROM email_verifications WHERE token_hash = $1 AND expires_at > now() RETURNING user_id, newsletter',
    [sha256(token)],
  )
  if (!rows[0]) throw invalid()
  const { rows: users } = await pool.query(
    'UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), last_login_at = now() WHERE id = $1 RETURNING *',
    [rows[0].user_id],
  )
  return { user: publicUser(await ensureOwnerRoles(users[0])), newsletter: rows[0].newsletter }
}

export async function logIn(rawEmail, password) {
  const email = normalizeEmail(rawEmail)
  const { rows } = email ? await pool.query('SELECT * FROM users WHERE lower(email) = $1', [email]) : { rows: [] }
  const row = rows[0]
  // Always do the hashing work, so a wrong email and a wrong password look and feel the same.
  const ok = await verifyPassword(typeof password === 'string' ? password : '', row ? row.password_hash : DUMMY_HASH)
  if (!row || !ok) throw new AuthError('Wrong email or password.', 401)
  // Only said after the right password, so it does not reveal which addresses have accounts.
  if (!row.email_verified_at) throw new AuthError('Please confirm your email address first. We sent you a link when you signed up.', 403, 'email_not_verified')
  await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [row.id])
  return publicUser(await ensureOwnerRoles(row))
}

// --- settings -----------------------------------------------------------------------------------------------------

/** Merges the valid parts of `input` into the saved settings and returns the result. */
export async function saveSettings(userId, input) {
  const patch = sanitizeSettings(input)
  const { rows } = await pool.query(`UPDATE users SET settings = settings || $2::jsonb WHERE id = $1 RETURNING settings`, [userId, JSON.stringify(patch)])
  return rows[0]?.settings || {}
}

// --- browser data ---------------------------------------------------------------------------------------------------

export async function getUserData(userId) {
  const { rows } = await pool.query('SELECT data FROM users WHERE id = $1', [userId])
  return rows[0]?.data || {}
}

/** Replaces only the keys that are sent (after cleaning them), and returns everything now saved. */
export async function saveUserData(userId, input) {
  const patch = sanitizeUserData(input)
  if (!Object.keys(patch).length) return getUserData(userId)
  const { rows } = await pool.query(`UPDATE users SET data = data || $2::jsonb WHERE id = $1 RETURNING data`, [userId, JSON.stringify(patch)])
  return rows[0]?.data || {}
}

// --- passwords ----------------------------------------------------------------------------------------------------

/** Starts a reset. Returns { email, token } for a known address and null otherwise; the route answers the same either way. */
export async function startPasswordReset(rawEmail) {
  const email = normalizeEmail(rawEmail)
  if (!email) return null
  const { rows } = await pool.query('SELECT id, email FROM users WHERE lower(email) = $1', [email])
  if (!rows[0]) return null
  const token = newToken()
  await pool.query(`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`, [sha256(token), rows[0].id, RESET_MINUTES])
  return { email: rows[0].email, token }
}

/** Uses a reset link: sets the new password, ends every session and returns the account. */
export async function finishPasswordReset(token, password) {
  const problem = passwordProblem(password)
  if (problem) throw new AuthError(problem)
  if (typeof token !== 'string' || token.length > 100) throw new AuthError('That reset link is not valid or has expired.', 400)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `UPDATE password_resets SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id`,
      [sha256(token)],
    )
    if (!rows[0]) {
      await client.query('ROLLBACK')
      throw new AuthError('That reset link is not valid or has expired.', 400)
    }
    const userId = rows[0].user_id
    const hash = await hashPassword(password)
    const { rows: users } = await client.query('UPDATE users SET password_hash = $2, last_login_at = now(), email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1 RETURNING *', [userId, hash])
    await client.query('DELETE FROM user_sessions WHERE user_id = $1', [userId])
    await client.query('COMMIT')
    return publicUser(await ensureOwnerRoles(users[0]))
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

async function checkPassword(userId, password) {
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId])
  if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) throw new AuthError('That password is not right.', 403)
}

/** Changes the password for a signed-in user and signs out every other device. */
export async function changePassword(userId, current, next, keepToken) {
  await checkPassword(userId, current)
  const problem = passwordProblem(next)
  if (problem) throw new AuthError(problem)
  const hash = await hashPassword(next)
  await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, hash])
  await pool.query('DELETE FROM user_sessions WHERE user_id = $1 AND token_hash <> $2', [userId, sha256(keepToken || '')])
}

/** Deletes the account and everything tied to it (sessions and reset links go with it). */
export async function deleteAccount(userId, password) {
  await checkPassword(userId, password)
  await pool.query('DELETE FROM users WHERE id = $1', [userId])
}

export async function countUsers() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM users')
  return rows[0].n
}
