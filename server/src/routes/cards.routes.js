import { Router } from 'express'
import { getPlayerByUsername } from '../services/players.service.js'
import { getWeeklyCardData, freezeWeeklyCard, getFrozenCard } from '../services/cards.service.js'
import { renderWeeklyCardPng } from '../services/cardImage.service.js'

export const cardsRouter = Router()

async function resolvePlayer(req, res) {
  const player = await getPlayerByUsername(req.params.username)
  if (!player) {
    res.status(404).json({ error: 'Player not found.' })
    return null
  }
  return player
}

// Live weekly card data — always the trailing 7 days as of the request, for
// whichever skill is selected (?skill=, default 'Overall').
cardsRouter.get('/players/:username/card/weekly/data', async (req, res, next) => {
  try {
    const player = await resolvePlayer(req, res)
    if (!player) return
    const data = await getWeeklyCardData(player.id, req.query.skill)
    if (!data) return res.status(404).json({ error: 'Nothing to show yet for this player.' })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

cardsRouter.get('/players/:username/card/weekly/image.png', async (req, res, next) => {
  try {
    const player = await resolvePlayer(req, res)
    if (!player) return
    const data = await getWeeklyCardData(player.id, req.query.skill)
    if (!data) return res.status(404).end()
    const png = await renderWeeklyCardPng(data)
    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'public, max-age=300') // short cache — this one keeps moving
    res.send(png)
  } catch (err) {
    next(err)
  }
})

// Freezes the player's current weekly numbers (for the given skill, default
// 'Overall') into a permanent share link.
cardsRouter.post('/players/:username/card/weekly/freeze', async (req, res, next) => {
  try {
    const player = await resolvePlayer(req, res)
    if (!player) return
    const frozen = await freezeWeeklyCard(player.id, req.body?.skill)
    if (!frozen) return res.status(404).json({ error: 'Nothing to share yet for this player.' })
    res.status(201).json(frozen)
  } catch (err) {
    next(err)
  }
})

cardsRouter.get('/cards/:slug', async (req, res, next) => {
  try {
    const card = await getFrozenCard(req.params.slug)
    if (!card) return res.status(404).json({ error: 'Card not found.' })
    res.json(card)
  } catch (err) {
    next(err)
  }
})

cardsRouter.get('/cards/:slug/image.png', async (req, res, next) => {
  try {
    const card = await getFrozenCard(req.params.slug)
    if (!card) return res.status(404).end()
    const png = await renderWeeklyCardPng(card)
    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'public, max-age=31536000, immutable') // frozen — never changes
    res.send(png)
  } catch (err) {
    next(err)
  }
})
