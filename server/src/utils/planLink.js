// What a planner link says about itself (/planner/new?...g=Cooking~0~13034431~...): read from the link's own address, so a link pasted into Discord, LinkedIn or
// a chat names the skills and levels instead of the generic planner page. Pure: no database. The link carries each goal as skill~currentXp~targetXp~method~...
// and, when it was made by the share window, the plan's totals (sh hours, sd days, sg net gp), since the server has no planner engine to work them out.
import { SKILL_NAMES } from '../services/osrsHiscores.service.js'
import { levelAtXp } from './xp.js'
import { formatGp, formatXp } from './format.js'

const NAME_RE = /^[A-Za-z0-9 _-]{1,12}$/
const MAX_XP = 200_000_000
const num = (v) => (v === undefined || v === '' ? NaN : Number(v))
const str = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? String(v[0] ?? '') : '')

const BUILD_LABELS = { skiller: 'level 3 skiller', pure: '1 Defence pure', zerker: 'zerker' }
const IRON_LABELS = { standard: 'ironman', hardcore: 'hardcore ironman', ultimate: 'ultimate ironman', group: 'group ironman' }

/**
 * Reads a planner address's query. Returns null when it has no usable goal (the page then keeps its generic text), else
 * { who, hoursPerDay, goals: [{ skill, fromLevel, toLevel, xp }], totalXp, hours, days, netGp, account }.
 */
export function parsePlanLink(query = {}) {
  const goals = []
  const seen = new Set()
  for (const chunk of str(query.g).split(',').slice(0, 24)) {
    const [skill, cur, target] = chunk.split('~')
    if (!SKILL_NAMES.includes(skill) || seen.has(skill)) continue
    const from = Math.min(Math.max(Math.round(num(cur)) || 0, 0), MAX_XP)
    const to = Math.min(Math.max(Math.round(num(target)), 0), MAX_XP)
    if (!Number.isFinite(to) || to <= from) continue
    seen.add(skill)
    goals.push({ skill, fromLevel: levelAtXp(from, true), toLevel: levelAtXp(to, true), xp: to - from })
  }
  if (!goals.length) return null
  const who = NAME_RE.test(str(query.u).trim()) ? str(query.u).trim() : ''
  const hoursPerDay = Math.min(Math.max(num(query.h) || 2, 0.25), 24)
  const sh = num(query.sh)
  const sd = num(query.sd)
  const sg = num(query.sg)
  const ironKind = IRON_LABELS[str(query.ik)] ? str(query.ik) : 'standard'
  return {
    who,
    hoursPerDay,
    goals,
    totalXp: goals.reduce((sum, g) => sum + g.xp, 0),
    hours: Number.isFinite(sh) && sh >= 0 ? Math.min(sh, 1_000_000) : null,
    days: Number.isFinite(sd) && sd >= 0 ? Math.min(Math.round(sd), 100_000) : null,
    netGp: Number.isFinite(sg) ? Math.round(sg) : null,
    account: {
      freeToPlay: str(query.m) === '0',
      iron: str(query.i) === '1',
      ironKind,
      build: BUILD_LABELS[str(query.bd)] ? str(query.bd) : 'main',
      hardcoreWorlds: str(query.i) !== '1' && str(query.hw) === '1',
    },
  }
}

/** "Cooking", "Cooking and Fishing", "Cooking, Fishing and Mining", "Cooking, Fishing, Mining and 3 more". */
function skillList(goals) {
  const names = goals.map((g) => g.skill)
  if (names.length <= 3) return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`
}

/** "Hardcore Worlds", "free-to-play ironman", "level 3 skiller"... or '' for a plain members main account. */
export function accountNote(a) {
  const parts = []
  if (a.freeToPlay) parts.push('free-to-play')
  if (a.iron) parts.push(IRON_LABELS[a.ironKind])
  else if (a.hardcoreWorlds) parts.push('Hardcore Worlds')
  if (a.build !== 'main') parts.push(BUILD_LABELS[a.build])
  return parts.join(' ')
}

// "412 hours", "5.2 hours", "1 hour", "under an hour": words, since this is a sentence and a title, not a card tile.
function planHours(h) {
  if (h < 1) return 'under an hour'
  const v = h >= 100 ? Math.round(h) : Math.round(h * 10) / 10
  return `${v.toLocaleString('en-US')} ${v === 1 ? 'hour' : 'hours'}`
}
// "3.2M gp" without the sign (the sentence says costs or earns).
const gpShort = (n) => formatGp(Math.round(Math.abs(n))).replace(/^\+/, '')

/** { name, title, description } for a parsed link: what the plan is, in numbers. `name` is the short form ("Cooking 34 to 99") the preview card puts in big letters. */
export function planLinkText(p) {
  const one = p.goals.length === 1 ? p.goals[0] : null
  const allTo99 = p.goals.every((g) => g.toLevel >= 99)
  const noun = accountNote(p.account)
  const owner = p.who ? `${p.who}'s ` : ''
  let what
  if (one) what = `${one.skill} ${one.fromLevel} to ${one.toLevel}`
  else if (allTo99) what = `${skillList(p.goals)} to 99`
  else what = `${p.goals.length}-skill plan: ${skillList(p.goals)}`
  const time = p.hours != null ? `, ${planHours(p.hours)}` : ''
  const title = `${owner}${what}${one || allTo99 ? ' training plan' : ''}${time} | TickGains`

  const bits = []
  bits.push(
    one
      ? `${one.skill} from level ${one.fromLevel} to ${one.toLevel}: ${formatXp(p.totalXp)} XP to go`
      : `${p.goals.length} skill goals (${skillList(p.goals)}): ${formatXp(p.totalXp)} XP to go`,
  )
  if (p.hours != null) bits.push(`about ${planHours(p.hours)} of training${p.days != null ? `, ${p.days.toLocaleString('en-US')} ${p.days === 1 ? 'day' : 'days'} at ${p.hoursPerDay} hours a day` : ''}`)
  if (p.netGp != null) bits.push(`${p.netGp < 0 ? 'costs about' : 'earns about'} ${gpShort(p.netGp)}`)
  const lead = `${owner}${noun ? `${noun} ` : ''}Old School RuneScape training plan`
  return { name: what, title, description: `${lead[0].toUpperCase()}${lead.slice(1)}: ${bits.join('; ')}. Open it in the TickGains Account Planner and make it yours, free.` }
}
