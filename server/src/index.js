import 'dotenv/config'
import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { playersRouter } from './routes/players.routes.js'
import { cardsRouter } from './routes/cards.routes.js'
import { subscribersRouter } from './routes/subscribers.routes.js'
import { recordsRouter } from './routes/records.routes.js'
import { topGainerRouter } from './routes/topGainer.routes.js'
import { feedbackRouter } from './routes/feedback.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { claimsRouter } from './routes/claims.routes.js'
import { notificationsRouter } from './routes/notifications.routes.js'
import { challengesRouter } from './routes/challenges.routes.js'
import { followsRouter } from './routes/follows.routes.js'
import { profilePagesRouter } from './routes/profilePages.routes.js'
import { goalsRouter } from './routes/goals.routes.js'
import { plansRouter } from './routes/plans.routes.js'
import { clansRouter } from './routes/clans.routes.js'
import { getClanSeo, getInviteCardData, listClansForSitemap } from './services/clans.service.js'
import { describeInvite } from './utils/clans.js'
import { statsRouter } from './routes/stats.routes.js'
import { geRouter } from './routes/ge.routes.js'
import { getItemBySlug, getItemIndex, listItemsForSitemap } from './services/ge.service.js'
import { pickMovers } from './utils/ge.js'
import { getPublicShare } from './services/sharedPlans.service.js'
import { startScheduler } from './jobs/sync.js'
import { startCompetitionJob } from './jobs/competitions.js'
import { startEventsPurgeJob } from './jobs/purgeEvents.js'
import { startClaimReminderJob } from './jobs/claimReminders.js'
import { startClaimNudgeJob } from './jobs/claimNudges.js'
import { startGePricesJob } from './jobs/gePrices.js'
import { listPlayers, getPlayerByUsername, getLatestSnapshot } from './services/players.service.js'
import { getWeeklyCardData, getFrozenCard, normalizePeriod } from './services/cards.service.js'
import { getDiscover } from './services/discover.service.js'
import { getPlayerRecords } from './services/records.service.js'
import { getTopGainerStats } from './services/topGainers.service.js'
import { topGainerHeadline } from './utils/topGainers.js'
import { getGoal } from './services/goals.service.js'
import { getLevel99Card } from './services/level99.service.js'
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
    // The sign-in cookie must travel with requests from the dev server (another port). In production the app and the
    // API share one origin, so this changes nothing there.
    credentials: true,
  }),
)
// Bigger than the default so saved plans can be synced; every endpoint still validates what it accepts.
app.use(express.json({ limit: '700kb' }))

app.use('/api/players', playersRouter)
app.use('/api', cardsRouter)
app.use('/api', recordsRouter)
app.use('/api', topGainerRouter)
app.use('/api', feedbackRouter)
app.use('/api/newsletter', subscribersRouter)
app.use('/api/auth', authRouter)
app.use('/api', claimsRouter)
app.use('/api', notificationsRouter)
app.use('/api', challengesRouter)
app.use('/api', followsRouter)
app.use('/api', profilePagesRouter)
app.use('/api', goalsRouter)
app.use('/api', plansRouter)
app.use('/api', clansRouter)
app.use('/api', statsRouter)
app.use('/api', geRouter)
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
// Goal pages such as /calculators/agility/1-to-99 (computed at build time, see vite.config.js).
let goalPages = []
try {
  goalPages = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../dist/calculator-goals.json'), 'utf-8'))
} catch {
  goalPages = []
}
const goalPagesBySkill = new Map()
for (const g of goalPages) {
  if (!goalPagesBySkill.has(g.slug)) goalPagesBySkill.set(g.slug, [])
  goalPagesBySkill.get(g.slug).push(g)
}
const goalPageByPath = new Map(goalPages.map((g) => [g.path, g]))
// Plan guide pages (/plans/max-cape) and the XP table (/osrs-xp-table), also computed at build time (see vite.config.js).
const readBuilt = (name, fallback) => {
  try {
    return JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), `../../dist/${name}`), 'utf-8'))
  } catch {
    return fallback
  }
}
const planGuides = readBuilt('plan-guides.json', [])
const planGuideByPath = new Map(planGuides.map((g) => [g.path, g]))
const xpTable = readBuilt('xp-table.json', null)

// Generated from the live player list rather than a static file, so newly
// tracked (or removed) players show up without a redeploy.
app.get('/sitemap.xml', async (req, res) => {
  let players = []
  let clans = []
  let items = { slugs: [], updatedAt: null }
  try {
    players = await listPlayers()
  } catch (err) {
    console.error('Failed to build sitemap.xml', err)
  }
  try {
    clans = await listClansForSitemap()
  } catch (err) {
    console.error('Failed to list clans for sitemap.xml', err)
  }
  try {
    items = await listItemsForSitemap()
  } catch (err) {
    console.error('Failed to list items for sitemap.xml', err)
  }

  // Every public, indexable page with how often it changes and how important it is. Player pages carry the date
  // of their latest snapshot as lastmod. Share cards and parameterised planner links are left out on purpose.
  const today = new Date().toISOString().slice(0, 10)
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const entries = [
    { path: '/', changefreq: 'daily', priority: '1.0', lastmod: today },
    { path: '/discover', changefreq: 'hourly', priority: '0.9', lastmod: today },
    { path: '/leaderboard', changefreq: 'hourly', priority: '0.9', lastmod: today },
    { path: '/compare', changefreq: 'weekly', priority: '0.6' },
    { path: '/planner', changefreq: 'weekly', priority: '0.9' },
    { path: '/clans', changefreq: 'daily', priority: '0.7', lastmod: today },
    { path: '/items', changefreq: 'hourly', priority: '0.8', lastmod: today },
    { path: '/calculators', changefreq: 'weekly', priority: '0.9' },
    ...calculators.map((c) => ({ path: `/calculators/${c.slug}`, changefreq: 'weekly', priority: '0.8' })),
    ...goalPages.map((g) => ({ path: g.path, changefreq: 'monthly', priority: g.from === 1 && g.to === 99 ? '0.8' : '0.7' })),
    ...(xpTable ? [{ path: xpTable.path, changefreq: 'monthly', priority: '0.8' }] : []),
    ...(planGuides.length ? [{ path: '/plans', changefreq: 'monthly', priority: '0.8' }] : []),
    ...planGuides.map((g) => ({ path: g.path, changefreq: 'monthly', priority: '0.7' })),
    ...players.map((p) => ({
      path: `/player/${encodeURIComponent(p.username)}`,
      changefreq: 'daily',
      priority: '0.6',
      lastmod: p.latest?.capturedAt ? new Date(p.latest.capturedAt).toISOString().slice(0, 10) : undefined,
    })),
    ...clans.map((c) => ({ path: `/clans/${encodeURIComponent(c.slug)}`, changefreq: 'weekly', priority: '0.5', lastmod: c.lastmod })),
    // The Grand Exchange pages (about 4,500 items, well under the 50,000 a sitemap file may list).
    ...items.slugs.map((slug) => ({ path: `/items/${slug}`, changefreq: 'daily', priority: '0.4', lastmod: items.updatedAt ? items.updatedAt.slice(0, 10) : undefined })),
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
      // The preview picture is drawn per player (see services/profileCard.service.js). The ?v= changes with every new
      // snapshot and picture, so Discord and X fetch a fresh one instead of showing an old copy.
      const version = latest ? `${new Date(latest.capturedAt).getTime()}` : ''
      const imageUrl = latest
        ? `${SITE_URL}/api/players/${encodeURIComponent(player.username)}/card/profile/image.png?v=${version}`
        : `${SITE_URL}/og-default.png`

      let description = `Explore ${player.displayName}'s Old School RuneScape stats, XP history, achievements, and progression on TickGains.`
      if (latest) {
        const top = Object.entries(latest.skills || {}).sort((x, y) => y[1].level - x[1].level || y[1].xp - x[1].xp)[0]
        const parts = [`Total level ${latest.overallLevel.toLocaleString('en-US')}`, `${formatXp(latest.overallXp)} XP`]
        if (latest.overallRank > 0) parts.push(`rank #${latest.overallRank.toLocaleString('en-US')}`)
        description = `${parts.join(' · ')}.`
        if (weekly?.xpGained > 0) description += ` +${formatXp(weekly.xpGained)} XP this week.`
        if (top) description += ` Highest skill: ${top[0]} ${top[1].level}.`
        description += ` See ${player.displayName}'s XP history, records and goals on TickGains.`
      }

      res.send(
        injectCardMeta(indexHtmlTemplate, {
          // No level or other changing number in the title: analytics groups page views by title, so one profile must always have the same one.
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

  // A shared personal record. The SPA sends the visitor on to the profile's Records tab; this only gives link
  // previews (Discord, X, iMessage) the record's own title and image. Pages for single records are noindex.
  app.get('/player/:username/records/:key?', async (req, res, next) => {
    try {
      const player = await getPlayerByUsername(req.params.username)
      if (!player) return res.sendFile(path.join(distPath, 'index.html'))
      const key = req.params.key || ''
      const { records } = await getPlayerRecords(player)
      const record = records.find((r) => r.key === key && !r.locked) || null
      const base = `${SITE_URL}/player/${encodeURIComponent(player.username)}`
      const pageUrl = record ? `${base}/records/${encodeURIComponent(record.key)}` : `${base}?tab=records`
      const title = record
        ? `${player.displayName}'s record: ${record.headline} | TickGains`
        : `${player.displayName}'s OSRS Personal Records | TickGains`
      const description = record
        ? `${player.displayName} set a personal record in Old School RuneScape: ${record.headline}. Think you can beat it? Track your own records on TickGains.`
        : `${player.displayName}'s biggest days, longest streaks and best skill sessions in Old School RuneScape, tracked on TickGains.`
      const imageUrl = record
        ? `${SITE_URL}/api/players/${encodeURIComponent(player.username)}/records/${encodeURIComponent(record.key)}/image.png`
        : `${SITE_URL}/og-default.png`
      res.send(injectCardMeta(indexHtmlTemplate, { title, description, imageUrl, pageUrl, noindex: true }))
    } catch (err) {
      next(err)
    }
  })

  // A shared "days as top gainer" count. The SPA sends the visitor on to the profile; this gives the link its preview card.
  app.get('/player/:username/top-gainer', async (req, res, next) => {
    try {
      const player = await getPlayerByUsername(req.params.username)
      if (!player) return res.sendFile(path.join(distPath, 'index.html'))
      const stats = await getTopGainerStats(player)
      const base = `${SITE_URL}/player/${encodeURIComponent(player.username)}`
      const title = stats.days ? `${player.displayName}: ${topGainerHeadline(stats)} | TickGains` : `${player.displayName} on TickGains`
      const description = stats.days
        ? `${player.displayName} has had the most XP gained of any tracked Old School RuneScape player on ${stats.days} ${stats.days === 1 ? 'day' : 'days'}. Think you can top it? Track your own XP on TickGains.`
        : `${player.displayName}'s Old School RuneScape XP history, records and goals on TickGains.`
      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title,
          description,
          imageUrl: stats.days ? `${SITE_URL}/api/players/${encodeURIComponent(player.username)}/top-gainer/image.png` : `${SITE_URL}/og-default.png`,
          pageUrl: `${base}/top-gainer`,
          noindex: true,
        }),
      )
    } catch (err) {
      next(err)
    }
  })

  // A shared goal. The SPA sends the visitor on to the profile's Goals tab; this gives the link its preview card.
  app.get('/player/:username/goals/:id', async (req, res, next) => {
    try {
      const player = await getPlayerByUsername(req.params.username)
      if (!player) return res.sendFile(path.join(distPath, 'index.html'))
      const goal = await getGoal(player.id, Number(req.params.id))
      const base = `${SITE_URL}/player/${encodeURIComponent(player.username)}`
      const title = goal ? `${player.displayName}'s goal: ${goal.title} | TickGains` : `${player.displayName}'s goals | TickGains`
      const description = goal
        ? goal.reached
          ? `${player.displayName} reached their goal of ${goal.title} in Old School RuneScape. Follow their progress on TickGains.`
          : `${player.displayName} is ${goal.percent}% of the way to ${goal.title} in Old School RuneScape. Follow their progress on TickGains.`
        : `${player.displayName}'s Old School RuneScape goals on TickGains.`
      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title,
          description,
          imageUrl: goal ? `${SITE_URL}/api/players/${encodeURIComponent(player.username)}/goals/${goal.id}/image.png` : `${SITE_URL}/og-default.png`,
          pageUrl: goal ? `${base}/goals/${goal.id}` : `${base}?tab=goals`,
          noindex: true,
        }),
      )
    } catch (err) {
      next(err)
    }
  })

  // A shared level 99. The SPA sends the visitor on to the profile; this gives the link its congratulations card.
  app.get('/player/:username/level-99/:skill', async (req, res, next) => {
    try {
      const player = await getPlayerByUsername(req.params.username)
      if (!player) return res.sendFile(path.join(distPath, 'index.html'))
      const card = await getLevel99Card(player, req.params.skill)
      const base = `${SITE_URL}/player/${encodeURIComponent(player.username)}`
      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: card ? `${player.displayName} reached level 99 ${card.skill} | TickGains` : `${player.displayName} | TickGains`,
          description: card ? `${player.displayName} just reached level 99 ${card.skill} in Old School RuneScape. Follow their progress on TickGains.` : `${player.displayName}'s Old School RuneScape profile on TickGains.`,
          imageUrl: card ? `${SITE_URL}/api/players/${encodeURIComponent(player.username)}/card/level99/image.png?skill=${encodeURIComponent(card.skill)}` : `${SITE_URL}/og-default.png`,
          pageUrl: card ? `${base}/level-99/${encodeURIComponent(card.skill)}` : base,
          noindex: true,
        }),
      )
    } catch (err) {
      next(err)
    }
  })

  // A shared plan. The SPA draws the page; this gives the link its preview card. Plans are user content, so noindex.
  app.get('/plan/:slug', async (req, res, next) => {
    try {
      const share = await getPublicShare(req.params.slug).catch(() => null)
      if (!share) return res.sendFile(path.join(distPath, 'index.html'))
      const s = share.summary || {}
      const hours = s.totalHours == null ? null : s.totalHours >= 100 ? `${Math.round(s.totalHours).toLocaleString('en-US')} hours` : `${parseFloat(s.totalHours.toFixed(1))} hours`
      const skills = (s.goals || []).length || share.plan.goals.length
      const by = share.rsn ? ` by ${share.rsn}` : ''
      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: `${share.name}${by} | TickGains training plan`,
          description: `An Old School RuneScape training plan${by}: ${skills} skill goal${skills === 1 ? '' : 's'}${hours ? `, about ${hours} of training` : ''}${s.days != null ? ` (${s.days.toLocaleString('en-US')} days at ${share.plan.hoursPerDay} h/day)` : ''}. Open it, or use it as a starting point for your own plan on TickGains.`,
          imageUrl: `${SITE_URL}/api/plans/public/${share.slug}/card.png?v=${new Date(share.updatedAt).getTime()}`,
          pageUrl: `${SITE_URL}/plan/${share.slug}`,
          noindex: true,
        }),
      )
    } catch (err) {
      next(err)
    }
  })

  // A challenge link ("beat my week"). The SPA sends the visitor on to Compare; this gives the link its preview.
  // Challenge pages are noindex, they exist to be sent to a friend.
  app.get('/challenge/:username', async (req, res, next) => {
    try {
      const player = await getPlayerByUsername(req.params.username)
      if (!player) return res.sendFile(path.join(distPath, 'index.html'))
      const weekly = await getWeeklyCardData(player.id, 'Overall', 'week').catch(() => null)
      const name = player.displayName
      const gained = weekly?.xpGained > 0
      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: `${name} challenges you | TickGains`,
          description: gained
            ? `${name} gained ${formatXp(weekly.xpGained)} XP in Old School RuneScape this week. Think you can beat it? Compare your week head to head on TickGains, no sign-up needed.`
            : `${name} is challenging you in Old School RuneScape. Compare your stats head to head on TickGains, no sign-up needed.`,
          imageUrl: weekly ? `${SITE_URL}/api/players/${encodeURIComponent(player.username)}/challenge/image.png` : `${SITE_URL}/og-default.png`,
          pageUrl: `${SITE_URL}/challenge/${encodeURIComponent(player.username)}`,
          noindex: true,
        }),
      )
    } catch (err) {
      next(err)
    }
  })

  // Account pages are for one person each, so they are left out of search results. (The SPA also sets this once it
  // loads; this is what a crawler sees on the very first byte.)
  for (const [route, title] of [['/login', 'Log in'], ['/signup', 'Create an account'], ['/forgot-password', 'Reset your password'], ['/reset-password', 'Choose a new password'], ['/verify-email', 'Confirm your email'], ['/admin/claims', 'Profile claims'], ['/account', 'Your account']]) {
    app.get(route, (req, res) => {
      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: `${title} | TickGains`,
          description: 'Log in or create a TickGains account to keep your settings on every device.',
          imageUrl: `${SITE_URL}/og-default.png`,
          pageUrl: `${SITE_URL}${route}`,
          noindex: true,
        }),
      )
    })
  }

  // Crawler-readable text for pages whose real content is drawn by the app: a heading, a line of intro and a few links.
  // The app replaces all of it when it loads, so visitors never see this copy.
  const OTHER_PAGES = [
    ['/discover', 'Discover players'],
    ['/leaderboard', 'Leaderboard'],
    ['/planner', 'Account Planner'],
    ['/calculators', 'Skill calculators'],
    ['/clans', 'Clans'],
    ['/items', 'Grand Exchange prices'],
    ['/compare', 'Compare players'],
    ['/osrs-xp-table', 'OSRS XP table'],
    ['/plans', 'Plan guides'],
  ]
  const pageBody = (h1, paragraphs, skip = '') =>
    `<main><h1>${escapeHtml(h1)}</h1>${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}<nav>${OTHER_PAGES.filter(([href]) => href !== skip)
      .map(([href, label]) => `<a href="${href}">${label}</a>`)
      .join(' ')}</nav></main>`
  const plainPage = (res, { title, description, path: pagePath, h1, paragraphs, image = '/og-default.png' }) =>
    res.send(
      injectCardMeta(indexHtmlTemplate, {
        title,
        description,
        imageUrl: `${SITE_URL}${image}`,
        pageUrl: pagePath === '/' ? `${SITE_URL}/` : `${SITE_URL}${pagePath}`,
        bodyHtml: pageBody(h1, paragraphs, pagePath),
      }),
    )

  // The home page, and the three info pages. Without their own tags the info pages showed the home page's title and
  // canonical to anything that does not run scripts.
  const HOME_DESCRIPTION = 'Free OSRS XP tracker: hourly updates, XP gains and hiscores history for any player, no sign-up. Plan your next 99 with the Account Planner.'
  app.get('/', (req, res) =>
    plainPage(res, {
      title: 'OSRS XP Tracker & Hiscores History | TickGains',
      description: HOME_DESCRIPTION,
      path: '/',
      h1: 'OSRS XP Tracker and Hiscores History',
      paragraphs: [
        'TickGains is a free Old School RuneScape XP tracker. Enter any username to see XP gains, level-ups, records and hiscores history, saved hourly while a player is active. No sign-up needed.',
        'Plan your next 99 with the Account Planner, work out hours and GP with the skill calculators, compare players and race your clan in XP competitions.',
      ],
    }),
  )
  app.get('/about', (req, res) =>
    plainPage(res, {
      title: 'About TickGains: Free OSRS XP Tracker | TickGains',
      description: 'TickGains is a free OSRS XP tracker: automatic hiscores snapshots, historical imports, an account planner and player discovery, no sign-up.',
      path: '/about',
      h1: 'About TickGains',
      paragraphs: [
        "TickGains is a free tracker for Old School RuneScape. Enter any OSRS username and it saves a snapshot of that player's public hiscores every hour while they are active, so you can see XP gains, level-ups and milestones over time.",
        'It is a fan project and is not affiliated with Jagex Ltd.',
      ],
    }),
  )
  app.get('/contact', (req, res) =>
    plainPage(res, {
      title: 'Contact TickGains: Feedback and Bug Reports | TickGains',
      description: 'Contact TickGains with feedback, bug reports or a request to remove a tracked username. The Discord is the quickest way to reach us.',
      path: '/contact',
      h1: 'Contact TickGains',
      paragraphs: ['Found a bug, have an idea, or want a tracked username removed? Join the TickGains Discord or use the feedback button on any page.'],
    }),
  )
  app.get('/privacy', (req, res) =>
    plainPage(res, {
      title: 'Privacy Policy | TickGains',
      description: 'How TickGains handles data: public OSRS hiscores snapshots, optional accounts, an optional email list and usage analytics.',
      path: '/privacy',
      h1: 'TickGains Privacy Policy',
      paragraphs: ['How TickGains handles data: public OSRS hiscores snapshots, optional accounts, an optional email list, a simple record of what is used, and analytics.'],
    }),
  )

  // Player comparison. The landing page is indexable; a specific pairing is an endless set of user-chosen URLs, so
  // those carry noindex (they still unfurl nicely in Discord and X, which is what they are shared for).
  const compareDescription = 'Compare two Old School RuneScape players side by side: XP gained, levels, rank movement and how consistently each one trains.'
  app.get('/compare', (req, res) => {
    res.send(
      injectCardMeta(indexHtmlTemplate, {
        title: 'Compare OSRS Players | TickGains',
        description: compareDescription,
        imageUrl: `${SITE_URL}/og-default.png`,
        pageUrl: `${SITE_URL}/compare`,
        bodyHtml: pageBody('Compare OSRS Players', [compareDescription], '/compare'),
      }),
    )
  })

  app.get('/compare/:a/:b?', async (req, res, next) => {
    try {
      const { a, b } = req.params
      if (!b) {
        return res.send(
          injectCardMeta(indexHtmlTemplate, {
            title: 'Compare OSRS Players | TickGains',
            description: compareDescription,
            imageUrl: `${SITE_URL}/og-default.png`,
            pageUrl: `${SITE_URL}/compare`,
            noindex: true,
          }),
        )
      }
      const [pa, pb] = await Promise.all([getPlayerByUsername(a), getPlayerByUsername(b)])
      const [wa, wb] = await Promise.all([
        pa ? getWeeklyCardData(pa.id, 'Overall').catch(() => null) : null,
        pb ? getWeeklyCardData(pb.id, 'Overall').catch(() => null) : null,
      ])
      const nameA = (pa?.displayName || a).slice(0, 12)
      const nameB = (pb?.displayName || b).slice(0, 12)
      let description = `${nameA} vs ${nameB} in Old School RuneScape: XP gained, levels, rank movement and training consistency, side by side on TickGains.`
      if (wa && wb) description = `${nameA} gained ${formatXp(wa.xpGained)} XP and ${nameB} gained ${formatXp(wb.xpGained)} XP in the last 7 days. See the full head-to-head on TickGains.`
      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: `${nameA} vs ${nameB} | OSRS XP Comparison | TickGains`,
          description,
          imageUrl: `${SITE_URL}/og-default.png`,
          pageUrl: `${SITE_URL}/compare/${encodeURIComponent(nameA)}/${encodeURIComponent(nameB)}`,
          noindex: true,
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
        bodyHtml: pageBody('OSRS Leaderboard', ['OSRS XP leaderboard: top XP gains today, this week and this month, plus all-time total XP and total level for every tracked player.'], '/leaderboard'),
      }),
    )
  })

  // Calculator pages: unique title, description, canonical, structured data and crawler-readable text per skill.
  const calcLinks = (skip) =>
    calculators
      .filter((c) => c.slug !== skip)
      .map((c) => `<a href="/calculators/${c.slug}">${escapeHtml(c.name)} calculator</a>`)
      .join(' ')

  // Links to every goal page of one skill, skipping the page being shown.
  const goalLinksHtml = (slug, skipGoal) => {
    const list = (goalPagesBySkill.get(slug) || []).filter((g) => g.path.split('/').pop() !== skipGoal)
    return list.length ? `<nav><h2>Popular goals</h2>${list.map((g) => `<a href="${g.path}">${escapeHtml(g.skill)} ${escapeHtml(g.label)}</a>`).join(' ')}</nav>` : ''
  }

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
        bodyHtml: `<main><h1>OSRS ${escapeHtml(calc.name)} Calculator</h1><p>${escapeHtml(calc.lead)}</p>${calc.guide.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}${goalLinksHtml(calc.slug, '')}<nav>${calcLinks(calc.slug)}</nav><p><a href="/calculators">All calculators</a> · <a href="/planner">Account Planner</a></p></main>`,
      }),
    )
  })

  // Per-goal pages: the quick answer, route and method tables, milestones and FAQ, in HTML a crawler can read
  // before any script runs, plus FAQPage and breadcrumb structured data.
  app.get('/calculators/:slug/:goal', (req, res) => {
    const { slug, goal } = req.params
    const page = goalPageByPath.get(`/calculators/${slug.toLowerCase()}/${goal.toLowerCase()}`)
    if (!page) {
      // Unknown goal: fall back to the skill page (or the directory), never a soft 404.
      const calc = calculators.find((c) => c.slug === slug.toLowerCase())
      return res.redirect(302, calc ? `/calculators/${calc.slug}` : '/calculators')
    }
    if (slug !== page.slug || goal !== page.path.split('/').pop()) return res.redirect(301, page.path)
    const pageUrl = `${SITE_URL}${page.path}`
    const table = (head, rows) =>
      `<table><thead><tr>${head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    const fast = page.routes.find((r) => r.id === 'fast')
    const sameGoal = goalPages.filter((g) => g.from === page.from && g.to === page.to && g.slug !== page.slug && g.category === page.category).slice(0, 8)
    res.send(
      injectCardMeta(indexHtmlTemplate, {
        title: page.title,
        description: page.description,
        imageUrl: `${SITE_URL}/og-default.png`,
        pageUrl,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: page.title.replace(' | TickGains', ''),
            url: pageUrl,
            description: page.description,
            isPartOf: { '@type': 'WebSite', name: 'TickGains', url: SITE_URL },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: page.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Calculators', item: `${SITE_URL}/calculators` },
              { '@type': 'ListItem', position: 2, name: page.skill, item: `${SITE_URL}/calculators/${page.slug}` },
              { '@type': 'ListItem', position: 3, name: page.label, item: pageUrl },
            ],
          },
        ],
        bodyHtml: `<main><h1>${escapeHtml(page.h1)}</h1><p>${escapeHtml(page.lead)}</p><h2>Quick answer</h2><p>${escapeHtml(page.summary)}</p>${table(
          ['Route', 'Time', 'Net GP'],
          page.routes.map((r) => [r.label, r.hoursText, r.gpText]),
        )}<h2>Fastest route, level by level</h2>${table(
          ['Levels', 'Method', 'XP', 'XP per hour', 'Time'],
          fast.steps.map((s) => [`${s.from} to ${s.to}`, s.method, s.xp.toLocaleString('en-US'), s.xpPerHour.toLocaleString('en-US'), s.hoursText]),
        )}<h2>${escapeHtml(page.skill)} methods</h2>${table(
          ['Method', 'Levels', 'XP per hour', 'GP per hour'],
          page.methods.map((m) => [m.name, `${m.minLevel}${m.maxLevel != null ? ` to ${m.maxLevel}` : '+'}`, m.xpPerHour.toLocaleString('en-US'), m.gpText]),
        )}<h2>XP milestones</h2>${table(
          ['Level', 'Total XP', `XP from level ${page.from}`],
          page.milestones.map((m) => [String(m.level), m.totalXp.toLocaleString('en-US'), m.fromStart.toLocaleString('en-US')]),
        )}<h2>Common questions</h2>${page.faq.map((f) => `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`).join('')}${goalLinksHtml(page.slug, page.path.split('/').pop())}<nav>${sameGoal
          .map((g) => `<a href="${g.path}">${escapeHtml(g.skill)} ${escapeHtml(g.label)}</a>`)
          .join(' ')}</nav><p><a href="/calculators/${page.slug}">${escapeHtml(page.skill)} calculator</a> · <a href="/calculators">All calculators</a> · <a href="/planner">Account Planner</a></p></main>`,
      }),
    )
  })

  // The XP table, in HTML a crawler can read before any script runs.
  if (xpTable) {
    app.get(xpTable.path, (req, res) => {
      const pageUrl = `${SITE_URL}${xpTable.path}`
      const num = (n) => n.toLocaleString('en-US')
      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: xpTable.title,
          description: xpTable.description,
          imageUrl: `${SITE_URL}/og-default.png`,
          pageUrl,
          jsonLd: [
            { '@context': 'https://schema.org', '@type': 'WebPage', name: xpTable.title.replace(' | TickGains', ''), url: pageUrl, description: xpTable.description, isPartOf: { '@type': 'WebSite', name: 'TickGains', url: SITE_URL } },
            { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: xpTable.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
          ],
          bodyHtml: `<main><h1>${escapeHtml(xpTable.h1)}</h1><p>${escapeHtml(xpTable.lead)}</p><table><thead><tr><th>Level</th><th>Total XP</th><th>XP to next level</th></tr></thead><tbody>${xpTable.rows
            .map((r) => `<tr><td>${r.level}</td><td>${num(r.xp)}</td><td>${r.toNext == null ? '' : num(r.toNext)}</td></tr>`)
            .join('')}</tbody></table><h2>Common questions</h2>${xpTable.faq.map((f) => `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`).join('')}<p><a href="/calculators">Skill calculators</a> · <a href="/plans">Plan guides</a> · <a href="/planner">Account Planner</a></p></main>`,
        }),
      )
    })
  }

  // Plan guides: an index, and one page per whole-account goal.
  if (planGuides.length) {
    app.get('/plans', (req, res) => {
      const description = 'OSRS plan guides: how long and how much XP a max cape, all 90s, all 70s or a total level goal takes, ready to open in the Account Planner.'
      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: 'OSRS Plan Guides: Max Cape, All 90s, Total Level | TickGains',
          description,
          imageUrl: `${SITE_URL}/og-default.png`,
          pageUrl: `${SITE_URL}/plans`,
          bodyHtml: `<main><h1>OSRS Plan Guides</h1><p>${escapeHtml(description)}</p><ul>${planGuides
            .map((g) => `<li><a href="${g.path}">${escapeHtml(g.h1)}</a>: ${escapeHtml(g.summary)}</li>`)
            .join('')}</ul><p><a href="/planner">Account Planner</a> · <a href="/calculators">Skill calculators</a> · <a href="/osrs-xp-table">OSRS XP table</a></p></main>`,
        }),
      )
    })

    app.get('/plans/:slug', (req, res) => {
      const page = planGuideByPath.get(`/plans/${String(req.params.slug).toLowerCase()}`)
      if (!page) return res.redirect(302, '/plans')
      if (req.params.slug !== page.slug) return res.redirect(301, page.path)
      const pageUrl = `${SITE_URL}${page.path}`
      const num = (n) => n.toLocaleString('en-US')
      const others = planGuides.filter((g) => g.slug !== page.slug)
      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: page.title,
          description: page.description,
          imageUrl: `${SITE_URL}/og-default.png`,
          pageUrl,
          jsonLd: [
            { '@context': 'https://schema.org', '@type': 'WebPage', name: page.title.replace(' | TickGains', ''), url: pageUrl, description: page.description, isPartOf: { '@type': 'WebSite', name: 'TickGains', url: SITE_URL } },
            { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: page.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Plan guides', item: `${SITE_URL}/plans` },
                { '@type': 'ListItem', position: 2, name: page.name, item: pageUrl },
              ],
            },
          ],
          bodyHtml: `<main><h1>${escapeHtml(page.h1)}</h1><p>${escapeHtml(page.lead)}</p><h2>Quick answer</h2><p>${escapeHtml(page.summary)}</p><h2>Skill by skill, in training order</h2><table><thead><tr><th>Order</th><th>Skill</th><th>Levels</th><th>XP</th><th>Time</th><th>Net GP</th></tr></thead><tbody>${page.skills
            .map((s) => `<tr><td>${s.order}</td><td><a href="${s.calcPath}">${escapeHtml(s.skill)}</a></td><td>${s.from} to ${s.to}</td><td>${num(s.xp)}</td><td>${escapeHtml(s.hoursText)}</td><td>${escapeHtml(s.gpText)}</td></tr>`)
            .join('')}</tbody></table><p><a href="${escapeHtml(page.plannerHref)}">Open this plan in the Account Planner</a></p><h2>Common questions</h2>${page.faq.map((f) => `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`).join('')}<nav><h2>More plan guides</h2>${others
            .map((g) => `<a href="${g.path}">${escapeHtml(g.name)}</a>`)
            .join(' ')}</nav><p><a href="/plans">All plan guides</a> · <a href="/osrs-xp-table">OSRS XP table</a> · <a href="/calculators">Skill calculators</a></p></main>`,
        }),
      )
    })
  }

  // The Clans page and each clan's page get their title and description in the HTML itself (they are in the sitemap), not only
  // after the app has loaded. Every clan is listed, so these are indexable.
  app.get('/clans', (req, res) => {
    res.send(
      injectCardMeta(indexHtmlTemplate, {
        title: 'OSRS Clans: XP Competitions and Weekly Leaders | TickGains',
        description: 'Old School RuneScape clans on TickGains: XP competitions, weekly leaders and who is on top. Start a clan and invite your friends.',
        imageUrl: `${SITE_URL}/og-default.png`,
        pageUrl: `${SITE_URL}/clans`,
        bodyHtml: pageBody('OSRS Clans and XP Competitions', ['Old School RuneScape clans on TickGains: XP competitions, weekly leaders and who is on top. Start a clan and invite your friends.'], '/clans'),
      }),
    )
  })

  // Grand Exchange prices. The list page is indexable; each item has its own page with the live price in its title and description.
  const gp = (v) => (v == null ? 'no price yet' : `${Number(v).toLocaleString('en-US')} gp`)
  const signed = (v) => (v == null ? null : `${v > 0 ? '+' : ''}${v}%`)
  app.get('/items', async (req, res, next) => {
    try {
      const description = 'Live Old School RuneScape Grand Exchange prices for every tradeable item, with price history, trends, buy limits and flipping margins after tax.'
      let list = ''
      try {
        const { items } = await getItemIndex()
        list = `<ul>${pickMovers(items, 'traded', { limit: 100 }).map((i) => `<li><a href="/items/${i.slug}">${escapeHtml(i.name)}</a>: ${gp(i.price)}</li>`).join('')}</ul>`
      } catch {
        /* the page still works without the list */
      }
      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: 'OSRS Grand Exchange Prices and Trends | TickGains',
          description,
          imageUrl: `${SITE_URL}/og-default.png`,
          pageUrl: `${SITE_URL}/items`,
          bodyHtml: `<main><h1>OSRS Grand Exchange prices</h1><p>${escapeHtml(description)}</p>${list}</main>`,
        }),
      )
    } catch (err) {
      next(err)
    }
  })
  app.get('/items/:slug', async (req, res, next) => {
    try {
      const wanted = String(req.params.slug)
      const item = /^[A-Za-z0-9-]{1,120}$/.test(wanted) ? await getItemBySlug(wanted.toLowerCase()) : null
      // An address with no item still gets the app (it shows "no such item"), but as a 404 so search engines drop it.
      if (!item) return res.status(404).sendFile(path.join(distPath, 'index.html'))
      // One address per item: a capitalised copy of it goes to the lower-case one.
      if (wanted !== item.slug) return res.redirect(301, `/items/${item.slug}`)
      const pageUrl = `${SITE_URL}/items/${item.slug}`
      const bits = [`${item.name} Grand Exchange price: ${gp(item.price)}${item.high != null && item.low != null ? ` (buy ${gp(item.high)}, sell ${gp(item.low)})` : ''}.`]
      if (item.limit) bits.push(`Buy limit ${item.limit.toLocaleString('en-US')}.`)
      if (item.change7 != null) bits.push(`${signed(item.change7)} in 7 days.`)
      bits.push('Live OSRS price, history and flipping margin after tax.')
      const description = bits.join(' ')
      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: `${item.name} Price (OSRS GE): ${item.price != null ? Number(item.price).toLocaleString('en-US') : 'n/a'} gp | TickGains`,
          description,
          imageUrl: `${SITE_URL}/og-default.png`,
          pageUrl,
          jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: `${item.name} price on the OSRS Grand Exchange`, url: pageUrl, description, about: { '@type': 'Thing', name: item.name, description: item.examine || undefined } },
          bodyHtml: pageBody(`${item.name} Grand Exchange price`, [description, item.examine].filter(Boolean), '/items'),
        }),
      )
    } catch (err) {
      next(err)
    }
  })

  app.get('/clans/:slug', async (req, res, next) => {
    try {
      // /clans/mine and /clans/new are app pages, not clans.
      if (['mine', 'new'].includes(req.params.slug)) return res.sendFile(path.join(distPath, 'index.html'))
      const clan = await getClanSeo(req.params.slug)
      if (!clan) return res.sendFile(path.join(distPath, 'index.html'))
      const pageUrl = `${SITE_URL}/clans/${encodeURIComponent(clan.slug)}`
      const people = `${clan.memberCount} member${clan.memberCount === 1 ? '' : 's'}`
      let description = `${clan.name} is an Old School RuneScape clan on TickGains with ${people}.`
      if (clan.description) description += ` ${clan.description}${/[.!?]$/.test(clan.description) ? '' : '.'}`
      if (clan.members.length) description += ` Members include ${clan.members.join(', ')}.`
      description += ' See its XP competitions and weekly leaders.'
      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: `${clan.name} | OSRS Clan | TickGains`,
          description,
          imageUrl: `${SITE_URL}/og-default.png`,
          pageUrl,
          jsonLd: { '@context': 'https://schema.org', '@type': 'Organization', name: clan.name, url: pageUrl, description: clan.description || undefined },
          bodyHtml: pageBody(`${clan.name}, an OSRS clan`, [description], '/clans'),
        }),
      )
    } catch (err) {
      next(err)
    }
  })

  // A clan invite link, with its picture baked into the HTML so it unfurls in Discord, X and Reddit. Never indexed: the link is
  // the invitation.
  app.get('/join/:token', async (req, res, next) => {
    try {
      const data = await getInviteCardData(req.params.token)
      if (!data) return res.sendFile(path.join(distPath, 'index.html'))
      const token = encodeURIComponent(req.params.token)
      const open = data.competitions[0]
      const version = `${data.memberCount}-${open ? open.id : 0}`
      res.send(
        injectCardMeta(indexHtmlTemplate, {
          title: `Join ${data.name} on TickGains`,
          description: describeInvite(data),
          imageUrl: `${SITE_URL}/api/clans/invite/${token}/image.png?v=${version}`,
          pageUrl: `${SITE_URL}/join/${token}`,
          noindex: true,
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
        bodyHtml: pageBody('Discover OSRS Players', ['Discover tracked Old School RuneScape players: recent 99s, top XP gains this week and month, and players closing in on max.'], '/discover'),
      }),
    )
  })

  // The planner's title/description are baked into the HTML for crawlers and
  // link unfurls; parameterized plan URLs share the same page (the client
  // marks those noindex).
  app.get(['/planner', '/planner/new'], (req, res) => {
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
        bodyHtml: skills.length ? undefined : pageBody('OSRS Account Planner and XP Calculator', [description], '/planner'),
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

  // Built files have a hash in their name, so they never change and can be cached for good. index.html is the one
  // file that points at the current hashes, so it must always be re-checked, otherwise a browser keeps asking for
  // files from an older deploy.
  app.use(
    express.static(distPath, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable')
        else if (filePath.endsWith('.html')) res.set('Cache-Control', 'no-cache')
      },
    }),
  )
  // A missing built file (an old tab asking for last deploy's chunk) must be a real 404. Answering with index.html and
  // a 200 makes the browser treat HTML as JavaScript and hides the cause from the app.
  app.get(/^\/assets\/.*/, (req, res) => res.status(404).type('text/plain').send('Not found'))
  // SPA fallback: any non-API GET (e.g. /players/3) resolves client-side,
  // so it all serves the same index.html.
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.set('Cache-Control', 'no-cache')
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
startCompetitionJob()
startEventsPurgeJob()
startClaimReminderJob()
startClaimNudgeJob()
startGePricesJob()
// Warm the cached homepage/Discover data so the first visitor doesn't pay for it.
getHome().catch(() => {})
// Reconstruct achievements/milestones for players tracked before they existed (idempotent).
backfillAllMilestones().catch((err) => console.error('[milestones] backfill failed:', err))
