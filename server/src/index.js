import 'dotenv/config'
import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { playersRouter } from './routes/players.routes.js'
import { cardsRouter } from './routes/cards.routes.js'
import { startScheduler } from './jobs/sync.js'
import { listPlayers, getPlayerByUsername } from './services/players.service.js'
import { getWeeklyCardData, getFrozenCard } from './services/cards.service.js'
import { formatXp } from './services/cardImage.service.js'
import { injectCardMeta } from './utils/cardMeta.js'

const app = express()

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  }),
)
app.use(express.json())

app.use('/api/players', playersRouter)
app.use('/api', cardsRouter)

const SITE_URL = process.env.SITE_URL || 'https://tickgains.com'

// Generated from the live player list rather than a static file, so newly
// tracked (or removed) players show up without a redeploy.
app.get('/sitemap.xml', async (req, res) => {
  let players = []
  try {
    players = await listPlayers()
  } catch (err) {
    console.error('Failed to build sitemap.xml', err)
  }

  const urls = [`${SITE_URL}/`, ...players.map((p) => `${SITE_URL}/player/${encodeURIComponent(p.username)}`)]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${url}</loc></url>`)
    .join('\n')}\n</urlset>\n`

  res.type('application/xml').send(xml)
})

// In production this one service also serves the built frontend (`npm run
// build` at the repo root outputs to ../dist from here) — no separate static
// host or CORS setup needed. In local dev there's no dist/ yet, since the
// frontend runs through Vite's own dev server instead; both middlewares
// below just no-op until it exists.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, '../../dist')
const distExists = existsSync(distPath)

if (distExists) {
  const indexHtmlTemplate = readFileSync(path.join(distPath, 'index.html'), 'utf-8')

  // Share-card pages need their og:image/title/description baked into the
  // actual HTML bytes, served before any JS runs — link-unfurling bots
  // (Discord, Twitter, iMessage, Slack) only ever do a plain GET and read
  // the markup as-is, so setPageMeta()'s client-side DOM updates are
  // invisible to them. These two routes are the only place that happens;
  // everything else still resolves through the plain SPA fallback below.
  app.get('/player/:username/card/weekly', async (req, res, next) => {
    try {
      const player = await getPlayerByUsername(req.params.username)
      if (!player) return res.sendFile(path.join(distPath, 'index.html'))

      const skill = req.query.skill
      const data = await getWeeklyCardData(player.id, skill)
      const skillQuery = data && data.skill !== 'Overall' ? `?skill=${encodeURIComponent(data.skill)}` : ''
      const pageUrl = `${SITE_URL}/player/${encodeURIComponent(player.username)}/card/weekly${skillQuery}`
      const imageUrl = `${SITE_URL}/api/players/${encodeURIComponent(player.username)}/card/weekly/image.png${skillQuery}`
      const skillLabel = data && data.skill !== 'Overall' ? ` ${data.skill}` : ''
      const description = data
        ? `${player.displayName} gained ${formatXp(data.xpGained)}${skillLabel} XP this week on TickGains.`
        : `${player.displayName}'s OSRS progress on TickGains.`

      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: `${player.displayName}'s Weekly${skillLabel} XP Gains — TickGains`,
          description,
          imageUrl,
          pageUrl,
        }),
      )
    } catch (err) {
      next(err)
    }
  })

  app.get('/player/:username/card/weekly/:slug', async (req, res, next) => {
    try {
      const card = await getFrozenCard(req.params.slug)
      if (!card) return res.sendFile(path.join(distPath, 'index.html'))

      const pageUrl = `${SITE_URL}/player/${encodeURIComponent(card.username)}/card/weekly/${card.slug}`
      const imageUrl = `${SITE_URL}/api/cards/${card.slug}/image.png`
      const skillLabel = card.skill && card.skill !== 'Overall' ? ` ${card.skill}` : ''
      const description = `${card.displayName} gained ${formatXp(card.xpGained)}${skillLabel} XP that week on TickGains.`

      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: `${card.displayName}'s Weekly${skillLabel} XP Gains — TickGains`,
          description,
          imageUrl,
          pageUrl,
        }),
      )
    } catch (err) {
      next(err)
    }
  })

  app.use(express.static(distPath))
  // SPA fallback: any non-API GET (e.g. /players/3) resolves client-side,
  // so it all serves the same index.html.
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong.' })
})

const port = process.env.PORT || 4000
app.listen(port, () => {
  console.log(`TickGains API listening on http://localhost:${port}`)
  if (!distExists) console.log('(no dist/ build found — run `npm run build` at the repo root to serve the frontend too)')
})

startScheduler()
