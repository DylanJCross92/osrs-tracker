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
 * Tell the owner when someone signs up. Once per account: not again when they confirm their email. Same rules as
 * notifyNewSubscriber: never throws, capped per hour.
 */
export async function notifyNewAccount({ email, total = null }) {
  if (!notifyConfigured()) return false
  if (!underHourlyCap()) return false
  const message = renderEmail({
    preheader: `${email} signed up.`,
    title: 'New signup',
    paragraphs: [{ text: `${email} signed up for a TickGains account. They still need to confirm their email.`, strong: email }],
    rows: [{ label: 'Email', value: email }, { label: 'Status', value: 'Waiting for confirmation' }, ...(total != null ? [{ label: 'Accounts now', value: total }] : [])],
  })
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || DEFAULT_FROM,
        to: [process.env.NOTIFY_EMAIL],
        subject: 'New TickGains signup',
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

// Feedback has its own hourly cap so a quiet day of signups never hides a message (and a flood still cannot fill the inbox).
const MAX_FEEDBACK_PER_HOUR = 30
const feedbackSent = []

/**
 * Email the owner a piece of feedback. Replying to the email goes straight to the sender when they left an address.
 * Resolves true if Resend took it, false otherwise; never throws. The message is already saved before this is called.
 */
/** The Smart Planner's answers and plan, as a few readable rows for the owner's email (nothing when there is none). */
export function planRows(context) {
  if (!context?.profile) return []
  const p = context.profile
  const answers = [p.members ? 'Members' : 'Free-to-play', p.iron ? 'Ironman' : 'Main', p.goal, `${p.hours} h a day`, `gp ${p.gp}`, p.experience].filter(Boolean).join(', ')
  const goals = (context.goals || []).slice(0, 14).map((g) => `${g.skill} ${g.from}-${g.to}`).join(', ')
  return [
    { label: 'Answers', value: answers },
    ...(goals ? [{ label: 'Plan', value: goals + ((context.goals || []).length > 14 ? ` and ${(context.goals || []).length - 14} more` : '') }] : []),
    ...(context.skipped?.length ? [{ label: 'Left out', value: context.skipped.map((s) => s.title).join(', ') }] : []),
    ...(context.assumed?.combat ? [{ label: 'Combat level', value: String(context.assumed.combat) }] : []),
  ]
}

export async function notifyFeedback({ id, kind, kindLabel, message, email = null, page = '', viewport = '', signedIn = false, context = null }) {
  if (!notifyConfigured()) return false
  const now = Date.now()
  while (feedbackSent.length && feedbackSent[0] < now - 3_600_000) feedbackSent.shift()
  if (feedbackSent.length >= MAX_FEEDBACK_PER_HOUR) return false
  feedbackSent.push(now)

  const preview = message.replace(/\s+/g, ' ').slice(0, 90)
  const rows = [
    { label: 'Type', value: kindLabel },
    { label: 'From', value: email || 'No reply address given' },
    ...(page ? [{ label: 'Page', value: page }] : []),
    ...(viewport ? [{ label: 'Screen', value: viewport }] : []),
    { label: 'Signed in', value: signedIn ? 'Yes' : 'No' },
    ...planRows(context),
  ]
  const mail = renderEmail({
    preheader: preview,
    title: `New ${kindLabel.toLowerCase()} feedback`,
    // One paragraph per line, so the message keeps its shape in the email.
    paragraphs: message.split(/\n+/).filter(Boolean),
    rows,
    note: email ? 'Reply to this email to answer them.' : 'They did not leave an address, so there is no one to reply to.',
  })
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || DEFAULT_FROM,
        to: [process.env.NOTIFY_EMAIL],
        ...(email ? { reply_to: [email] } : {}),
        subject: `TickGains feedback (${kindLabel}): ${preview.slice(0, 60)}`,
        ...mail,
      }),
    })
    if (!res.ok) {
      console.error(`Feedback #${id} notification failed: Resend answered ${res.status}`)
      return false
    }
    return true
  } catch (err) {
    console.error(`Feedback #${id} notification failed:`, err.message)
    return false
  }
}

// For tests.
export function _resetNotifyCap() {
  sent.length = 0
  feedbackSent.length = 0
}
