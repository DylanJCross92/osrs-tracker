import { Router } from 'express'
import { rateLimit } from '../utils/rateLimit.js'
import { HISTORY_RANGES } from '../utils/ge.js'
import { GeUnavailableError, getHistory, getItemBySlug, getItemIdBySlug, getItemIndex, getPricesByName, MAX_PRICE_NAMES } from '../services/ge.service.js'

// Public Grand Exchange data: nothing here is about a person. The price data comes from a database that a job keeps up to date, so these
// reads are cheap; history is fetched from the wiki on demand and kept for a while (see services/ge.service.js).
export const geRouter = Router()

const readLimiter = rateLimit({ windowMs: 60_000, max: 60 })
const historyLimiter = rateLimit({ windowMs: 60_000, max: 30 })
const SLUG = /^[a-z0-9-]{1,120}$/

const fail = (err, res, next) => (err instanceof GeUnavailableError ? res.status(503).json({ error: err.message }) : next(err))

// Every item with its price, volume and changes, as short rows for the Items page to search and sort in the browser:
// [id, name, slug, members (1 or 0), high, low, volume, buy limit, change 1d, 7d and 30d in percent, margin after tax, icon file or null].
geRouter.get('/ge/items', readLimiter, async (req, res, next) => {
  try {
    const { updatedAt, stale, items } = await getItemIndex()
    res.set('Cache-Control', 'public, max-age=300')
    res.json({
      updatedAt,
      stale,
      items: items.filter((i) => i.price != null).map((i) => [i.id, i.name, i.slug, i.members ? 1 : 0, i.high, i.low, i.volume, i.limit, i.change1, i.change7, i.change30, i.margin, i.icon]),
    })
  } catch (err) {
    fail(err, res, next)
  }
})

// The items someone watches, by address: ?slugs=dragon-bones,law-rune gives the same short rows as /ge/items for just those (an item with
// no price yet is included, with empty prices). Up to 100.
geRouter.get('/ge/watch', readLimiter, async (req, res, next) => {
  try {
    const wanted = [...new Set(String(req.query.slugs || '').split(',').map((x) => x.trim()).filter((x) => SLUG.test(x)))].slice(0, 100)
    if (!wanted.length) return res.status(400).json({ error: 'Give the item addresses to look up, separated by commas.' })
    const { updatedAt, stale, items } = await getItemIndex()
    const bySlug = new Map(items.map((i) => [i.slug, i]))
    res.set('Cache-Control', 'public, max-age=60')
    res.json({
      updatedAt,
      stale,
      items: wanted.map((s) => bySlug.get(s)).filter(Boolean).map((i) => [i.id, i.name, i.slug, i.members ? 1 : 0, i.high, i.low, i.volume, i.limit, i.change1, i.change7, i.change30, i.margin, i.icon]),
    })
  } catch (err) {
    fail(err, res, next)
  }
})

// The prices of some items by name, for the planners and calculators: ?names=Dragon bones|Law rune|... gives
// { updatedAt, stale, prices: { "dragon bones": [high, low, slug, icon file or null] } }. Up to MAX_PRICE_NAMES names.
geRouter.get('/ge/prices', readLimiter, async (req, res, next) => {
  try {
    const names = String(req.query.names || '').split('|').map((x) => x.trim()).filter((x) => x && x.length <= 80)
    if (!names.length) return res.status(400).json({ error: 'Give the item names to price, separated by |.' })
    res.set('Cache-Control', 'public, max-age=120')
    res.json(await getPricesByName(names.slice(0, MAX_PRICE_NAMES)))
  } catch (err) {
    fail(err, res, next)
  }
})

geRouter.get('/ge/items/:slug', readLimiter, async (req, res, next) => {
  try {
    if (!SLUG.test(req.params.slug)) return res.status(404).json({ error: 'No such item.' })
    const item = await getItemBySlug(req.params.slug)
    if (!item) return res.status(404).json({ error: 'No such item.' })
    res.set('Cache-Control', 'public, max-age=120')
    res.json(item)
  } catch (err) {
    fail(err, res, next)
  }
})

geRouter.get('/ge/items/:slug/history', historyLimiter, async (req, res, next) => {
  try {
    const range = String(req.query.range || '1m')
    if (!HISTORY_RANGES[range]) return res.status(400).json({ error: `Use one of ${Object.keys(HISTORY_RANGES).join(', ')}.` })
    if (!SLUG.test(req.params.slug)) return res.status(404).json({ error: 'No such item.' })
    const id = await getItemIdBySlug(req.params.slug)
    if (id == null) return res.status(404).json({ error: 'No such item.' })
    const body = await getHistory(id, range)
    res.set('Cache-Control', `public, max-age=${Math.round(HISTORY_RANGES[range].ttlMs / 2000)}`)
    res.json(body)
  } catch (err) {
    fail(err, res, next)
  }
})
