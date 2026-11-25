import { Router } from 'express'
import { rateLimit } from '../utils/rateLimit.js'
import { attachUser, requireUser } from './auth.routes.js'
import { renderClanInviteCardPng } from '../services/cardImage.service.js'
import { ClanError, addMemberDirect, approveRequest, setAcceptingRequests, canManage, createClan, declineRequest, deleteClan, getClanView, getInviteCardData, listPublicClans, clanBySlug, joinClan, joinClanBySlug, myClans, previewInvite, removeMember, resetInvite, roleOf, setModerator } from '../services/clans.service.js'
import { CompetitionError, cancelCompetition, createCompetition, getCompetition } from '../services/competitions.service.js'
import { weeklyRaceView } from '../services/weeklyRace.service.js'
import { pool } from '../db.js'

export const clansRouter = Router()

const createLimiter = rateLimit({ windowMs: 3_600_000, max: 10, message: 'Too many clans created, please try again later.' })
// Joining may add a player and ask the hiscores about them, so it is limited per address.
const joinLimiter = rateLimit({ windowMs: 3_600_000, max: 30, message: 'Too many join attempts, please try again later.' })
const manageLimiter = rateLimit({ windowMs: 3_600_000, max: 120, message: 'Too many changes, please try again later.' })

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res)
  } catch (err) {
    if (err instanceof ClanError || err instanceof CompetitionError) return res.status(err.status).json({ error: err.message })
    next(err)
  }
}

// The clan named in the address, and what this account may do in it.
async function clanAs(req, res, { manage = false, owner = false } = {}) {
  const clan = await clanBySlug(req.params.slug)
  if (!clan) {
    res.status(404).json({ error: 'That clan does not exist.' })
    return null
  }
  const role = await roleOf(clan, req.user?.id)
  const ok = owner ? role === 'owner' : manage ? canManage(role) : true
  if (!ok) {
    res.status(403).json({ error: owner ? 'Only the clan owner can do that.' : 'Only the clan owner or a moderator can do that.' })
    return null
  }
  return clan
}

clansRouter.post('/clans', attachUser, requireUser, createLimiter, handle(async (req, res) => res.status(201).json(await createClan(req.user, req.body))))

// The Clans page: every clan, with its competitions. Public.
clansRouter.get('/clans', handle(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=60')
  res.json(await listPublicClans())
}))

clansRouter.get('/clans/mine', attachUser, requireUser, handle(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ clans: await myClans(req.user) })
}))

// What an invite link shows before joining.
clansRouter.get('/clans/invite/:token', handle(async (req, res) => {
  const preview = await previewInvite(req.params.token)
  if (!preview) return res.status(404).json({ error: 'That invite link is not valid any more.' })
  res.set('Cache-Control', 'no-store')
  res.json(preview)
}))

// The picture for an invite link: the clan, who is in it and what is on. Drawn from live numbers; the link is its own key.
const imageLimiter = rateLimit({ windowMs: 3_600_000, max: 120, message: 'Too many requests.' })
clansRouter.get('/clans/invite/:token/image.png', imageLimiter, async (req, res, next) => {
  try {
    const data = await getInviteCardData(req.params.token)
    if (!data) return res.status(404).end()
    const png = await renderClanInviteCardPng(data)
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' })
    res.send(png)
  } catch (err) {
    next(err)
  }
})

clansRouter.post('/clans/join', attachUser, joinLimiter, handle(async (req, res) => res.json(await joinClan({ token: req.body?.token, rsn: req.body?.rsn, user: req.user }))))

// Asking to join from a clan's own page, with no invite link (the owner still approves, unless the clan lets everyone in).
clansRouter.post('/clans/:slug/request', attachUser, joinLimiter, handle(async (req, res) => res.json(await joinClanBySlug({ slug: req.params.slug, rsn: req.body?.rsn, user: req.user }))))

// The site's own weekly race: this week's leaders, time left and last week's winner. Public. { clan, current, top, last } or null.
clansRouter.get('/clans/weekly', handle(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=30')
  res.json({ weekly: await weeklyRaceView() })
}))

clansRouter.get('/clans/:slug', attachUser, handle(async (req, res) => {
  const view = await getClanView(req.params.slug, req.user)
  if (!view) return res.status(404).json({ error: 'That clan does not exist.' })
  res.set('Cache-Control', 'no-store')
  res.json(view)
}))

clansRouter.post('/clans/:slug/invite/reset', attachUser, requireUser, manageLimiter, handle(async (req, res) => {
  const clan = await clanAs(req, res, { manage: true })
  if (!clan) return
  res.json({ inviteToken: await resetInvite(clan) })
}))

clansRouter.post('/clans/:slug/requests/accepting', attachUser, requireUser, manageLimiter, handle(async (req, res) => {
  const clan = await clanAs(req, res, { owner: true })
  if (!clan) return
  if (typeof req.body?.accepting !== 'boolean') return res.status(400).json({ error: 'Choose on or off.' })
  res.json({ acceptingRequests: await setAcceptingRequests(clan, req.body.accepting) })
}))

clansRouter.post('/clans/:slug/requests/:username/approve', attachUser, requireUser, manageLimiter, handle(async (req, res) => {
  const clan = await clanAs(req, res, { manage: true })
  if (!clan) return
  await approveRequest(clan, req.params.username, req.user.id)
  res.json({ ok: true })
}))

clansRouter.post('/clans/:slug/requests/:username/decline', attachUser, requireUser, manageLimiter, handle(async (req, res) => {
  const clan = await clanAs(req, res, { manage: true })
  if (!clan) return
  await declineRequest(clan, req.params.username)
  res.json({ ok: true })
}))

clansRouter.post('/clans/:slug/delete', attachUser, requireUser, manageLimiter, handle(async (req, res) => {
  const clan = await clanAs(req, res, { owner: true })
  if (!clan) return
  // The word has to come with the request, as it has to be typed on the page.
  if (String(req.body?.confirm || '').trim().toLowerCase() !== 'delete') return res.status(400).json({ error: 'Type Delete to confirm deleting the clan.' })
  await deleteClan(clan)
  res.json({ ok: true })
}))

// The owner or a moderator adds a player straight away (the player is added to the site first when it is new).
clansRouter.post('/clans/:slug/members', attachUser, requireUser, manageLimiter, handle(async (req, res) => {
  const clan = await clanAs(req, res, { manage: true })
  if (!clan) return
  res.json(await addMemberDirect(clan, req.user, req.body?.rsn))
}))

clansRouter.post('/clans/:slug/members/:username/remove', attachUser, requireUser, manageLimiter, handle(async (req, res) => {
  const clan = await clanAs(req, res)
  if (!clan) return
  await removeMember(req.user, clan, req.params.username)
  res.json({ ok: true })
}))

clansRouter.post('/clans/:slug/members/:username/mod', attachUser, requireUser, manageLimiter, handle(async (req, res) => {
  const clan = await clanAs(req, res, { owner: true })
  if (!clan) return
  await setModerator(clan, req.params.username, Boolean(req.body?.mod))
  res.json({ ok: true })
}))

clansRouter.post('/clans/:slug/competitions', attachUser, requireUser, manageLimiter, handle(async (req, res) => {
  const clan = await clanAs(req, res, { manage: true })
  if (!clan) return
  res.status(201).json(await createCompetition(clan, req.user, req.body))
}))

clansRouter.get('/competitions/:id', attachUser, handle(async (req, res) => {
  const id = Number(req.params.id)
  const found = Number.isInteger(id) ? await getCompetition(id) : null
  if (!found) return res.status(404).json({ error: 'That competition does not exist.' })
  const clan = await clanBySlug(found.competition.clan.slug)
  const role = clan ? await roleOf(clan, req.user?.id) : null
  res.set('Cache-Control', 'no-store')
  res.json({ ...found, viewer: { role, canManage: canManage(role) } })
}))

clansRouter.post('/competitions/:id/cancel', attachUser, requireUser, manageLimiter, handle(async (req, res) => {
  const id = Number(req.params.id)
  const { rows } = Number.isInteger(id) ? await pool.query('SELECT g.* FROM competitions c JOIN clans g ON g.id = c.clan_id WHERE c.id = $1', [id]) : { rows: [] }
  if (!rows[0]) return res.status(404).json({ error: 'That competition does not exist.' })
  if (!canManage(await roleOf(rows[0], req.user.id))) return res.status(403).json({ error: 'Only the clan owner or a moderator can do that.' })
  await cancelCompetition(id)
  res.json({ ok: true })
}))
