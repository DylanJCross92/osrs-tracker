// Email address checks for the news signup. Deliberately simple: one "@", something on both sides, a dot in the
// domain, no spaces. (Real validation is whether mail arrives; we do not send a confirmation email.)
const EMAIL_RE = /^[^\s@]+@[^\s@.][^\s@]*\.[^\s@.]{2,}$/

/** The cleaned address (trimmed, lower-cased), or null when it does not look like an email. */
export function normalizeEmail(value) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (email.length < 6 || email.length > 254) return null
  if (!EMAIL_RE.test(email)) return null
  const [local] = email.split('@')
  if (local.length > 64) return null
  return email
}

/** Only short, plain labels for where a signup came from ('footer', 'home'), so the column cannot be filled with junk. */
export function cleanSource(value) {
  return typeof value === 'string' && /^[a-z0-9_-]{1,24}$/.test(value) ? value : ''
}
