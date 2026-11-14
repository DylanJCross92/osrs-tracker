import { randomInt } from 'node:crypto'
import { SKILL_NAMES } from '../services/osrsHiscores.service.js'

// What a public plan may contain. The server keeps only these fields, in these ranges, so a shared plan cannot be used to
// store arbitrary content. Estimates (hours, gp) are the owner's own and are only used for display and link previews.
export const MAX_SHARES_PER_USER = 25
export const MAX_SHARE_BYTES = 20_000
const MAX_XP = 200_000_000
const ID_RE = /^[\w-]{1,40}$/
const METHOD_RE = /^[a-z0-9-]{1,70}$/
const NAME_RE = /^[A-Za-z0-9 _-]{1,12}$/
const STRATEGIES = ['auto-fast', 'auto-cheap', 'auto-balanced']
// No look-alikes (0/o, 1/l/i), so a link read out loud or typed from a screenshot survives.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export class SharePlanError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

export function newSlug(length = 10) {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}
export const isSlug = (s) => typeof s === 'string' && /^[a-z0-9]{6,16}$/.test(s)

const int = (v, lo, hi, fallback = null) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), lo), hi) : fallback
}
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)

/** Validates and cleans what the browser sends when sharing a plan. Returns the row to store, or throws SharePlanError. */
export function cleanSharedPlan(body) {
  if (!body || typeof body !== 'object') throw new SharePlanError('Nothing to share.')
  const planId = typeof body.planId === 'string' && ID_RE.test(body.planId) ? body.planId : null
  if (!planId) throw new SharePlanError('Save the plan first, then share it.')

  const src = body.plan
  if (!src || typeof src !== 'object' || !Array.isArray(src.goals)) throw new SharePlanError('That plan has no goals.')
  const goals = []
  const seen = new Set()
  for (const g of src.goals.slice(0, 24)) {
    if (!g || !SKILL_NAMES.includes(g.skill) || seen.has(g.skill)) continue
    seen.add(g.skill)
    const methodId = typeof g.methodId === 'string' && (METHOD_RE.test(g.methodId) || g.methodId === 'custom') ? g.methodId : 'global'
    goals.push({
      skill: g.skill,
      currentXp: int(g.currentXp, 0, MAX_XP, 0),
      targetXp: int(g.targetXp, 0, MAX_XP, 0),
      methodId,
      customXpPerHour: methodId === 'custom' ? int(g.customXpPerHour, 0, 10_000_000, 0) : 0,
      quests: (Array.isArray(g.quests) ? g.quests : []).filter((q) => typeof q === 'string' && METHOD_RE.test(q)).slice(0, 20),
      // Manual method choices for sets of levels: [{ fromLevel, toLevel, methodId }]
      overrides: (Array.isArray(g.overrides) ? g.overrides : [])
        .map((o) => ({ fromLevel: int(o?.fromLevel, 1, 126, 0), toLevel: int(o?.toLevel, 1, 126, 0), methodId: o?.methodId }))
        .filter((o) => o.fromLevel >= 1 && o.toLevel > o.fromLevel && typeof o.methodId === 'string' && METHOD_RE.test(o.methodId))
        .slice(0, 30),
    })
  }
  if (!goals.length) throw new SharePlanError('Add at least one skill goal before sharing.')

  const rsn = typeof body.rsn === 'string' && NAME_RE.test(body.rsn.trim()) ? body.rsn.trim() : ''
  const mode = body.mode === 'live' ? 'live' : 'static'
  if (mode === 'live' && !rsn) throw new SharePlanError('Live progress needs a player name on the plan. Load a player first, or share a static plan.')

  const plan = {
    hoursPerDay: Math.min(Math.max(Number(src.hoursPerDay) || 2, 0.25), 24),
    globalStrategy: STRATEGIES.includes(src.globalStrategy) ? src.globalStrategy : 'auto-fast',
    gpValue: int(src.gpValue, 0, 1_000_000_000, 2_000_000),
    statsAt: typeof src.statsAt === 'string' && Number.isFinite(Date.parse(src.statsAt)) ? new Date(src.statsAt).toISOString() : null,
    goals,
  }

  const s = body.summary && typeof body.summary === 'object' ? body.summary : {}
  const summary = {
    totalHours: s.totalHours == null ? null : Math.min(Math.max(Number(s.totalHours) || 0, 0), 1_000_000),
    netGp: s.netGp == null || !Number.isFinite(Number(s.netGp)) ? null : int(s.netGp, -1e12, 1e12),
    days: s.days == null ? null : int(s.days, 0, 100_000),
    totalXp: int(s.totalXp, 0, 5_000_000_000, 0),
    goals: (Array.isArray(s.goals) ? s.goals : [])
      .filter((x) => x && SKILL_NAMES.includes(x.skill))
      .slice(0, 24)
      .map((x) => ({ skill: x.skill, fromLevel: int(x.fromLevel, 1, 126, 1), toLevel: int(x.toLevel, 1, 126, 99) })),
  }

  const row = { planId, name: clean(body.name, 60) || 'Training plan', rsn, mode, plan, summary }
  if (Buffer.byteLength(JSON.stringify(row), 'utf8') > MAX_SHARE_BYTES) throw new SharePlanError('That plan is too large to share.')
  return row
}

/** What visitors see: never the owner's account, only the plan. */
export function publicShape(row) {
  return {
    slug: row.slug,
    name: row.name,
    rsn: row.rsn,
    mode: row.mode,
    plan: row.plan,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const SHARE_EVENTS = ['view', 'use']
const DAY_MS = 86_400_000

/**
 * What the owner sees for one public plan, from its per-day counts: [{ day: 'YYYY-MM-DD', views, uses }].
 * Totals, the last 7 days, and a 14-day series (oldest first, quiet days as zeros) for the little chart.
 */
export function summarizeStats(rows, today) {
  const byDay = new Map(rows.map((r) => [r.day, r]))
  const at = (offset) => new Date(Date.parse(`${today}T12:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10)
  const series = []
  for (let i = 13; i >= 0; i--) {
    const day = at(-i)
    const r = byDay.get(day)
    series.push({ day, views: r?.views || 0, uses: r?.uses || 0 })
  }
  const sum = (list, key) => list.reduce((a, r) => a + (r[key] || 0), 0)
  const week = series.slice(-7)
  return { views: sum(rows, 'views'), uses: sum(rows, 'uses'), viewsWeek: sum(week, 'views'), usesWeek: sum(week, 'uses'), series }
}
