// Emails the site owner when someone joins the news list, through Resend's HTTP API (no extra package needed).
// Off unless both RESEND_API_KEY and NOTIFY_EMAIL are set on the server, so local development and any deploy without
// them behave exactly as before. A failure here is logged and never affects the visitor's signup.
import { renderEmail } from '../utils/emailTemplate.js'

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
  const message = renderEmail({
    preheader: `${email} joined the email list.`,
    title: 'New email list signup',
    paragraphs: [{ text: `${email} joined the TickGains email list.`, strong: email }],
    rows: [{ label: 'Address', value: email }, ...(source ? [{ label: 'Signed up from', value: source }] : []), ...(total != null ? [{ label: 'Subscribers now', value: total }] : [])],
  })
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || DEFAULT_FROM,
        to: [process.env.NOTIFY_EMAIL],
        subject: 'New TickGains email signup',
        ...message,
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
  const message = renderEmail({
    preheader: confirmed ? `${email} confirmed their email.` : `${email} signed up.`,
    title: confirmed ? 'Account confirmed' : 'New signup',
    paragraphs: [
      confirmed
        ? { text: `${email} confirmed their email. Their TickGains account is ready.`, strong: email }
        : { text: `${email} signed up for a TickGains account. They still need to confirm their email.`, strong: email },
    ],
    rows: [{ label: 'Email', value: email }, { label: 'Status', value: confirmed ? 'Confirmed' : 'Waiting for confirmation' }, ...(total != null ? [{ label: 'Accounts now', value: total }] : [])],
  })
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || DEFAULT_FROM,
        to: [process.env.NOTIFY_EMAIL],
        subject: confirmed ? 'TickGains account confirmed' : 'New TickGains signup',
        ...message,
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

/** Tell the owner that someone started claiming a profile, so they know to expect the in-game message. Never throws. */
export async function notifyClaimStarted({ email, playerName }) {
  if (!notifyConfigured()) return false
  if (!underHourlyCap()) return false
  const message = renderEmail({
    preheader: `${email} is claiming ${playerName}.`,
    title: 'Profile claim started',
    paragraphs: [
      { text: `${email} started claiming ${playerName}. They were told to send you a code in game. When it arrives, enter it on the claims page to verify them.`, strong: playerName },
    ],
    rows: [{ label: 'Profile', value: playerName }, { label: 'Account', value: email }],
    button: { label: 'Open the claims page', url: `${process.env.SITE_URL || 'https://tickgains.com'}/admin/claims` },
  })
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.NOTIFY_FROM || DEFAULT_FROM, to: [process.env.NOTIFY_EMAIL], subject: `Profile claim started: ${playerName}`, ...message }),
    })
    if (!res.ok) {
      console.error(`Claim notification failed: Resend answered ${res.status}`)
      return false
    }
    return true
  } catch (err) {
    console.error('Claim notification failed:', err.message)
    return false
  }
}

// For tests.
export function _resetNotifyCap() {
  sent.length = 0
}
