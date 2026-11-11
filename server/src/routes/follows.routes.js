import { Router } from 'express'
import { getPlayerByUsername } from '../services/players.service.js'
import { rateLimit } from '../utils/rateLimit.js'
import { attachUser, requireUser } from './auth.routes.js'
import { FollowError, followPlayer, getFollowingFeed, listFollows, setFollows, unfollowPlayer } from '../services/follows.service.js'

export const followsRouter = Router()

const writeLimiter = rateLimit({ windowMs: 60_000, max: 60 })
const feedLimiter = rateLimit({ windowMs: 60_000, max: 60 })

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res)
  } catch (err) {
    if (err instanceof FollowError) return res.status(err.status).json({ error: err.message })
    next(err)
  }
}

followsRouter.get(
  '/follows',
  attachUser,
  requireUser,
  handle(async (req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json({ players: await listFollows(req.user.id) })
  }),
)

// Replace the whole list (used when signing in to bring in what the browser had).
followsRouter.put(
  '/follows',
  attachUser,
  requireUser,
  writeLimiter,
  handle(async (req, res) => {
    res.json({ players: await setFollows(req.user.id, req.body?.names) })
  }),
)

for (const [action, fn] of [['follow', followPlayer], ['unfollow', unfollowPlayer]]) {
  followsRouter.post(
    `/players/:username/${action}`,
    attachUser,
    requireUser,
    writeLimiter,
    handle(async (req, res) => {
      const player = await getPlayerByUsername(req.params.username)
      if (!player) return res.status(404).json({ error: 'That player is not being tracked yet.' })
      await fn(req.user.id, player.id)
      res.json({ players: await listFollows(req.user.id) })
    }),
  )
}

// The Following strip. Public: it is built from public player data and a list of names.
followsRouter.get(
  '/following/feed',
  feedLimiter,
  handle(async (req, res) => {
    const names = String(req.query.names || '').split(',')
    res.set('Cache-Control', 'public, max-age=60')
    res.json(await getFollowingFeed(names))
  }),
)
