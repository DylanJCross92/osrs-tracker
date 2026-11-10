import crypto from 'node:crypto'

// Passwords are stored as a salted scrypt hash (built into Node, so no extra package): "scrypt$salt$hash".
const KEY_LEN = 64
const MIN_LENGTH = 8
const MAX_LENGTH = 128

const scrypt = (password, salt) =>
  new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LEN, (err, key) => (err ? reject(err) : resolve(key)))
  })

/** Returns a message when the password is not acceptable, or null when it is fine. */
export function passwordProblem(password) {
  if (typeof password !== 'string') return 'Enter a password.'
  if (password.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters.`
  if (password.length > MAX_LENGTH) return `Use at most ${MAX_LENGTH} characters.`
  return null
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(password, salt)
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false
  const [scheme, saltHex, keyHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false
  const expected = Buffer.from(keyHex, 'hex')
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'))
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

// Checked against when an email is unknown, so a wrong email and a wrong password take the same time.
export const DUMMY_HASH = `scrypt$${'00'.repeat(16)}$${'00'.repeat(KEY_LEN)}`
