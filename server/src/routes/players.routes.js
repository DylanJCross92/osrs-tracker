import { Router } from 'express'
import { PlayerNotFoundError } from '../services/osrsHiscores.service.js'
import {
  listPlayers,
  addPlayer,
  removePlayer,
  getPlayer,
  getSnapshots,
  refreshPlayer,
} from '../services/players.service.js'
import { syncAllPlayers } from '../jobs/sync.js'

export const playersRouter = Router()

function handleKnownErrors(err, res, next) {
  if (err instanceof PlayerNotFoundError) return res.status(404).json({ error: err.message })
  if (err.status) return res.status(err.status).json({ error: err.message })
  next(err)
}

playersRouter.get('/', async (req, res, next) => {
  try {
    res.json(await listPlayers())
  } catch (err) {
    next(err)
  }
})

playersRouter.post('/', async (req, res, next) => {
  try {
    await addPlayer(req.body.username)
    res.status(201).json(await listPlayers())
  } catch (err) {
    handleKnownErrors(err, res, next)
  }
})

playersRouter.delete('/:id', async (req, res, next) => {
  try {
    await removePlayer(req.params.id)
    res.json(await listPlayers())
  } catch (err) {
    next(err)
  }
})

playersRouter.get('/:id/snapshots', async (req, res, next) => {
  try {
    const player = await getPlayer(req.params.id)
    if (!player) return res.status(404).json({ error: 'Player not found.' })
    res.json(await getSnapshots(req.params.id))
  } catch (err) {
    next(err)
  }
})

// Manual sync, so you can see a fresh data point without waiting for the
// scheduler's next 6-hourly run.
playersRouter.post('/:id/refresh', async (req, res, next) => {
  try {
    await refreshPlayer(req.params.id)
    res.json(await listPlayers())
  } catch (err) {
    handleKnownErrors(err, res, next)
  }
})

// Checks every tracked player for updates — used to sync on page load
// instead of waiting for the scheduler. Reuses the same staggered,
// error-tolerant sweep as the 6-hourly job.
playersRouter.post('/sync-all', async (req, res, next) => {
  try {
    await syncAllPlayers()
    res.json(await listPlayers())
  } catch (err) {
    next(err)
  }
})
