// Sends one plain-text email through Resend's HTTP API. Off unless RESEND_API_KEY is set. Never throws: callers get
// true when Resend accepted the message and false otherwise.
const API_URL = 'https://api.resend.com/emails'
// Resend's shared sender only delivers to your own address; set NOTIFY_FROM once a domain is verified to reach everyone.
export const DEFAULT_FROM = 'TickGains <onboarding@resend.dev>'

export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY)

export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured()) return false
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.NOTIFY_FROM || DEFAULT_FROM, to: [to], subject, text, ...(html ? { html } : {}) }),
    })
    if (!res.ok) {
      console.error(`Email to a user failed: Resend answered ${res.status}`)
      return false
    }
    return true
  } catch (err) {
    console.error('Email failed:', err.message)
    return false
  }
}
