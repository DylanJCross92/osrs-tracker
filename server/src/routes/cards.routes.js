import { Router } from 'express'
import { rateLimit } from '../utils/rateLimit.js'
import { getPlayerByUsername } from '../services/players.service.js'
import { getWeeklyCardData, freezeWeeklyCard, getFrozenCard } from '../services/cards.service.js'
import { renderWeeklyCardPng, renderChallengeCardPng, renderProfileCardPng, renderLevel99CardPng } from '../services/cardImage.service.js'
import { getLevel99Card } from '../services/level99.service.js'
import { getProfileCardData } from '../services/profileCard.service.js'

export const cardsRouter = Router()

// Every picture costs real memory to draw, so one address cannot ask for more than a steady stream of them.
const imageLimiter = rateLimit({ windowMs: 60_000, max: 90, message: 'Too many pictures requested, try again in a minute.' })

// ?mode=hardcore (or ?world=hardcore) asks for a name's Hardcore Worlds character; otherwise the normal one, or the Hardcore Worlds one when that is all there is.
export const wantedMode = (req) => (req.query.mode === 'hardcore' || req.query.world === 'hardcore' ? 'hardcore' : 'main')

async function resolvePlayer(req, res) {
  const player = await getPlayerByUsername(req.params.username, wantedMode(req))
  if (!player) {
    res.status(404).json({ error: 'Player not found.' })
    return null
  }
  return player
}

// Live weekly card data, always the trailing 7 days as of the request, for
// whichever skill is selected (?skill=, default 'Overall').
cardsRouter.get('/players/:username/card/weekly/data', async (req, res, next) => {
  try {
    const player = await resolvePlayer(req, res)
    if (!player) return
    const data = await getWeeklyCardData(player.id, req.query.skill, req.query.period)
    if (!data) return res.status(404).json({ error: 'Nothing to show yet for this player.' })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// The picture a profile link unfurls into (Discord, X, iMessage): picture, level, XP, rank and this week's gain.
cardsRouter.get('/players/:username/card/profile/image.png', imageLimiter, async (req, res, next) => {
  try {
    const player = await resolvePlayer(req, res)
    if (!player) return
    const data = await getProfileCardData(player)
    if (!data) return res.status(404).end()
    const png = await renderProfileCardPng(data)
    res.set('Content-Type', 'image/png')
    // The link carries a version (?v=) that changes with each new snapshot, so previews refresh but stay cached between.
    res.set('Cache-Control', 'public, max-age=300')
    res.send(png)
  } catch (err) {
    next(err)
  }
})

// The congratulations card for a skill the player has at 99 (?skill=). 404 for a skill they have not got to 99.
cardsRouter.get('/players/:username/card/level99/image.png', imageLimiter, async (req, res, next) => {
  try {
    const player = await resolvePlayer(req, res)
    if (!player) return
    const data = await getLevel99Card(player, req.query.skill, { preview: req.query.preview === '1' })
    if (!data) return res.status(404).end()
    const png = await renderLevel99CardPng(data)
    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'public, max-age=300')
    res.send(png)
  } catch (err) {
    next(err)
  }
})

// The picture a challenge link unfurls into: this player's week, drawn from live numbers.
cardsRouter.get('/players/:username/challenge/image.png', imageLimiter, async (req, res, next) => {
  try {
    const player = await resolvePlayer(req, res)
    if (!player) return
    const data = await getWeeklyCardData(player.id, 'Overall', 'week')
    if (!data) return res.status(404).end()
    const png = await renderChallengeCardPng(data)
    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'public, max-age=300')
    res.send(png)
  } catch (err) {
    next(err)
  }
})

cardsRouter.get('/players/:username/card/weekly/image.png', imageLimiter, async (req, res, next) => {
  try {
    const player = await resolvePlayer(req, res)
    if (!player) return
    const data = await getWeeklyCardData(player.id, req.query.skill, req.query.period)
    if (!data) return res.status(404).end()
    const png = await renderWeeklyCardPng(data)
    res.set('Content-Type', 'image/png')
    // Never cache, this is the "live" card, so a reload after refreshing
    // hiscores (or just the data moving on) should always show current
    // numbers, not whatever the browser already has for this same URL.
    res.set('Cache-Control', 'no-store')
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
    const frozen = await freezeWeeklyCard(player.id, req.body?.skill, req.body?.period)
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

cardsRouter.get('/cards/:slug/image.png', imageLimiter, async (req, res, next) => {
  try {
    const card = await getFrozenCard(req.params.slug)
    if (!card) return res.status(404).end()
    const png = await renderWeeklyCardPng(card)
    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'public, max-age=31536000, immutable') // frozen, never changes
    res.send(png)
  } catch (err) {
    next(err)
  }
})
