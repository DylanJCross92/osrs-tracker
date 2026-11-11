import { Router } from 'express'
import { getPlayerByUsername } from '../services/players.service.js'
import { rateLimit } from '../utils/rateLimit.js'
import { attachUser, requireUser } from './auth.routes.js'
import { isOwner } from '../services/profilePages.service.js'
import { GoalError, addGoal, deleteGoal, getGoal, listGoals, pinGoal } from '../services/goals.service.js'
import { renderGoalCardPng } from '../services/cardImage.service.js'

export const goalsRouter = Router()

const writeLimiter = rateLimit({ windowMs: 3_600_000, max: 60, message: 'Too many changes, please try again later.' })

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res)
  } catch (err) {
    if (err instanceof GoalError) return res.status(err.status).json({ error: err.message })
    next(err)
  }
}

async function playerOr404(req, res) {
  const player = await getPlayerByUsername(req.params.username)
  if (!player) {
    res.status(404).json({ error: 'That player is not being tracked yet.' })
    return null
  }
  return player
}
async function ownerOnly(req, res) {
  const player = await playerOr404(req, res)
  if (!player) return null
  if (!(await isOwner(req.user.id, player.id))) {
    res.status(403).json({ error: 'Only the profile owner can do that.' })
    return null
  }
  return player
}

// Public: a profile's goals with live progress.
goalsRouter.get(
  '/players/:username/goals',
  handle(async (req, res) => {
    const player = await playerOr404(req, res)
    if (!player) return
    res.set('Cache-Control', 'no-store')
    res.json({ goals: await listGoals(player.id) })
  }),
)

goalsRouter.post(
  '/players/:username/goals',
  attachUser,
  requireUser,
  writeLimiter,
  handle(async (req, res) => {
    const player = await ownerOnly(req, res)
    if (!player) return
    await addGoal(player.id, req.body)
    res.status(201).json({ goals: await listGoals(player.id) })
  }),
)

goalsRouter.post(
  '/players/:username/goals/:id/delete',
  attachUser,
  requireUser,
  writeLimiter,
  handle(async (req, res) => {
    const player = await ownerOnly(req, res)
    if (!player) return
    await deleteGoal(player.id, Number(req.params.id))
    res.json({ goals: await listGoals(player.id) })
  }),
)

goalsRouter.post(
  '/players/:username/goals/:id/pin',
  attachUser,
  requireUser,
  writeLimiter,
  handle(async (req, res) => {
    const player = await ownerOnly(req, res)
    if (!player) return
    await pinGoal(player.id, Number(req.params.id), req.body?.pinned !== false)
    res.json({ goals: await listGoals(player.id) })
  }),
)

// The share picture for one goal, drawn from the live progress.
goalsRouter.get('/players/:username/goals/:id/image.png', async (req, res, next) => {
  try {
    const player = await getPlayerByUsername(req.params.username)
    if (!player) return res.status(404).end()
    const goal = await getGoal(player.id, Number(req.params.id))
    if (!goal) return res.status(404).end()
    const png = await renderGoalCardPng({ displayName: player.displayName, goal })
    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'public, max-age=300')
    res.send(png)
  } catch (err) {
    next(err)
  }
})
