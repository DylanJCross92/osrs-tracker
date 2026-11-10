import { Router } from 'express'
import { attachUser, requireUser } from './auth.routes.js'
import { getNotifications } from '../services/notifications.service.js'

export const notificationsRouter = Router()

// The signed-in account's notifications (see notifications.service.js). Personal, so never cached.
notificationsRouter.get('/notifications', attachUser, requireUser, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await getNotifications(req.user))
  } catch (err) {
    next(err)
  }
})
