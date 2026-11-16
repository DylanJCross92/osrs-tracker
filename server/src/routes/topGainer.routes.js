import { Router } from 'express'
import { getPlayerByUsername } from '../services/players.service.js'
import { getTopGainerStats } from '../services/topGainers.service.js'
import { renderTopGainerCardPng } from '../services/cardImage.service.js'

export const topGainerRouter = Router()

async function resolvePlayer(req, res) {
  const player = await getPlayerByUsername(req.params.username)
  if (!player) {
    res.status(404).json({ error: 'Player not found.' })
    return null
  }
  return player
}

// How many days this player has been the top gainer of the day ({ days: 0 } if never).
topGainerRouter.get('/players/:username/top-gainer', async (req, res, next) => {
  try {
    const player = await resolvePlayer(req, res)
    if (!player) return
    res.set('Cache-Control', 'no-store')
    res.json(await getTopGainerStats(player))
  } catch (err) {
    next(err)
  }
})

// The share image, drawn from the live count so it moves on with the number.
topGainerRouter.get('/players/:username/top-gainer/image.png', async (req, res, next) => {
  try {
    const player = await resolvePlayer(req, res)
    if (!player) return
    const stats = await getTopGainerStats(player)
    if (!stats.days) return res.status(404).end()
    const png = await renderTopGainerCardPng({ displayName: player.displayName, stats })
    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'public, max-age=300')
    res.send(png)
  } catch (err) {
    next(err)
  }
})
