import express, { Router } from 'express'
import { getPlayerByUsername } from '../services/players.service.js'
import { rateLimit } from '../utils/rateLimit.js'
import { attachUser, requireRole, requireUser } from './auth.routes.js'
import { MAX_AVATAR_BYTES } from '../utils/profilePage.js'
import { PageError, getAvatar, getProfilePage, isOwner, removeAvatar, resetProfilePage, saveAvatar, saveProfilePage } from '../services/profilePages.service.js'

export const profilePagesRouter = Router()

const writeLimiter = rateLimit({ windowMs: 3_600_000, max: 60, message: 'Too many changes, please try again later.' })

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res)
  } catch (err) {
    if (err instanceof PageError) return res.status(err.status).json({ error: err.message })
    next(err)
  }
}

async function playerOr404(req, res) {
  const player = await getPlayerByUsername(req.params.username)
  if (!player) {
    res.status(404).json({ error: 'That player is not being tracked yet.' })
    return null
  }
  return player
}

// Only the profile's verified owner may change its page (the site's admins can reset it, see below).
async function ownerOnly(req, res) {
  const player = await playerOr404(req, res)
  if (!player) return null
  if (!(await isOwner(req.user.id, player.id))) {
    res.status(403).json({ error: 'Only the profile owner can do that.' })
    return null
  }
  return player
}

// What visitors see on the profile (public).
profilePagesRouter.get(
  '/players/:username/page',
  handle(async (req, res) => {
    const player = await playerOr404(req, res)
    if (!player) return
    res.set('Cache-Control', 'public, max-age=60')
    res.json(await getProfilePage(player.id))
  }),
)

profilePagesRouter.put(
  '/players/:username/page',
  attachUser,
  requireUser,
  writeLimiter,
  handle(async (req, res) => {
    const player = await ownerOnly(req, res)
    if (!player) return
    res.json(await saveProfilePage(player.id, req.body))
  }),
)

// The picture. Public; served exactly as its detected type, with no sniffing and nothing that can run.
profilePagesRouter.get(
  '/players/:username/avatar',
  handle(async (req, res) => {
    const player = await playerOr404(req, res)
    if (!player) return
    const avatar = await getAvatar(player.id)
    if (!avatar) return res.status(404).end()
    res.set({
      'Content-Type': avatar.type,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
      'Cache-Control': req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    })
    res.send(avatar.data)
  }),
)

// Upload: the raw image bytes as the request body (the browser has already resized it to a small square).
profilePagesRouter.post(
  '/players/:username/avatar',
  attachUser,
  requireUser,
  writeLimiter,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_AVATAR_BYTES + 1024 }),
  handle(async (req, res) => {
    const player = await ownerOnly(req, res)
    if (!player) return
    await saveAvatar(player.id, req.body)
    res.json(await getProfilePage(player.id))
  }),
)

profilePagesRouter.post(
  '/players/:username/avatar/remove',
  attachUser,
  requireUser,
  writeLimiter,
  handle(async (req, res) => {
    const player = await ownerOnly(req, res)
    if (!player) return
    await removeAvatar(player.id)
    res.json(await getProfilePage(player.id))
  }),
)

// Site admins can wipe a profile's custom content (for example an inappropriate picture or bio).
profilePagesRouter.post(
  '/admin/profiles/:username/reset',
  attachUser,
  requireRole('admin', 'owner'),
  handle(async (req, res) => {
    const player = await playerOr404(req, res)
    if (!player) return
    await resetProfilePage(player.id)
    res.json({ ok: true })
  }),
)
