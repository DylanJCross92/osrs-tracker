import { Router } from 'express'
import { rateLimit } from '../utils/rateLimit.js'
import { cleanShare, cleanVisit } from '../utils/shareStats.js'
import { dailyPlayers, dailyXp, plansByPlayer, recentPlayers, recordShare, recordVisit, saveVisitorPlans, shareOverview } from '../services/stats.service.js'
import { askedNotToTrack, cleanEvents, cleanVisitorId, isCrawler } from '../utils/events.js'
import { activeAccounts, dailyActive, deleteVisitor, eventDetail, eventsOverview, journeyOf, recordEvents, visitors } from '../services/events.service.js'
import { siteOverview } from '../services/siteOverview.service.js'
import { activePeople } from '../services/activePeople.service.js'
import { accountsOverview } from '../services/accounts.service.js'
import { funnelsOverview } from '../services/funnels.service.js'
import { SEGMENTS } from '../utils/funnels.js'
import { AuthError, adminDeleteAccount } from '../services/auth.service.js'
import { sendClaimNudgeToUser } from '../services/claimNudge.service.js'
import { announcementStatus, sendAnnouncementTest, startAnnouncement } from '../services/announcements.service.js'
import { hasRole } from '../utils/roles.js'
import { attachUser, requireRole } from './auth.routes.js'

export const statsRouter = Router()

// Anonymous counters: plenty of room for a real person, none for a script filling the table.
const countLimiter = rateLimit({ windowMs: 3_600_000, max: 150, message: 'Too many requests.' })

// Someone shared a link or an image (a click on copy, download, X, Reddit or the share sheet).
statsRouter.post('/stats/share', countLimiter, async (req, res, next) => {
  try {
    const share = cleanShare(req.body)
    if (!share) return res.status(400).json({ error: 'Unknown share.' })
    await recordShare(share)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// Someone arrived through a shared link (or, with kind 'site', opened the site for the first time that day).
statsRouter.post('/stats/visit', countLimiter, async (req, res, next) => {
  try {
    if (isCrawler(req.headers['user-agent'])) return res.status(204).end()
    const visit = cleanVisit(req.body)
    if (!visit) return res.status(400).json({ error: 'Unknown visit.' })
    await recordVisit(visit)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// For the site owner: how much is shared, and how many people come back through it.
const DAY_CHOICES = [7, 30, 90]
statsRouter.get('/admin/stats/shares', attachUser, requireRole('admin', 'owner'), rateLimit({ windowMs: 60_000, max: 60 }), async (req, res, next) => {
  try {
    const asked = Number(req.query.days)
    res.set('Cache-Control', 'no-store')
    res.json(await shareOverview(DAY_CHOICES.includes(asked) ? asked : 30))
  } catch (err) {
    next(err)
  }
})

// Product events from the site's own track() calls (batched by the browser). The account comes from the signed-in session on
// the server, never from the request body; admins and owners are not counted, and a browser that sent Do Not Track is
// counted without an account.
const eventsLimiter = rateLimit({ windowMs: 60_000, max: 40, message: 'Too many events.' })
statsRouter.post('/stats/events', eventsLimiter, attachUser, async (req, res, next) => {
  try {
    // Crawlers get the normal answer and nothing is recorded (see isCrawler).
    if (isCrawler(req.headers['user-agent'])) return res.status(204).end()
    const { events, anon, vid } = cleanEvents(req.body)
    if (events.length && !(req.user && hasRole(req.user.roles, 'admin', 'owner'))) {
      await recordEvents(events, anon || !req.user ? null : req.user.id, vid)
    }
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// The plans saved in a signed-out visitor's browser, under their random visitor id (see visitorPlans.js in the app). Nothing is kept
// for a browser that asks not to be tracked, or for a request that carries a sign-in (those plans sync to the account).
const plansLimiter = rateLimit({ windowMs: 60_000, max: 12, message: 'Too many requests.' })
statsRouter.post('/stats/visitor-plans', plansLimiter, attachUser, async (req, res, next) => {
  try {
    const vid = cleanVisitorId(req.body?.vid)
    if (!vid || req.user || askedNotToTrack(req.headers) || isCrawler(req.headers['user-agent'])) return res.status(204).end()
    const ok = await saveVisitorPlans(vid, req.body?.plans, req.body?.planner)
    res.status(ok ? 204 : 413).end()
  } catch (err) {
    next(err)
  }
})

// For the site owner: which events happen and how often, and the detail of one.
const adminOnly = [attachUser, requireRole('admin', 'owner'), rateLimit({ windowMs: 60_000, max: 60 })]
const askedDays = (req) => (DAY_CHOICES.includes(Number(req.query.days)) ? Number(req.query.days) : 30)
// For the site owner: how much of everything exists and how fast it grows, and the latest things people did.
statsRouter.get('/admin/stats/overview', ...adminOnly, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await siteOverview(askedDays(req)))
  } catch (err) {
    next(err)
  }
})
// For the site owner: how many different people were active in the last hour, 24 hours and 7 days, and who they were.
statsRouter.get('/admin/stats/active', ...adminOnly, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await activePeople())
  } catch (err) {
    next(err)
  }
})
statsRouter.get('/admin/stats/events', ...adminOnly, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await eventsOverview(askedDays(req)))
  } catch (err) {
    next(err)
  }
})
// For the site owner: the people (accounts and browsers) active lately, and one person's steps in order.
statsRouter.get('/admin/stats/visitors', ...adminOnly, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await visitors(askedDays(req)))
  } catch (err) {
    next(err)
  }
})
// For the site owner: the conversion funnels, the paths people take and what they show. `days` is 7, 30, 90 or "all" (everyone ever
// recorded, the default); `segment` is one of the groups of people in utils/funnels.js.
statsRouter.get('/admin/stats/funnels', ...adminOnly, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    const days = DAY_CHOICES.includes(Number(req.query.days)) ? Number(req.query.days) : null
    const segment = SEGMENTS.some((s) => s.key === req.query.segment) ? req.query.segment : 'all'
    res.json(await funnelsOverview({ days, segment }))
  } catch (err) {
    next(err)
  }
})
// For the site owner: every account that has signed up, with verification, claimed players, last seen and how active it is.
statsRouter.get('/admin/stats/accounts', ...adminOnly, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await accountsOverview(askedDays(req)))
  } catch (err) {
    next(err)
  }
})
// For the site owner: email one account the "claim your player" reminder (from the row menu on User Management).
const sendLimiter = rateLimit({ windowMs: 60_000, max: 20, message: 'Too many emails. Wait a minute.' })
statsRouter.post('/admin/users/:id/claim-email', ...adminOnly, sendLimiter, async (req, res, next) => {
  try {
    res.json(await sendClaimNudgeToUser(req.params.id))
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

// For the site owner only: the one-off announcement email. Preview and numbers, a test to your own address, and the send to everyone.
const ownerOnly = [attachUser, requireRole('owner'), rateLimit({ windowMs: 60_000, max: 30 })]
const announceSendLimiter = rateLimit({ windowMs: 60_000, max: 6, message: 'Too many tries. Wait a minute.' })
statsRouter.get('/admin/announcements/:key', ...ownerOnly, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await announcementStatus(req.params.key))
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})
statsRouter.post('/admin/announcements/:key/test', ...ownerOnly, announceSendLimiter, async (req, res, next) => {
  try {
    res.json(await sendAnnouncementTest(req.params.key, req.user.email))
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})
statsRouter.post('/admin/announcements/:key/send', ...ownerOnly, announceSendLimiter, async (req, res, next) => {
  try {
    res.json(await startAnnouncement(req.params.key))
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

// For the site owner: delete someone else's account (never a team account, never your own). The page asks first.
statsRouter.post('/admin/users/:id/delete', ...adminOnly, async (req, res, next) => {
  try {
    const email = await adminDeleteAccount(req.params.id, req.user.id)
    if (!email) return res.status(404).json({ error: 'No such account.' })
    res.json({ ok: true, email })
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})
statsRouter.get('/admin/stats/visitors/:key', ...adminOnly, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    const out = await journeyOf(req.params.key, askedDays(req))
    if (!out) return res.status(404).end()
    res.json(out)
  } catch (err) {
    next(err)
  }
})
statsRouter.get('/admin/stats/events/:name', ...adminOnly, async (req, res, next) => {
  try {
    const name = String(req.params.name || '')
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(name)) return res.status(404).end()
    res.set('Cache-Control', 'no-store')
    res.json(await eventDetail(name, askedDays(req)))
  } catch (err) {
    next(err)
  }
})

// For the site owner: remove one browser visitor's records (their steps, and the plans copied from their browser). Not for accounts.
statsRouter.post('/admin/stats/visitors/:key/delete', attachUser, requireRole('admin', 'owner'), rateLimit({ windowMs: 60_000, max: 120 }), async (req, res, next) => {
  try {
    const out = await deleteVisitor(req.params.key)
    if (!out) return res.status(404).json({ error: 'That visitor cannot be deleted here. Accounts are deleted from the accounts list.' })
    res.json(out)
  } catch (err) {
    next(err)
  }
})

// For the site owner: the players added most recently (opened from the player count on Discover).
statsRouter.get('/admin/stats/recent-players', ...adminOnly, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await recentPlayers(req.query.limit))
  } catch (err) {
    next(err)
  }
})

// XP gained across the whole site on each recent day (the chart in the XP total on Discover). Public: it is a site-wide total with nothing
// about any one person. The query reads a lot of snapshots, so each answer is kept for five minutes and the endpoint is limited.
const DAILY_XP_TTL_MS = 300_000
const dailyXpCache = new Map()
statsRouter.get('/stats/daily-xp', rateLimit({ windowMs: 60_000, max: 30 }), async (req, res, next) => {
  try {
    const n = Math.min(Math.max(Math.floor(Number(req.query.days)) || 30, 7), 60)
    const hit = dailyXpCache.get(n)
    if (!hit || Date.now() - hit.at > DAILY_XP_TTL_MS) dailyXpCache.set(n, { at: Date.now(), body: await dailyXp(n) })
    res.set('Cache-Control', 'public, max-age=300')
    res.json(dailyXpCache.get(n).body)
  } catch (err) {
    next(err)
  }
})

// For the site owner: how many players were being tracked at the end of each recent day (the chart above the recent players).
statsRouter.get('/admin/stats/daily-players', ...adminOnly, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await dailyPlayers(req.query.days))
  } catch (err) {
    next(err)
  }
})

// For the site owner: how many different accounts were active on each recent day (signed in or came back), for the admin stats page.
statsRouter.get('/admin/stats/daily-active', ...adminOnly, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await dailyActive(req.query.days))
  } catch (err) {
    next(err)
  }
})

// For the site owner: which accounts were active on one day (hovering a bar in the Active accounts chart).
statsRouter.get('/admin/stats/daily-active/:day', ...adminOnly, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    const out = await activeAccounts(req.params.day)
    if (!out) return res.status(400).json({ error: 'Use a day like 2026-11-17.' })
    res.json(out)
  } catch (err) {
    next(err)
  }
})

// For the site owner: the plans players have set up, by player name (the Player plans page).
statsRouter.get('/admin/plans', ...adminOnly, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await plansByPlayer())
  } catch (err) {
    next(err)
  }
})
