import { Router } from 'express'
import { rateLimit } from '../utils/rateLimit.js'
import { cleanShare, cleanVisit } from '../utils/shareStats.js'
import { dailyPlayers, dailyXp, recentPlayers, recordShare, recordVisit, shareOverview } from '../services/stats.service.js'
import { cleanEvents } from '../utils/events.js'
import { eventDetail, eventsOverview, recordEvents } from '../services/events.service.js'
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
    const { events, anon } = cleanEvents(req.body)
    if (events.length && !(req.user && hasRole(req.user.roles, 'admin', 'owner'))) {
      await recordEvents(events, anon || !req.user ? null : req.user.id)
    }
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// For the site owner: which events happen and how often, and the detail of one.
const adminOnly = [attachUser, requireRole('admin', 'owner'), rateLimit({ windowMs: 60_000, max: 60 })]
const askedDays = (req) => (DAY_CHOICES.includes(Number(req.query.days)) ? Number(req.query.days) : 30)
statsRouter.get('/admin/stats/events', ...adminOnly, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await eventsOverview(askedDays(req)))
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

// For the site owner: the players added most recently (opened from the player count on Discover).
statsRouter.get('/admin/stats/recent-players', ...adminOnly, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await recentPlayers(req.query.limit))
  } catch (err) {
    next(err)
  }
})

// For the site owner: XP gained across the whole site on each recent day (the chart in the XP total on Discover).
statsRouter.get('/admin/stats/daily-xp', ...adminOnly, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await dailyXp(req.query.days))
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
