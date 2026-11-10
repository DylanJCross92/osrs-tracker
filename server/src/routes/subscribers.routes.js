import crypto from 'node:crypto'
import { Router } from 'express'
import { normalizeEmail, cleanSource } from '../utils/email.js'
import { subscribe, unsubscribeByToken, listActiveSubscribers } from '../services/subscribers.service.js'
import { rateLimit } from '../utils/rateLimit.js'

export const subscribersRouter = Router()

const signupLimiter = rateLimit({ windowMs: 3_600_000, max: 8, message: 'Too many sign-ups from here, please try again later.' })
const unsubLimiter = rateLimit({ windowMs: 60_000, max: 20 })

// Sign up for news and new-feature emails. No account, no confirmation email: just the address.
subscribersRouter.post('/subscribe', signupLimiter, async (req, res, next) => {
  try {
    const body = req.body || {}
    // A hidden field real visitors never see or fill in. Bots that fill every field get a normal-looking answer and
    // nothing is saved.
    if (typeof body.website === 'string' && body.website.trim() !== '') return res.json({ ok: true })
    const email = normalizeEmail(body.email)
    if (!email) return res.status(400).json({ error: 'That does not look like an email address.' })
    await subscribe(email, cleanSource(body.source))
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// The link at the bottom of every email lands on a page that calls this.
subscribersRouter.post('/unsubscribe', unsubLimiter, async (req, res, next) => {
  try {
    const found = await unsubscribeByToken(req.body?.token)
    if (!found) return res.status(404).json({ error: 'That unsubscribe link is not valid.' })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// The owner's export. Off unless ADMIN_TOKEN is set on the server; send it as the x-admin-token header.
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
subscribersRouter.get('/subscribers.csv', rateLimit({ windowMs: 60_000, max: 10 }), async (req, res, next) => {
  try {
    const token = process.env.ADMIN_TOKEN
    if (!token || !safeEqual(req.get('x-admin-token') || '', token)) return res.status(404).end()
    const rows = await listActiveSubscribers()
    const site = process.env.SITE_URL || 'https://tickgains.com'
    const lines = ['email,source,signed_up,unsubscribe_link', ...rows.map((r) => [r.email, r.source, new Date(r.created_at).toISOString(), `${site}/unsubscribe?t=${r.unsub_token}`].map(csvCell).join(','))]
    res.set('Content-Type', 'text/csv; charset=utf-8')
    res.set('Cache-Control', 'no-store')
    res.send(`${lines.join('\n')}\n`)
  } catch (err) {
    next(err)
  }
})
