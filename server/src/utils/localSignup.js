/**
 * True for a sign-up made on a developer's own machine (the dev server, reached as localhost), where no email can be sent: the account is confirmed and
 * signed in straight away. Never in production, and never from any other address. REQUIRE_EMAIL_CONFIRMATION=1 turns it off, to try the real flow locally.
 */
const isLocal = (value) => {
  try {
    return /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i.test(new URL(/^https?:\/\//.test(value) ? value : `http://${value}`).hostname)
  } catch {
    return false
  }
}

export function skipsEmailConfirmation(req, env = process.env) {
  if (env.NODE_ENV === 'production' || env.REQUIRE_EMAIL_CONFIRMATION === '1') return false
  const origin = req.headers?.origin
  return isLocal(req.hostname || '') && (!origin || isLocal(origin))
}
