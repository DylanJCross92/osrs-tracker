import { Router } from 'express'
import { PlayerNotFoundError } from '../services/osrsHiscores.service.js'
import {
  listPlayers,
  addPlayer,
  getPlayer,
  getSnapshots,
  refreshPlayer,
  startWomImport,
} from '../services/players.service.js'
import { syncAllPlayers } from '../jobs/sync.js'
import { getProfileAchievements, getCelebrations, addCheer, visitorHash } from '../services/milestones.service.js'
import { searchPlayers } from '../services/discover.service.js'
import { rateLimit } from '../utils/rateLimit.js'

const importLimiter = rateLimit({ windowMs: 60_000, max: 6, message: 'Too many player lookups, try again in a minute.' })
const searchLimiter = rateLimit({ windowMs: 10_000, max: 20 })

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

// Returns as soon as the player's live snapshot is saved, any Wise Old Man
// history backfill keeps running in the background (see players.service.js)
// and is reflected in each player's womImportStatus from here on, so the
// client can show "still importing" without this request blocking on it.
playersRouter.get('/search', searchLimiter, async (req, res, next) => {
  try {
    res.json(await searchPlayers(req.query.q))
  } catch (err) {
    next(err)
  }
})

playersRouter.get('/:id/profile', async (req, res, next) => {
  try {
    const player = await getPlayer(req.params.id)
    if (!player) return res.status(404).json({ error: 'Player not found.' })
    const [profile, celebrations] = await Promise.all([getProfileAchievements(player.id), getCelebrations(player.id, visitorHash(req.ip))])
    res.json({ ...profile, celebrations })
  } catch (err) {
    next(err)
  }
})

// Congratulate a player on a fresh 99 / 200M. Anonymous, one per visitor per milestone.
const cheerLimiter = rateLimit({ windowMs: 3_600_000, max: 40, message: 'That is a lot of congratulations, try again later.' })
playersRouter.post('/:id/cheer', cheerLimiter, async (req, res, next) => {
  try {
    const player = await getPlayer(req.params.id)
    if (!player) return res.status(404).json({ error: 'Player not found.' })
    const { type, skill, value } = req.body || {}
    if (!['skill_level', 'skill_xp'].includes(type) || !Number.isFinite(Number(value))) return res.status(400).json({ error: 'Invalid milestone.' })
    const cheers = await addCheer(player.id, { type, skill: typeof skill === 'string' ? skill : '', value: Number(value) }, visitorHash(req.ip))
    if (cheers == null) return res.status(404).json({ error: 'That milestone is no longer being celebrated.' })
    res.json({ cheers, cheered: true })
  } catch (err) {
    next(err)
  }
})

playersRouter.post('/', importLimiter, async (req, res, next) => {
  try {
    await addPlayer(req.body.username)
    res.status(201).json(await listPlayers())
  } catch (err) {
    handleKnownErrors(err, res, next)
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

// One-time manual trigger for a player who was never auto-checked (e.g.
// added before this feature existed), runs in the background same as the
// automatic check, see players.service.js.
playersRouter.post('/:id/check-wom-history', importLimiter, async (req, res, next) => {
  try {
    await startWomImport(req.params.id)
    res.json(await listPlayers())
  } catch (err) {
    handleKnownErrors(err, res, next)
  }
})

// Manual sync, so you can see a fresh data point without waiting for the
// scheduler's next hourly run.
playersRouter.post('/:id/refresh', rateLimit({ windowMs: 60_000, max: 20 }), async (req, res, next) => {
  try {
    await refreshPlayer(req.params.id)
    res.json(await listPlayers())
  } catch (err) {
    handleKnownErrors(err, res, next)
  }
})

// Checks every tracked player for updates, used to sync on page load
// instead of waiting for the scheduler. Reuses the same staggered,
// error-tolerant, tiered sweep as the hourly job (and skips if one is already running).
playersRouter.post('/sync-all', async (req, res, next) => {
  try {
    await syncAllPlayers()
    res.json(await listPlayers())
  } catch (err) {
    next(err)
  }
})
