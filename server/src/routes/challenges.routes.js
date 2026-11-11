import { Router } from 'express'
import { pool } from '../db.js'
import { getPlayerByUsername } from '../services/players.service.js'
import { addNotification, ownerOfPlayer } from '../services/inbox.service.js'
import { rateLimit } from '../utils/rateLimit.js'

export const challengesRouter = Router()

const NAME_RE = /^[A-Za-z0-9 _-]{1,12}$/
const limiter = rateLimit({ windowMs: 3_600_000, max: 30, message: 'Too many requests, please try again later.' })

// Someone opened a challenge link and compared themselves with the challenger. If that profile has an owner, they
// hear about it. No account is needed to accept; one notice per opponent per day keeps it from being used to spam.
challengesRouter.post('/challenges/accepted', limiter, async (req, res, next) => {
  try {
    const from = String(req.body?.from || '').trim()
    const opponent = String(req.body?.opponent || '').trim()
    if (!NAME_RE.test(from) || !NAME_RE.test(opponent) || from.toLowerCase() === opponent.toLowerCase()) return res.json({ ok: true })
    const player = await getPlayerByUsername(from)
    if (!player) return res.json({ ok: true })
    const ownerId = await ownerOfPlayer(player.id)
    if (ownerId) {
      const { rows } = await pool.query('SELECT display_name FROM players WHERE lower(username) = lower($1)', [opponent])
      const name = rows[0]?.display_name || opponent
      const day = new Date().toISOString().slice(0, 10)
      await addNotification(ownerId, {
        type: 'challenge_accepted',
        text: `${name} accepted your challenge`,
        link: `/compare/${encodeURIComponent(player.username)}/${encodeURIComponent(opponent)}`,
        dedupeKey: `challenge:${player.id}:${opponent.toLowerCase()}:${day}`,
      })
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
