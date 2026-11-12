import { Router } from 'express'
import { rateLimit } from '../utils/rateLimit.js'
import { attachUser, requireUser } from './auth.routes.js'
import { SharePlanError } from '../utils/sharedPlans.js'
import { getPublicShare, listMyShares, recordShareEvent, shareMyPlan, stopSharing } from '../services/sharedPlans.service.js'
import { renderPlanCardPng } from '../services/cardImage.service.js'

export const plansRouter = Router()

const writeLimiter = rateLimit({ windowMs: 3_600_000, max: 60, message: 'Too many changes, please try again later.' })
const readLimiter = rateLimit({ windowMs: 60_000, max: 240 })
const eventLimiter = rateLimit({ windowMs: 60_000, max: 60 })

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res)
  } catch (err) {
    if (err instanceof SharePlanError) return res.status(err.status).json({ error: err.message })
    next(err)
  }
}

// --- public: anyone with the link, no account -----------------------------------------------------------------------

plansRouter.get(
  '/plans/public/:slug',
  readLimiter,
  handle(async (req, res) => {
    const share = await getPublicShare(req.params.slug)
    if (!share) return res.status(404).json({ error: 'That plan is not shared, or the owner has turned sharing off.' })
    res.json({ plan: share })
  }),
)

// Someone opened a public plan ('view') or started their own plan from it ('use'). Only a count is kept. Signing in is
// optional: it is only used so an owner looking at their own plan is not counted.
plansRouter.post(
  '/plans/public/:slug/event',
  eventLimiter,
  attachUser,
  handle(async (req, res) => {
    const ok = await recordShareEvent(req.params.slug, req.body?.type, req.user?.id ?? null)
    res.status(ok ? 200 : 404).json({ ok })
  }),
)

// The picture a shared plan link unfurls into (Discord, X, iMessage).
plansRouter.get(
  '/plans/public/:slug/card.png',
  readLimiter,
  handle(async (req, res) => {
    const share = await getPublicShare(req.params.slug)
    if (!share) return res.status(404).end()
    const png = await renderPlanCardPng(share)
    res.set('Content-Type', 'image/png')
    // The link carries a version (?v=) that changes when the owner updates the plan.
    res.set('Cache-Control', 'public, max-age=300')
    res.send(png)
  }),
)

// --- the owner ---------------------------------------------------------------------------------------------------------

plansRouter.get(
  '/plans/shared',
  attachUser,
  requireUser,
  handle(async (req, res) => {
    res.json({ shares: await listMyShares(req.user.id) })
  }),
)

// Share a plan, or update its public copy. Plans are private until this is called.
plansRouter.post(
  '/plans/shared',
  attachUser,
  requireUser,
  writeLimiter,
  handle(async (req, res) => {
    res.status(201).json({ share: await shareMyPlan(req.user.id, req.body) })
  }),
)

// Turn sharing off. The link stops working immediately.
plansRouter.delete(
  '/plans/shared/:slug',
  attachUser,
  requireUser,
  writeLimiter,
  handle(async (req, res) => {
    const ok = await stopSharing(req.user.id, req.params.slug)
    if (!ok) return res.status(404).json({ error: 'That plan is not shared.' })
    res.json({ ok: true })
  }),
)
