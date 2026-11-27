import { Router } from 'express'
import { getPlayerByUsername } from '../services/players.service.js'
import { rateLimit } from '../utils/rateLimit.js'
import { sendMail } from '../utils/mailer.js'
import { renderEmail } from '../utils/emailTemplate.js'
import { notifyClaimStarted } from '../services/notify.service.js'
import { attachUser, requireRole, requireUser } from './auth.routes.js'
import { addNotification } from '../services/inbox.service.js'
import { ClaimError, adminOverview, approveByCode, cancelClaim, claimContact, getClaimState, listMyClaims, lookupByCode, readAvailability, notifyOwnersOfPing, rejectClaim, reservePing, revokeClaim, saveAvailability, startClaim } from '../services/claims.service.js'
import { pingMessage, postToDiscord, startedMessage, windowMessage } from '../services/discord.service.js'

export const claimsRouter = Router()

const startLimiter = rateLimit({ windowMs: 3_600_000, max: 12, message: 'Too many claim requests, please try again later.' })
const pingLimiter = rateLimit({ windowMs: 3_600_000, max: 10, message: 'Too many pings, please try again later.' })
const windowLimiter = rateLimit({ windowMs: 3_600_000, max: 30, message: 'Too many changes, please try again later.' })
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
    // A window sent with the start is checked first, so a bad one never leaves a half-made claim behind.
    const window = readAvailability(req.body)
    const result = await startClaim(req.user, player)
    if (window) await saveAvailability(req.user, player, window)
    if (result.created) {
      notifyClaimStarted({ email: req.user.email, playerName: player.displayName }).catch(() => {})
      postToDiscord(startedMessage({ playerName: player.displayName, from: window?.from, until: window?.until })).catch(() => {})
    }
    // "Start and tell them I'm online now": a failed ping never undoes the claim, the pending screen still has the ping button.
    if (req.body?.ping === true) await sendPing(req.user, player).catch(() => {})
    res.status(result.created ? 201 : 200).json(await getClaimState(player, req.user))
  }),
)

// Say when you will be in game (or send nothing to clear it), so the owner knows when to log on.
claimsRouter.post(
  '/players/:username/claim/online',
  attachUser,
  requireUser,
  windowLimiter,
  handle(async (req, res) => {
    const player = await playerOr404(req, res)
    if (!player) return
    const window = readAvailability(req.body)
    await saveAvailability(req.user, player, window)
    if (window) postToDiscord(windowMessage({ playerName: player.displayName, from: window.from, until: window.until })).catch(() => {})
    res.json(await getClaimState(player, req.user))
  }),
)

// The ping itself: a notice in the owner's bell and a Discord message, at most once every half hour per claim. It works when either
// one gets through, so a Discord outage (or no webhook at all) never leaves a claimant unable to say they are here.
async function sendPing(user, player) {
  const claim = await reservePing(user, player)
  const [inApp, discord] = await Promise.all([
    notifyOwnersOfPing({ claimId: claim.id, playerName: player.displayName }).catch(() => 0),
    postToDiscord(pingMessage({ playerName: player.displayName, from: claim.from, until: claim.until })),
  ])
  if (!inApp && !discord) {
    await claim.release()
    throw new ClaimError('The ping could not be sent right now. Please try again in a moment.', 502)
  }
}

// "I'm online now": nudges the owner in the app and on Discord.
claimsRouter.post(
  '/players/:username/claim/ping',
  attachUser,
  requireUser,
  pingLimiter,
  handle(async (req, res) => {
    const player = await playerOr404(req, res)
    if (!player) return
    await sendPing(req.user, player)
    res.json(await getClaimState(player, req.user))
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
    await addNotification(claim.userId, { type: 'claim_approved', text: `Your claim on ${claim.player.displayName} was verified. It is now your profile.`, link: `/player/${encodeURIComponent(claim.player.username)}`, dedupeKey: `claim-approved:${claim.id}`, subject: claim.player.username })
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
    const rejected = await rejectClaim(req.user, Number(req.params.id))
    await addNotification(rejected.userId, { type: 'claim_rejected', text: `Your claim on ${rejected.player.displayName} was not approved. You can start again from the profile page.`, link: `/player/${encodeURIComponent(rejected.player.username)}`, dedupeKey: `claim-rejected:${req.params.id}`, subject: rejected.player.username })
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
