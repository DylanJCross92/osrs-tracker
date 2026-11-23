// Rules for the feedback form. Pure (no database), so what is accepted is easy to test. Everything is untrusted input.
import { normalizeEmail } from './email.js'

export const KINDS = { bug: 'Bug', idea: 'Idea', other: 'Other', plan_report: 'Plan report' }
export const MIN_MESSAGE = 5
export const MAX_MESSAGE = 2000

/** The path of the page the person was on (no query or hash, so nothing typed in a link comes along), or ''. */
export function cleanPage(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return ''
  const path = value.split(/[?#]/)[0].slice(0, 200)
  return /^[\w\-./%~@:+ ]*$/.test(path) ? path : ''
}

/** "390x844" or ''. */
export const cleanViewport = (value) => (typeof value === 'string' && /^\d{2,5}x\d{2,5}$/.test(value) ? value : '')

const GOALS = ['skills', 'money', 'combat', 'quests', 'afk', 'hardcore']
const GP = ['low', 'some', 'good', 'rich']
const EXPERIENCE = ['new', 'returning', 'veteran']
const pick = (v, list) => (list.includes(v) ? v : null)
const text = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '')
const int = (v, lo, hi) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null
}
const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : [])
export const MAX_CONTEXT_BYTES = 6000

/**
 * The Smart Planner's answers and the plan it made, sent with a "this plan looks wrong" report. Only known fields come through, each
 * trimmed, and never a name: skills, levels, hours and the planner's own titles and notes. null when there is nothing usable or it is too big.
 */
export function cleanPlanContext(raw) {
  if (!raw || typeof raw !== 'object') return null
  const p = raw.profile && typeof raw.profile === 'object' ? raw.profile : {}
  const profile = { members: p.members === true, iron: p.iron === true, goal: pick(p.goal, GOALS), gp: pick(p.gp, GP), experience: pick(p.experience, EXPERIENCE), hours: Math.min(12, Math.max(0.5, Number(p.hours) || 0.5)) }
  const goals = list(raw.goals, 30)
    .map((g) => ({ skill: text(g?.skill, 20).replace(/[^A-Za-z]/g, ''), from: int(g?.from, 1, 126), to: int(g?.to, 1, 126), hours: int(g?.hours, 0, 100000) }))
    .filter((g) => g.skill)
  const phases = list(raw.phases, 8).map((x) => ({ title: text(x?.title, 60), rows: int(x?.rows, 0, 100) })).filter((x) => x.title)
  const notes = list(raw.notes, 8).map((n) => text(n, 200)).filter(Boolean)
  const skipped = list(raw.skipped, 6).map((x) => ({ title: text(x?.title, 60), reason: text(x?.reason, 160) })).filter((x) => x.title)
  const a = raw.assumed && typeof raw.assumed === 'object' ? raw.assumed : {}
  const assumed = { combat: int(a.combat, 3, 126), doneQuests: int(a.doneQuests, 0, 1000) }
  const context = { profile, goals, phases, notes, skipped, assumed }
  return JSON.stringify(context).length <= MAX_CONTEXT_BYTES ? context : null
}

/**
 * { error } when the form cannot be accepted, otherwise { value: { kind, message, email, page, viewport } }.
 * The reply email is optional; when given it has to look like an address.
 */
export function cleanFeedback(body) {
  const message = typeof body?.message === 'string' ? body.message.replace(/\r\n/g, '\n').trim() : ''
  if (message.length < MIN_MESSAGE) return { error: 'Please write a little more so we can understand.' }
  if (message.length > MAX_MESSAGE) return { error: `Please keep it under ${MAX_MESSAGE.toLocaleString('en-US')} characters.` }

  const rawEmail = typeof body?.email === 'string' ? body.email.trim() : ''
  const email = rawEmail ? normalizeEmail(rawEmail) : null
  if (rawEmail && !email) return { error: 'That email address does not look right. Leave it empty if you would rather not be contacted.' }

  const kind = Object.keys(KINDS).includes(body?.kind) ? body.kind : 'other'
  // A plan report carries the answers and the plan; no other kind of feedback has a place for them.
  const context = kind === 'plan_report' ? cleanPlanContext(body?.context) : null
  return { value: { kind, message, email, page: cleanPage(body?.page), viewport: cleanViewport(body?.viewport), ...(context ? { context } : {}) } }
}
