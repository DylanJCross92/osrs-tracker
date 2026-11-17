import { Router } from 'express'
import { cleanFeedback } from '../utils/feedback.js'
import { saveFeedback } from '../services/feedback.service.js'
import { rateLimit } from '../utils/rateLimit.js'
import { attachUser } from './auth.routes.js'

export const feedbackRouter = Router()

const feedbackLimiter = rateLimit({ windowMs: 3_600_000, max: 8, message: 'You have sent a lot of feedback just now, please try again later.' })

// The feedback form. No account needed. The signed-in account (if any) comes from the session, never from the request.
feedbackRouter.post('/feedback', feedbackLimiter, attachUser, async (req, res, next) => {
  try {
    const body = req.body || {}
    // A hidden field real visitors never see or fill in. Bots that fill every field get a normal-looking answer and
    // nothing is saved.
    if (typeof body.website === 'string' && body.website.trim() !== '') return res.json({ ok: true })
    const { error, value } = cleanFeedback(body)
    if (error) return res.status(400).json({ error })
    await saveFeedback(value, req.user?.id || null)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
