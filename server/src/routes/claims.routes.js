import { Router } from 'express'
import { getPlayerByUsername } from '../services/players.service.js'
import { rateLimit } from '../utils/rateLimit.js'
import { sendMail } from '../utils/mailer.js'
import { renderEmail } from '../utils/emailTemplate.js'
import { notifyClaimStarted } from '../services/notify.service.js'
import { attachUser, requireRole, requireUser } from './auth.routes.js'
import { ClaimError, adminOverview, approveByCode, cancelClaim, claimContact, getClaimState, listMyClaims, lookupByCode, rejectClaim, revokeClaim, startClaim } from '../services/claims.service.js'

export const claimsRouter = Router()

const startLimiter = rateLimit({ windowMs: 3_600_000, max: 12, message: 'Too many claim requests, please try again later.' })
const adminLimiter = rateLimit({ windowMs: 60_000, max: 90 })

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res)
  } catch (err) {
    if (err instanceof ClaimError) return res.status(err.status).json({ error: err.message })
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

// --- for everyone and for the signed-in account --------------------------------------------------------------------

// Whether a profile is claimed (public) and, for a signed-in visitor, how it relates to them.
claimsRouter.get(
  '/players/:username/claim',
  attachUser,
  handle(async (req, res) => {
    const player = await playerOr404(req, res)
    if (!player) return
    res.set('Cache-Control', 'no-store')
    res.json(await getClaimState(player, req.user))
  }),
)

// Start claiming: returns the code to send in game.
claimsRouter.post(
  '/players/:username/claim',
  attachUser,
  requireUser,
  startLimiter,
  handle(async (req, res) => {
    const player = await playerOr404(req, res)
    if (!player) return
    const result = await startClaim(req.user, player)
    if (result.created) notifyClaimStarted({ email: req.user.email, playerName: player.displayName }).catch(() => {})
    res.status(result.created ? 201 : 200).json(await getClaimState(player, req.user))
  }),
)

claimsRouter.post(
  '/players/:username/claim/cancel',
  attachUser,
  requireUser,
  handle(async (req, res) => {
    const player = await playerOr404(req, res)
    if (!player) return
    await cancelClaim(req.user, player)
    res.json(await getClaimState(player, req.user))
  }),
)

claimsRouter.get(
  '/claims/mine',
  attachUser,
  requireUser,
  handle(async (req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json({ claims: await listMyClaims(req.user), contact: claimContact() })
  }),
)

// --- for the site owner ---------------------------------------------------------------------------------------------

const admin = [attachUser, requireRole('admin', 'owner'), adminLimiter]

claimsRouter.get(
  '/admin/claims',
  ...admin,
  handle(async (req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json(await adminOverview())
  }),
)

// Look up the claim a code belongs to, so it can be checked against the in-game message before approving.
claimsRouter.post(
  '/admin/claims/lookup',
  ...admin,
  handle(async (req, res) => {
    const claim = await lookupByCode(req.body?.code)
    if (!claim) return res.status(404).json({ error: 'No waiting claim has that code. It may be wrong, expired or already used.' })
    res.json({ claim })
  }),
)

claimsRouter.post(
  '/admin/claims/approve',
  ...admin,
  handle(async (req, res) => {
    const claim = await approveByCode(req.user, req.body?.code)
    // Tell the new owner. A failed email never undoes the approval, but the owner is told whether it went out.
    const emailed = await sendMail({
      to: claim.email,
      subject: `${claim.player.displayName} is now yours on TickGains`,
      ...renderEmail({
        preheader: 'Your profile claim was verified.',
        title: 'Profile verified',
        paragraphs: [{ text: `Your claim on ${claim.player.displayName} was verified. You are now the owner of this profile on TickGains, and the extra features we add for profile owners will unlock on it.`, strong: claim.player.displayName }],
        button: { label: 'Open your profile', url: `${process.env.SITE_URL || 'https://tickgains.com'}/player/${encodeURIComponent(claim.player.username)}` },
      }),
    }).catch(() => false)
    res.json({ claim, emailed })
  }),
)

claimsRouter.post(
  '/admin/claims/:id/reject',
  ...admin,
  handle(async (req, res) => {
    await rejectClaim(req.user, Number(req.params.id))
    res.json({ ok: true })
  }),
)

claimsRouter.post(
  '/admin/claims/:id/revoke',
  ...admin,
  handle(async (req, res) => {
    await revokeClaim(req.user, Number(req.params.id))
    res.json({ ok: true })
  }),
)
