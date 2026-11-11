import { Router } from 'express'
import { attachUser, requireUser } from './auth.routes.js'
import { getNotifications } from '../services/notifications.service.js'
import { listInbox, markRead } from '../services/inbox.service.js'

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

// The stored inbox: newest first, each with a read flag.
notificationsRouter.get('/inbox', attachUser, requireUser, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json({ items: await listInbox(req.user.id, req.query.limit) })
  } catch (err) {
    next(err)
  }
})

// Mark some (ids: [1, 2]) or all ({ all: true }) as read.
notificationsRouter.post('/inbox/read', attachUser, requireUser, async (req, res, next) => {
  try {
    await markRead(req.user.id, { ids: req.body?.ids, all: req.body?.all === true })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
