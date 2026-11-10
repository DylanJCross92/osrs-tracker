import { Router } from 'express'
import { rateLimit } from '../utils/rateLimit.js'
import { sendMail, mailConfigured } from '../utils/mailer.js'
import { renderEmail } from '../utils/emailTemplate.js'
import { hasRole } from '../utils/roles.js'
import { subscribe } from '../services/subscribers.service.js'
import { notifyNewAccount } from '../services/notify.service.js'
import {
  AuthError,
  SESSION_DAYS,
  changePassword,
  countUsers,
  createSession,
  createVerification,
  deleteAccount,
  deleteSession,
  finishPasswordReset,
  getUserBySession,
  logIn,
  resendVerification,
  saveSettings,
  signUp,
  startPasswordReset,
  verifyEmail,
} from '../services/auth.service.js'

export const authRouter = Router()

const COOKIE = 'tg_session'
const isProd = process.env.NODE_ENV === 'production'

// Reads one cookie without a cookie-parsing package.
function readCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return ''
}

function setSession(res, token) {
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/', maxAge: SESSION_DAYS * 86_400_000 })
}
const clearSession = (res) => res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/' })

// Puts the signed-in account (if any) on req.user. Never an error: no cookie just means a visitor.
export async function attachUser(req, res, next) {
  try {
    req.sessionToken = readCookie(req, COOKIE)
    req.user = req.sessionToken ? await getUserBySession(req.sessionToken) : null
    next()
  } catch (err) {
    next(err)
  }
}
const requireUser = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Please log in first.' }))
// For admin-only endpoints: use after attachUser. Answers 404 to everyone else so the endpoint is not advertised.
export const requireRole = (...roles) => (req, res, next) => (req.user && hasRole(req.user.roles, ...roles) ? next() : res.status(404).end())

const signupLimiter = rateLimit({ windowMs: 3_600_000, max: 10, message: 'Too many sign-ups from here, please try again later.' })
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, message: 'Too many log-in attempts, please wait a few minutes.' })
const forgotLimiter = rateLimit({ windowMs: 3_600_000, max: 5, message: 'Too many reset requests, please try again later.' })
const sensitiveLimiter = rateLimit({ windowMs: 3_600_000, max: 15, message: 'Too many attempts, please try again later.' })

// Wraps a handler so thrown AuthErrors become a plain JSON message and everything else goes to the error handler.
const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res)
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) })
    next(err)
  }
}

authRouter.use(attachUser)
// Account responses are personal, never cached.
authRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// Who is signed in. A visitor gets { user: null } rather than an error.
authRouter.get('/me', (req, res) => res.json({ user: req.user }))

// Where links in emails point: the live site in production, the Vite dev server locally.
const siteBase = () => (isProd ? process.env.SITE_URL || 'https://tickgains.com' : process.env.CLIENT_ORIGIN || 'http://localhost:5173')

// Sends the confirmation link. With no mail set up, local development prints it to the console instead.
async function sendVerification({ email, token }) {
  const link = `${siteBase()}/verify-email?t=${encodeURIComponent(token)}`
  if (mailConfigured()) {
    return sendMail({
      to: email,
      subject: 'Confirm your TickGains email',
      ...renderEmail({
        preheader: 'One click to finish creating your account.',
        title: 'Welcome to TickGains!',
        paragraphs: ['Confirm your email address to finish creating your account. The link works for 24 hours.'],
        button: { label: 'Confirm my email', url: link },
        note: 'If you did not sign up, you can ignore this email and nothing will happen.',
      }),
    })
  }
  if (!isProd) console.log(`[auth] Confirmation link for ${email}: ${link}`)
  return false
}

// Creating an account does not log you in: the email has to be confirmed first (see /verify and /login).
authRouter.post(
  '/signup',
  signupLimiter,
  handle(async (req, res) => {
    const body = req.body || {}
    // Hidden honeypot field, like the email list form. Bots get a normal-looking answer and nothing is created.
    if (typeof body.website === 'string' && body.website.trim() !== '') return res.status(201).json({ pending: true, email: String(body.email || ''), emailSent: true })
    const user = await signUp(body.email, body.password, body.confirmPassword, body.settings)
    const token = await createVerification(user.id, body.newsletter === true)
    // Tell the owner right away; the visitor is not kept waiting on it.
    countUsers()
      .then((total) => notifyNewAccount({ email: user.email, total, confirmed: false }))
      .catch(() => {})
    const emailSent = await sendVerification({ email: user.email, token })
    res.status(201).json({ pending: true, email: user.email, emailSent })
  }),
)

// The link in the confirmation email lands on a page that calls this. Success also signs the person in.
authRouter.post(
  '/verify',
  sensitiveLimiter,
  handle(async (req, res) => {
    const { user, newsletter } = await verifyEmail(req.body?.token)
    setSession(res, await createSession(user.id))
    if (newsletter) subscribe(user.email, 'signup').catch(() => {})
    countUsers()
      .then((total) => notifyNewAccount({ email: user.email, total, confirmed: true }))
      .catch(() => {})
    res.json({ user })
  }),
)

// Another confirmation email. Always answers the same way (see resendVerification).
authRouter.post(
  '/resend',
  forgotLimiter,
  handle(async (req, res) => {
    const pending = await resendVerification(req.body?.email)
    if (pending) sendVerification(pending).catch(() => {})
    res.json({ ok: true })
  }),
)

authRouter.post(
  '/login',
  loginLimiter,
  handle(async (req, res) => {
    const user = await logIn(req.body?.email, req.body?.password)
    setSession(res, await createSession(user.id))
    res.json({ user })
  }),
)

authRouter.post(
  '/logout',
  handle(async (req, res) => {
    if (req.sessionToken) await deleteSession(req.sessionToken)
    clearSession(res)
    res.json({ ok: true })
  }),
)

// Save preferences. Only known keys with valid values are kept (see utils/settings.js).
authRouter.put(
  '/settings',
  requireUser,
  handle(async (req, res) => {
    res.json({ settings: await saveSettings(req.user.id, req.body?.settings) })
  }),
)

// The link in a reset email. In local development (no mail set up) it is printed to the server console instead.
function resetLink(token) {
  return `${siteBase()}/reset-password?t=${encodeURIComponent(token)}`
}

// Always answers the same way, so it cannot be used to find out which emails have an account.
authRouter.post(
  '/forgot',
  forgotLimiter,
  handle(async (req, res) => {
    const reset = await startPasswordReset(req.body?.email)
    if (reset) {
      const link = resetLink(reset.token)
      if (mailConfigured()) {
        sendMail({
          to: reset.email,
          subject: 'Reset your TickGains password',
          ...renderEmail({
            preheader: 'Choose a new password. The link expires in an hour.',
            title: 'Reset your password',
            paragraphs: ['Someone asked to reset the password for your TickGains account. The link works once and expires in an hour.'],
            button: { label: 'Choose a new password', url: link },
            note: 'If this was not you, ignore this email and your password stays the same.',
          }),
        }).catch(() => {})
      } else if (!isProd) {
        console.log(`[auth] Password reset link for ${reset.email}: ${link}`)
      }
    }
    res.json({ ok: true })
  }),
)

authRouter.post(
  '/reset',
  sensitiveLimiter,
  handle(async (req, res) => {
    const user = await finishPasswordReset(req.body?.token, req.body?.password)
    setSession(res, await createSession(user.id))
    res.json({ user })
  }),
)

authRouter.post(
  '/password',
  requireUser,
  sensitiveLimiter,
  handle(async (req, res) => {
    await changePassword(req.user.id, req.body?.current, req.body?.next, req.sessionToken)
    res.json({ ok: true })
  }),
)

authRouter.post(
  '/delete',
  requireUser,
  sensitiveLimiter,
  handle(async (req, res) => {
    await deleteAccount(req.user.id, req.body?.password)
    clearSession(res)
    res.json({ ok: true })
  }),
)
