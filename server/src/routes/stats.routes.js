import { Router } from 'express'
import { rateLimit } from '../utils/rateLimit.js'
import { cleanShare, cleanVisit } from '../utils/shareStats.js'
import { recordShare, recordVisit, shareOverview } from '../services/stats.service.js'
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
