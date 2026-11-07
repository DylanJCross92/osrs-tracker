import 'dotenv/config'
import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { playersRouter } from './routes/players.routes.js'
import { cardsRouter } from './routes/cards.routes.js'
import { startScheduler } from './jobs/sync.js'
import { listPlayers, getPlayerByUsername, getLatestSnapshot } from './services/players.service.js'
import { getWeeklyCardData, getFrozenCard } from './services/cards.service.js'
import { getDiscover } from './services/discover.service.js'
import { backfillAllMilestones } from './services/milestones.service.js'
import { formatXp } from './services/cardImage.service.js'
import { injectCardMeta } from './utils/cardMeta.js'

const app = express()
// Behind Render's proxy — needed so req.ip is the visitor (rate limiting).
app.set('trust proxy', 1)

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  }),
)
app.use(express.json())

app.use('/api/players', playersRouter)
app.use('/api', cardsRouter)
app.get('/api/discover', async (req, res, next) => {
  try {
    res.json(await getDiscover())
  } catch (err) {
    next(err)
  }
})

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

  const urls = [`${SITE_URL}/`, `${SITE_URL}/planner`, `${SITE_URL}/discover`, ...players.map((p) => `${SITE_URL}/player/${encodeURIComponent(p.username)}`)]
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
  // A plain profile link needs the same treatment — Discord/Twitter/iMessage
  // unfurl whatever's shared, not just the dedicated card pages, so this is
  // what makes pasting someone's tickgains.com/player/X link show their
  // name, level, and recent gains instead of the generic site description.
  app.get('/player/:username', async (req, res, next) => {
    try {
      const player = await getPlayerByUsername(req.params.username)
      if (!player) return res.sendFile(path.join(distPath, 'index.html'))

      // One canonical URL per player: /player/dylanz297 and /player/Dylanz297
      // must not be two indexable pages, so any other casing redirects.
      if (req.params.username !== player.username) {
        return res.redirect(301, `/player/${encodeURIComponent(player.username)}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`)
      }

      const [latest, weekly] = await Promise.all([
        getLatestSnapshot(player.id),
        getWeeklyCardData(player.id, 'Overall').catch(() => null),
      ])

      const pageUrl = `${SITE_URL}/player/${encodeURIComponent(player.username)}`
      const imageUrl = latest
        ? `${SITE_URL}/api/players/${encodeURIComponent(player.username)}/card/weekly/image.png`
        : `${SITE_URL}/og-default.png`

      let description = `Explore ${player.displayName}'s Old School RuneScape stats, XP history, achievements, and progression on TickGains.`
      if (latest) {
        description = `${player.displayName} — Level ${latest.overallLevel.toLocaleString()} (${formatXp(latest.overallXp)} XP). Explore ${player.displayName}'s OSRS stats, XP history, achievements, and progression on TickGains.`
        if (weekly?.xpGained > 0) {
          description += ` +${formatXp(weekly.xpGained)} XP this week.`
        }
      }

      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: `${player.displayName} — OSRS Player Profile | TickGains`,
          description,
          imageUrl,
          pageUrl,
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            mainEntity: { '@type': 'Person', name: player.displayName, url: pageUrl, description },
          },
        }),
      )
    } catch (err) {
      next(err)
    }
  })

  app.get('/discover', (req, res) => {
    res.send(
      injectCardMeta(indexHtmlTemplate, {
        title: 'Discover OSRS Players | TickGains',
        description: 'Discover tracked Old School RuneScape players: recent 99s, top XP gains this week and month, and players closing in on max.',
        imageUrl: `${SITE_URL}/og-default.png`,
        pageUrl: `${SITE_URL}/discover`,
      }),
    )
  })

  // The planner's title/description are baked into the HTML for crawlers and
  // link unfurls; parameterized plan URLs share the same page (the client
  // marks those noindex).
  app.get('/planner', (req, res) => {
    // A shared plan link names the player and skills in its description;
    // the bare page keeps the generic one. Query parsing is defensive —
    // it's user-controlled text that ends up in HTML meta (escaped by injectCardMeta).
    const who = typeof req.query.u === 'string' ? req.query.u.slice(0, 12).trim() : ''
    const skills = (typeof req.query.g === 'string' ? req.query.g.split(',') : [])
      .map((chunk) => chunk.split('~')[0])
      .filter((name) => /^[A-Za-z]{3,12}$/.test(name))
      .slice(0, 6)
    let title = 'OSRS Account Planner & XP Calculator | TickGains'
    let description =
      'Plan your Old School RuneScape skill goals. Calculate XP remaining, training hours, and GP costs using your OSRS username. Free OSRS account planner.'
    if (skills.length) {
      title = `${who ? `${who}'s ` : ''}OSRS Training Plan | TickGains`
      description = `${who ? `${who}'s` : 'A'} OSRS training plan for ${skills.join(', ')} — XP remaining, training hours, GP and days to finish, built with the TickGains Account Planner.`
    }
    res.send(
      injectCardMeta(indexHtmlTemplate, {
        title,
        description,
        imageUrl: `${SITE_URL}/og-planner.png`,
        pageUrl: `${SITE_URL}/planner`,
      }),
    )
  })

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
// Reconstruct achievements/milestones for players tracked before they existed (idempotent).
backfillAllMilestones().catch((err) => console.error('[milestones] backfill failed:', err))
