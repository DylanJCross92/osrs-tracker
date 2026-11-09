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
import { getWeeklyCardData, getFrozenCard, normalizePeriod } from './services/cards.service.js'
import { getDiscover } from './services/discover.service.js'
import { getHome } from './services/home.service.js'
import { backfillAllMilestones } from './services/milestones.service.js'
import { formatXp } from './services/cardImage.service.js'
import { injectCardMeta, escapeHtml } from './utils/cardMeta.js'

const app = express()
// Behind Render's proxy, needed so req.ip is the visitor (rate limiting).
app.set('trust proxy', 1)

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  }),
)
app.use(express.json())

app.use('/api/players', playersRouter)
app.use('/api', cardsRouter)
app.get('/api/home', async (req, res, next) => {
  try {
    res.json(await getHome())
  } catch (err) {
    next(err)
  }
})
app.get('/api/discover', async (req, res, next) => {
  try {
    res.json(await getDiscover())
  } catch (err) {
    next(err)
  }
})

const PERIOD_ADJ = { day: 'Daily', week: 'Weekly', month: 'Monthly' }
const PERIOD_PHRASE = { day: 'today', week: 'this week', month: 'in the last 30 days' }
const PERIOD_PHRASE_PAST = { day: 'that day', week: 'that week', month: 'over 30 days' }

const SITE_URL = process.env.SITE_URL || 'https://tickgains.com'

// Calculator page text, written next to the frontend bundle at build time (see vite.config.js). Empty in local
// dev, where there is no dist/ yet.
let calculators = []
try {
  calculators = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../dist/calculators.json'), 'utf-8'))
} catch {
  calculators = []
}

// Generated from the live player list rather than a static file, so newly
// tracked (or removed) players show up without a redeploy.
app.get('/sitemap.xml', async (req, res) => {
  let players = []
  try {
    players = await listPlayers()
  } catch (err) {
    console.error('Failed to build sitemap.xml', err)
  }

  // Every public, indexable page with how often it changes and how important it is. Player pages carry the date
  // of their latest snapshot as lastmod. Share cards and parameterised planner links are left out on purpose.
  const today = new Date().toISOString().slice(0, 10)
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const entries = [
    { path: '/', changefreq: 'daily', priority: '1.0', lastmod: today },
    { path: '/discover', changefreq: 'hourly', priority: '0.9', lastmod: today },
    { path: '/leaderboard', changefreq: 'hourly', priority: '0.9', lastmod: today },
    { path: '/planner', changefreq: 'weekly', priority: '0.9' },
    { path: '/calculators', changefreq: 'weekly', priority: '0.9' },
    ...calculators.map((c) => ({ path: `/calculators/${c.slug}`, changefreq: 'weekly', priority: '0.8' })),
    ...players.map((p) => ({
      path: `/player/${encodeURIComponent(p.username)}`,
      changefreq: 'daily',
      priority: '0.6',
      lastmod: p.latest?.capturedAt ? new Date(p.latest.capturedAt).toISOString().slice(0, 10) : undefined,
    })),
    { path: '/about', changefreq: 'monthly', priority: '0.3' },
    { path: '/contact', changefreq: 'monthly', priority: '0.3' },
    { path: '/privacy', changefreq: 'yearly', priority: '0.2' },
  ]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map(
      (e) =>
        `  <url><loc>${esc(SITE_URL + e.path)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}<changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`,
    )
    .join('\n')}\n</urlset>\n`

  res.set('Cache-Control', 'public, max-age=3600')
  res.type('application/xml').send(xml)
})

// In production this one service also serves the built frontend (`npm run
// build` at the repo root outputs to ../dist from here), no separate static
// host or CORS setup needed. In local dev there's no dist/ yet, since the
// frontend runs through Vite's own dev server instead; both middlewares
// below just no-op until it exists.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, '../../dist')
const distExists = existsSync(distPath)

if (distExists) {
  const indexHtmlTemplate = readFileSync(path.join(distPath, 'index.html'), 'utf-8')

  // Share-card pages need their og:image/title/description baked into the
  // actual HTML bytes, served before any JS runs, link-unfurling bots
  // (Discord, Twitter, iMessage, Slack) only ever do a plain GET and read
  // the markup as-is, so setPageMeta()'s client-side DOM updates are
  // invisible to them. These two routes are the only place that happens;
  // everything else still resolves through the plain SPA fallback below.
  // A plain profile link needs the same treatment, Discord/Twitter/iMessage
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
        description = `${player.displayName}, Overall ${latest.overallLevel.toLocaleString('en-US')} (${formatXp(latest.overallXp)} XP). Explore ${player.displayName}'s OSRS stats, XP history, achievements, and progression on TickGains.`
        if (weekly?.xpGained > 0) {
          description += ` +${formatXp(weekly.xpGained)} XP this week.`
        }
      }

      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: `${player.displayName} | OSRS Player Profile | TickGains`,
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

  app.get('/leaderboard', (req, res) => {
    res.send(
      injectCardMeta(indexHtmlTemplate, {
        title: 'OSRS Leaderboard | TickGains',
        description: 'OSRS XP leaderboard: top XP gains today, this week and this month, plus all-time total XP and total level for every tracked player.',
        imageUrl: `${SITE_URL}/og-default.png`,
        pageUrl: `${SITE_URL}/leaderboard`,
      }),
    )
  })

  // Calculator pages: unique title, description, canonical, structured data and crawler-readable text per skill.
  const calcLinks = (skip) =>
    calculators
      .filter((c) => c.slug !== skip)
      .map((c) => `<a href="/calculators/${c.slug}">${escapeHtml(c.name)} calculator</a>`)
      .join(' ')

  app.get('/calculators', (req, res) => {
    const description = 'Free OSRS skill calculators for every skill. Work out the XP, training hours and gp needed to reach your next level, or level 99, with real training methods.'
    res.send(
      injectCardMeta(indexHtmlTemplate, {
        title: 'OSRS Skill Calculators | TickGains',
        description,
        imageUrl: `${SITE_URL}/og-default.png`,
        pageUrl: `${SITE_URL}/calculators`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'OSRS Skill Calculators',
          url: `${SITE_URL}/calculators`,
          description,
          hasPart: calculators.map((c) => ({ '@type': 'WebApplication', name: `OSRS ${c.name} Calculator`, url: `${SITE_URL}/calculators/${c.slug}` })),
        },
        bodyHtml: `<main><h1>OSRS Skill Calculators</h1><p>${escapeHtml(description)}</p><nav>${calcLinks('')}</nav><p><a href="/planner">Account Planner</a></p></main>`,
      }),
    )
  })

  app.get('/calculators/:slug', (req, res) => {
    const slug = req.params.slug
    const calc = calculators.find((c) => c.slug === slug.toLowerCase())
    if (!calc) return res.sendFile(path.join(distPath, 'index.html'))
    // One canonical URL per calculator: other casings redirect.
    if (slug !== calc.slug) return res.redirect(301, `/calculators/${calc.slug}`)
    const pageUrl = `${SITE_URL}/calculators/${calc.slug}`
    res.send(
      injectCardMeta(indexHtmlTemplate, {
        title: calc.title,
        description: calc.description,
        imageUrl: `${SITE_URL}/og-default.png`,
        pageUrl,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: `OSRS ${calc.name} Calculator`,
            url: pageUrl,
            description: calc.description,
            applicationCategory: 'UtilitiesApplication',
            operatingSystem: 'Any',
            isAccessibleForFree: true,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Calculators', item: `${SITE_URL}/calculators` },
              { '@type': 'ListItem', position: 2, name: calc.name, item: pageUrl },
            ],
          },
        ],
        bodyHtml: `<main><h1>OSRS ${escapeHtml(calc.name)} Calculator</h1><p>${escapeHtml(calc.lead)}</p>${calc.guide.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}<nav>${calcLinks(calc.slug)}</nav><p><a href="/calculators">All calculators</a> · <a href="/planner">Account Planner</a></p></main>`,
      }),
    )
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
    // the bare page keeps the generic one. Query parsing is defensive,
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
      description = `${who ? `${who}'s` : 'A'} OSRS training plan for ${skills.join(', ')}, XP remaining, training hours, GP and days to finish, built with the TickGains Account Planner.`
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
      const period = normalizePeriod(req.query.period)
      const data = await getWeeklyCardData(player.id, skill, period)
      const qs = new URLSearchParams()
      if (data && data.skill !== 'Overall') qs.set('skill', data.skill)
      if (period !== 'week') qs.set('period', period)
      const skillQuery = qs.toString() ? `?${qs.toString()}` : ''
      const pageUrl = `${SITE_URL}/player/${encodeURIComponent(player.username)}/card/weekly${skillQuery}`
      const imageUrl = `${SITE_URL}/api/players/${encodeURIComponent(player.username)}/card/weekly/image.png${skillQuery}`
      const skillLabel = data && data.skill !== 'Overall' ? ` ${data.skill}` : ''
      const description = data
        ? `${player.displayName} gained ${formatXp(data.xpGained)}${skillLabel} XP ${PERIOD_PHRASE[period]} on TickGains.`
        : `${player.displayName}'s OSRS progress on TickGains.`

      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: `${player.displayName}'s ${PERIOD_ADJ[period]}${skillLabel} XP Gains | TickGains`,
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
      const cardPeriod = normalizePeriod(card.period)
      const description = `${card.displayName} gained ${formatXp(card.xpGained)}${skillLabel} XP ${PERIOD_PHRASE_PAST[cardPeriod]} on TickGains.`

      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: `${card.displayName}'s ${PERIOD_ADJ[cardPeriod]}${skillLabel} XP Gains | TickGains`,
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
  if (!distExists) console.log('(no dist/ build found, run `npm run build` at the repo root to serve the frontend too)')
})

startScheduler()
// Warm the cached homepage/Discover data so the first visitor doesn't pay for it.
getHome().catch(() => {})
// Reconstruct achievements/milestones for players tracked before they existed (idempotent).
backfillAllMilestones().catch((err) => console.error('[milestones] backfill failed:', err))
