// Checks a method's requirements against what the planner knows about the player.
//
//  - skill levels come from the player's tracked levels (met / unmet), or "planned" when the plan itself trains that
//    skill that high;
//  - quests, diaries, gear and unlocks cannot be read from the hiscores, so they stay "unknown" until the player confirms
//    them ("I have this" / "I don't have this").
//
// ctx: { levels: { Skill: level } | null, planned: { Skill: targetLevel }, confirmations: { requirementId: 'have' | 'missing' } }
import { requirementsFor } from '@/data/methodRequirements'

export const MET = 'met'
export const UNMET = 'unmet'
export const UNKNOWN = 'unknown'
export const PLANNED = 'planned'
export const INFO = 'info'

const fullQuestId = (req) => (req.kind === 'quest' && req.partial ? req.id.replace(/:partial$/, '') : null)

/** The player's own answer for a requirement: 'have', 'missing' or null. Confirming a whole quest also covers a partial one. */
export function confirmationFor(req, confirmations = {}) {
  const own = confirmations[req.id]
  if (own === 'have' || own === 'missing') return own
  const full = fullQuestId(req)
  if (full && confirmations[full] === 'have') return 'have'
  return null
}

export function requirementStatus(req, ctx = {}) {
  if (req.kind === 'note') return INFO
  if (req.kind === 'skill') {
    const level = ctx.levels?.[req.skill]
    if (!Number.isFinite(level)) return UNKNOWN
    if (level >= req.level) return MET
    return (ctx.planned?.[req.skill] || 0) >= req.level ? PLANNED : UNMET
  }
  const answer = confirmationFor(req, ctx.confirmations)
  if (answer === 'have') return MET
  if (answer === 'missing') return UNMET
  return UNKNOWN
}

/**
 * Whether a method can be used. state: 'blocked' (something is confirmed missing), 'unconfirmed' (nothing missing but some
 * requirements are unknown), 'planned' (the only gaps are levels the plan itself trains), 'available'.
 */
export function methodAvailability(method, ctx = {}) {
  const items = requirementsFor(method).map((req) => ({ req, status: requirementStatus(req, ctx) }))
  const unmet = items.filter((i) => i.status === UNMET)
  const unknown = items.filter((i) => i.status === UNKNOWN)
  const planned = items.filter((i) => i.status === PLANNED)
  const state = unmet.length ? 'blocked' : unknown.length ? 'unconfirmed' : planned.length ? 'planned' : 'available'
  return { method, items, unmet, unknown, planned, state }
}

/** Ids of methods with a confirmed unmet requirement. Nothing is blocked on unknowns. */
export function blockedMethodIds(methods, ctx = {}) {
  const ids = []
  for (const m of methods) if (m.requirements && methodAvailability(m, ctx).state === 'blocked') ids.push(m.id)
  return ids.sort()
}

/** Short human text for a requirement problem, e.g. "75 Attack" or "Monkey Madness II". */
export const unmetText = (availability) => availability.unmet.map((i) => i.req.label).join(', ')

export const CONFIRM_KEY = 'tickgains-planner-requirements-v1'
export const RESPECT_KEY = 'tickgains-planner-respect-requirements'

/** Keeps only valid answers for plausible requirement ids. 'unknown' is kept so that clearing an answer also clears it on other devices. */
export function cleanConfirmations(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [id, v] of Object.entries(raw)) {
    if ((v === 'have' || v === 'missing' || v === 'unknown') && /^[a-z]+:[a-z0-9:'-]{1,80}$/.test(id) && Object.keys(out).length < 600) out[id] = v
  }
  return out
}
