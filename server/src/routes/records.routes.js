import { Router } from 'express'
import { getPlayerByUsername } from '../services/players.service.js'
import { getPlayerRecords, getPlayerRecord } from '../services/records.service.js'
import { renderRecordCardPng } from '../services/cardImage.service.js'

export const recordsRouter = Router()

async function resolvePlayer(req, res) {
  const player = await getPlayerByUsername(req.params.username)
  if (!player) {
    res.status(404).json({ error: 'Player not found.' })
    return null
  }
  return player
}

// Every personal record for the profile's Records tab.
recordsRouter.get('/players/:username/records', async (req, res, next) => {
  try {
    const player = await resolvePlayer(req, res)
    if (!player) return
    res.set('Cache-Control', 'no-store')
    res.json(await getPlayerRecords(player))
  } catch (err) {
    next(err)
  }
})

// The share image for one record. Rendered from the live numbers, so a record that gets beaten shows the new best.
recordsRouter.get('/players/:username/records/:key/image.png', async (req, res, next) => {
  try {
    const player = await resolvePlayer(req, res)
    if (!player) return
    const record = await getPlayerRecord(player, req.params.key)
    if (!record) return res.status(404).end()
    const png = await renderRecordCardPng({ displayName: player.displayName, record })
    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'public, max-age=300')
    res.send(png)
  } catch (err) {
    next(err)
  }
})
