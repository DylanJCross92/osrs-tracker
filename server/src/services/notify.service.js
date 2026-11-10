// Emails the site owner when someone joins the news list, through Resend's HTTP API (no extra package needed).
// Off unless both RESEND_API_KEY and NOTIFY_EMAIL are set on the server, so local development and any deploy without
// them behave exactly as before. A failure here is logged and never affects the visitor's signup.
const API_URL = 'https://api.resend.com/emails'
// Resend's shared sender works for an account's own address with no domain set up; set NOTIFY_FROM once a domain is verified.
const DEFAULT_FROM = 'TickGains <onboarding@resend.dev>'

// A flood of bot signups must not become a flood of emails: at most this many notifications per hour.
const MAX_PER_HOUR = 20
const sent = []

function underHourlyCap(now = Date.now()) {
  while (sent.length && sent[0] < now - 3_600_000) sent.shift()
  if (sent.length >= MAX_PER_HOUR) return false
  sent.push(now)
  return true
}

export function notifyConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL)
}

/** Tell the owner about a new signup. Resolves true if an email was handed to Resend, false otherwise; never throws. */
export async function notifyNewSubscriber({ email, source = '', total = null }) {
  if (!notifyConfigured()) return false
  if (!underHourlyCap()) return false
  const lines = [`${email} joined the TickGains email list.`, source ? `Signed up from: ${source}` : null, total != null ? `Subscribers now: ${total}` : null].filter(Boolean)
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || DEFAULT_FROM,
        to: [process.env.NOTIFY_EMAIL],
        subject: 'New TickGains email signup',
        text: lines.join('\n'),
      }),
    })
    if (!res.ok) {
      console.error(`Signup notification failed: Resend answered ${res.status}`)
      return false
    }
    return true
  } catch (err) {
    console.error('Signup notification failed:', err.message)
    return false
  }
}

/**
 * Tell the owner about an account: once when someone signs up (confirmed: false, they still have to click the link in
 * their email) and once more when they confirm it. Same rules as notifyNewSubscriber: never throws, capped per hour.
 */
export async function notifyNewAccount({ email, total = null, confirmed = false }) {
  if (!notifyConfigured()) return false
  if (!underHourlyCap()) return false
  const lines = [
    confirmed ? `${email} confirmed their email. Their TickGains account is ready.` : `${email} signed up for a TickGains account. They still need to confirm their email.`,
    total != null ? `Accounts now: ${total}` : null,
  ].filter(Boolean)
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || DEFAULT_FROM,
        to: [process.env.NOTIFY_EMAIL],
        subject: confirmed ? 'TickGains account confirmed' : 'New TickGains signup',
        text: lines.join('\n'),
      }),
    })
    if (!res.ok) {
      console.error(`Account notification failed: Resend answered ${res.status}`)
      return false
    }
    return true
  } catch (err) {
    console.error('Account notification failed:', err.message)
    return false
  }
}

// For tests.
export function _resetNotifyCap() {
  sent.length = 0
}
