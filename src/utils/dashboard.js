// What the dashboard shows about a saved plan: how far along it is, whether the player is keeping to its schedule, and
// what comes next. The numbers come from the same functions the Account Planner uses, so a plan reads the same in both
// places. Pure, so it can be tested without a page.
import { AUTO_FAST, DEFAULT_GP_VALUE, formatNum, levelAtXp, planGoal, xpAtLevel } from '@/utils/planner'
import { buildProgress, liveGoalFor, projectFinish, resolveGoal, summarizePlan } from '@/utils/plannerTools'
import { blockedMethodIds } from '@/utils/requirements'
import { TRAINING_METHODS } from '@/data/trainingMethods'
import { plannedQuestReqIds } from '@/data/quests'
import { SKILL_NAMES, formatXp } from '@/utils/osrsSkills'
import { recordUnitText, recordValueText } from '@/utils/recordText'
import { addGameDays, gameDay } from '@/utils/gameDay'

/**
 * The methods the planner would skip for this player (a missing quest or level), the same way the planner decides it.
 * `confirmations` are the player's own answers about quests and gear, `respect` whether the planner should honour them.
 */
export function blockedFor(plan, latest, confirmations = {}, respect = true) {
  if (!respect) return []
  const levels = {}
  if (latest?.skills) for (const name of SKILL_NAMES) if (Number.isFinite(latest.skills[name]?.level)) levels[name] = latest.skills[name].level
  return blockedMethodIds(TRAINING_METHODS, {
    levels: latest?.skills ? levels : null,
    planned: Object.fromEntries((plan.goals || []).map((g) => [g.skill, levelAtXp(g.targetXp, true)])),
    plannedQuests: plannedQuestReqIds(plan.goals),
    confirmations,
  })
}

const span = (days) => {
  const d = Math.abs(days)
  if (d < 1) return `${Math.max(1, Math.round(d * 24))} hour${Math.max(1, Math.round(d * 24)) === 1 ? '' : 's'}`
  if (d < 60) return `${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`
  return `about ${Math.round(d / 30)} months`
}

/** The small badge on a plan: how the pace compares to the schedule. Null when there is nothing to say yet. */
export function planBadge(status) {
  if (!status?.tracked || status.progress.complete) return null
  const pr = status.projection
  if (pr && pr.status !== 'none') {
    if (pr.status === 'on') return { kind: 'on', text: 'On pace' }
    const early = pr.status === 'early'
    return { kind: early ? 'ahead' : 'behind', text: `${span(pr.diffDays)} ${early ? 'ahead' : 'behind'}` }
  }
  const sc = status.progress.schedule
  if (!sc) return null
  return { kind: sc, text: sc === 'on' ? 'On schedule' : `${span(status.progress.aheadDays)} ${sc === 'ahead' ? 'ahead' : 'behind'}` }
}

/**
 * Where a saved plan stands today. `latest` is the player's newest snapshot ({ skills }) and `history` their snapshots
 * (oldest first, for the pace); both may be missing, and a plan with no starting point has nothing to measure from.
 * Returns { tracked: false, summary } or { tracked: true, progress, projection, next }.
 */
export function planStatus(plan, { latest = null, history = null, confirmations = {}, respect = true } = {}, now = new Date()) {
  const goals = plan.goals || []
  if (!latest?.skills || !plan.statsAt || !goals.length) return { tracked: false, summary: summarizePlan(plan) }

  const strategy = plan.globalStrategy || AUTO_FAST
  const gp = plan.gpValue || DEFAULT_GP_VALUE
  const blockedIds = blockedFor(plan, latest, confirmations, respect)
  const prepare = (g) => ({ ...resolveGoal(g, strategy, gp), blockedMethodIds: blockedIds })
  const liveGoals = goals.map((g) => liveGoalFor(g, latest.skills[g.skill]?.xp))
  const originalPlans = goals.map((g) => planGoal(prepare(g)))
  const livePlans = liveGoals.map((g) => planGoal(prepare(g)))
  const progress = buildProgress(goals, liveGoals, originalPlans, livePlans, plan.hoursPerDay, plan.statsAt, now)

  let projection = null
  if (!progress.complete && history?.length) {
    const hpd = Number(plan.hoursPerDay)
    projection = projectFinish({
      snapshots: history,
      goals,
      remainingXp: progress.remainingXp,
      plannedDays: hpd > 0 ? progress.originalHours / hpd : null,
      baselineAt: plan.statsAt,
      now,
      per: progress.per,
      liveHours: progress.liveHours,
    })
  }
  // The skill being trained now: the first goal in the plan that is not finished.
  const next = progress.per.find((p) => !p.done) || null
  return { tracked: true, progress, projection, next, hoursLeft: progress.liveHours }
}

/**
 * How long until a plan is done, for ordering plans soonest first: days from now. Uses the pace the player has really kept
 * when there is one, otherwise the plan's own hours at its daily playtime. Plans being followed come first; one that has not
 * been started (nothing tracked) is estimated from its total hours but sorts after them; one with nothing to measure comes
 * next, and a finished plan is last.
 */
export function finishDays(plan, status) {
  const FINISHED = 1e12
  const UNKNOWN = 1e11
  const NOT_STARTED = 1e6
  const hpd = Number(plan?.hoursPerDay)
  if (!status) return UNKNOWN
  if (!status.tracked) {
    const hours = status.summary?.totalHours
    return hpd > 0 && Number.isFinite(hours) ? NOT_STARTED + hours / hpd : UNKNOWN
  }
  if (status.progress.complete) return FINISHED
  const pr = status.projection
  if (pr && pr.status !== 'none' && Number.isFinite(pr.daysLeft)) return pr.daysLeft
  return hpd > 0 && Number.isFinite(status.hoursLeft) ? status.hoursLeft / hpd : UNKNOWN
}

/** The goals to show on the dashboard: pinned first, then the closest to done, finished ones last. */
export function dashboardGoals(goals, limit = 4) {
  return [...(goals || [])]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(a.reached) - Number(b.reached) || b.percent - a.percent)
    .slice(0, limit)
}

// --- What's next -----------------------------------------------------------------------------------------------------

/** "under a day", "about 9 days", "about 3 months" for a number of days, or '' when it is too far off to mean anything. */
export function etaText(days) {
  if (!Number.isFinite(days) || days < 0) return ''
  if (days < 1) return 'under a day'
  if (days < 60) return `about ${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`
  if (days < 730) return `about ${Math.round(days / 30)} months`
  return ''
}

/**
 * XP a day gained in each skill over the week's days: Map(skill -> xp/day). `spanDays` is how much real time those gains cover
 * (see paceSpanDays); without it the number of days is used. Counting today as a whole day would drag the pace down every
 * morning, before any XP has been gained, and the projected dates would jump back up by evening.
 */
export function skillRates(days, spanDays) {
  const sums = new Map()
  for (const d of days || []) for (const s of d.skills || []) sums.set(s.skill, (sums.get(s.skill) || 0) + s.xp)
  const n = Math.max(Number(spanDays) > 0 ? Number(spanDays) : days?.length || 0, 1)
  return new Map([...sums].map(([skill, xp]) => [skill, xp / n]))
}

// How an achievement reads as something to reach: "Reach 10M Agility XP", "Reach total level 2,000".
function goalTitle(a) {
  if (a.type === 'total_level') return `Reach total level ${Number(a.value).toLocaleString('en-US')}`
  if (a.type === 'total_xp') return `Reach ${formatXp(a.value)} total XP`
  if (a.type === 'skill_xp') return `Reach ${formatXp(a.value)} ${a.skill} XP`
  return `Reach ${a.title}`
}

/**
 * The nearest things to reach, from the player's stats and how fast they have been training this week: the next level-ups
 * in the skills being trained, the closest 99s, and the achievements nearly earned. Each: { key, kind, skill, title,
 * detail, eta, pct } where eta is "about 9 days" (at the player's pace) or ''. Soonest first.
 */
export function whatsNext({ latest, achievements = [], days = [], spanDays, pace = null, now = Date.now(), limit = 5 }) {
  const skills = latest?.skills || {}
  // `pace` ({ rates, today } from paceRates) is the average of the last seven full game days plus what was gained so far today; without it the
  // week's days and `spanDays` are used.
  const rates = pace?.rates || skillRates(days, spanDays)
  const todayGain = (skill) => (pace ? pace.today.get(skill) || 0 : 0)
  const totalToday = pace ? [...pace.today.values()].reduce((a, b) => a + b, 0) : 0
  // Which game day (counted from today, 0 = today) the XP runs out on: the rest of today first (an average day less what has been gained),
  // then whole days. Days run 6 AM to 6 AM, so XP gained at 1 AM still counts for the day before.
  const offsetFor = (remaining, rate, gainedToday) => {
    if (!pace || !(rate > 0)) return null
    const leftToday = Math.max(rate - gainedToday, 0)
    return remaining <= leftToday ? 0 : Math.ceil((remaining - leftToday) / rate)
  }
  const totalRate = [...rates.values()].reduce((a, b) => a + b, 0)
  const etaFor = (remaining, rate) => (rate > 0 ? etaText(remaining / rate) : '')
  const daysFor = (remaining, rate) => (rate > 0 ? remaining / rate : Infinity)

  const levelUps = []
  const nines = []
  for (const skill of SKILL_NAMES) {
    const xp = Number(skills[skill]?.xp)
    if (!Number.isFinite(xp)) continue
    const level = Math.min(levelAtXp(xp), 99)
    if (level >= 99) continue
    const rate = rates.get(skill) || 0
    const base = xpAtLevel(level)
    const nextXp = xpAtLevel(level + 1)
    if (rate > 0) {
      levelUps.push({ key: `${skill}:${level + 1}`, kind: 'level', skill, title: `Reach level ${level + 1} ${skill}`, detail: `${formatXp(nextXp - xp)} XP to go`, eta: etaFor(nextXp - xp, rate), days: daysFor(nextXp - xp, rate), dueOffset: offsetFor(nextXp - xp, rate, todayGain(skill)), pct: (xp - base) / (nextXp - base) })
    }
    if (level >= 85) {
      const left = xpAtLevel(99) - xp
      nines.push({ key: `${skill}:99`, kind: 'ninetynine', skill, title: `Reach 99 ${skill}`, detail: `${formatXp(left)} XP to go`, eta: etaFor(left, rate), days: daysFor(left, rate), dueOffset: offsetFor(left, rate, todayGain(skill)), pct: xp / xpAtLevel(99), left })
    }
  }
  levelUps.sort((a, b) => a.days - b.days)
  nines.sort((a, b) => a.left - b.left)

  const near = []
  for (const a of achievements) {
    if (a.completed || a.type === 'skill_level' || a.progress < 0.6) continue
    const left = a.value - a.current
    const rate = a.type === 'skill_xp' ? rates.get(a.skill) || 0 : a.type === 'total_xp' ? totalRate : 0
    near.push({
      key: a.key,
      kind: 'achievement',
      skill: a.type === 'skill_xp' ? a.skill : null,
      title: goalTitle(a),
      detail: a.type === 'total_level' ? `${formatNum(left)} level${left === 1 ? '' : 's'} to go` : `${formatXp(left)} XP to go`,
      eta: a.type === 'total_level' ? '' : etaFor(left, rate),
      days: a.type === 'total_level' ? Infinity : daysFor(left, rate),
      dueOffset: a.type === 'total_level' ? null : offsetFor(left, rate, a.type === 'skill_xp' ? todayGain(a.skill) : totalToday),
      pct: a.progress,
    })
  }
  near.sort((a, b) => b.pct - a.pct)

  const seen = new Set()
  const picked = []
  for (const item of [...levelUps.slice(0, 2), ...nines.slice(0, 2), ...near.slice(0, 2)]) {
    if (seen.has(item.key)) continue
    seen.add(item.key)
    picked.push(item)
  }
  // Soonest first (known pace before unknown), then the closest to done.
  picked.sort((a, b) => (a.days === b.days ? b.pct - a.pct : a.days - b.days))
  // etaDays is how many days at the current pace (null with no pace, or too far off to mean anything).
  return picked.slice(0, limit).map(({ days, left: _l, dueOffset, ...item }) => ({ ...item, etaDays: Number.isFinite(days) && days < 730 ? days : null, ...(dueOffset != null ? { dueOffset } : {}) }))
}

// --- The timeline ----------------------------------------------------------------------------------------------------

const DAY_MS = 86_400_000
const HORIZON_DAYS = 90
const localKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// A game-day key ('2026-11-24') as a local date at midnight, so the month, day and weekday read as that day.
const gameDayDate = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const startOfDay = (t) => {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Lays the "what's next" items out as a timeline: one stop per day, soonest first, each with the items that should be
 * reached that day at the player's pace. Items with no pace, or further off than about three months (or `horizonDays`), go in `later`.
 * Returns { groups: [{ key, month, day, year, weekday, whenText, items }], later }.
 */
export function timelineModel(items, now = Date.now(), horizonDays = HORIZON_DAYS) {
  const today = startOfDay(now)
  const withDue = []
  const later = []
  for (const item of items || []) {
    if (item.etaDays == null || item.etaDays > horizonDays) {
      later.push(item)
      continue
    }
    // With a day count worked out in game days (6 AM to 6 AM), the date is that game day's; else the calendar day the pace lands on.
    const due = item.dueOffset != null ? gameDayDate(addGameDays(gameDay(now), item.dueOffset)) : startOfDay(now + item.etaDays * DAY_MS)
    withDue.push({ ...item, due, dueOffset: item.dueOffset })
  }
  withDue.sort((a, b) => a.due - b.due || a.etaDays - b.etaDays)
  later.sort((a, b) => (a.etaDays ?? Infinity) - (b.etaDays ?? Infinity))

  const todayGameDay = gameDayDate(gameDay(now))
  const relText = (due, offset) => {
    const n = offset != null ? Math.round((due - todayGameDay) / DAY_MS) : Math.round((due - today) / DAY_MS)
    return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`
  }
  const groups = []
  for (const item of withDue) {
    const key = localKey(item.due)
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) {
      g = {
        key,
        month: item.due.toLocaleDateString(undefined, { month: 'short' }),
        day: item.due.getDate(),
        year: item.due.getFullYear(),
        weekday: item.due.toLocaleDateString(undefined, { weekday: 'short' }),
        whenText: relText(item.due, item.dueOffset),
        items: [],
      }
      groups.push(g)
    }
    const { due: _due, dueOffset: _off, ...rest } = item
    g.items.push(rest)
  }
  return { groups, later }
}

// --- Recent milestones -----------------------------------------------------------------------------------------------

const dayDate = (key) => new Date(`${key}T12:00:00Z`)

/** "today", "yesterday", "3 days ago" for a date. */
export function whenText(at, now = Date.now()) {
  const days = Math.floor((now - new Date(at).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  return days === 1 ? 'yesterday' : `${days} days ago`
}

/**
 * The latest things worth a mention, newest first: achievements earned in the last 30 days (with the congratulations they
 * got), level-ups from this week's gains, and records set in the last day or two. Each: { id, kind, title, detail, at, cheers }.
 */
export function recentMilestones({ timeline = [], celebrations = [], days = [], records = [], now = Date.now(), limit = 6 }) {
  const cheers = new Map((celebrations || []).map((c) => [`${c.type}|${c.skill || ''}|${c.value}`, c.cheers || 0]))
  const out = []
  const earned = new Set()
  for (const t of timeline || []) {
    if (!t.occurredAt) continue
    const at = new Date(t.occurredAt)
    if (now - at.getTime() > 30 * 86_400_000) continue
    earned.add(`${t.skill || ''}:${t.value}`)
    out.push({ id: `a:${t.key}`, kind: 'achievement', skill: t.skill || '', title: t.title, detail: String(t.description || '').replace(/\.$/, ''), at, cheers: cheers.get(`${t.type}|${t.skill || ''}|${t.value}`) || 0 })
  }
  for (const d of days || []) {
    for (const s of d.skills || []) {
      if (!s.levels || s.levels <= 0 || !s.level) continue
      // A 50, 70, 90 or 99 is already listed as an achievement.
      if (earned.has(`${s.skill}:${s.level}`)) continue
      out.push({ id: `l:${d.key}:${s.skill}`, kind: 'level', skill: s.skill, title: `${s.skill} level ${s.level}`, detail: s.levels > 1 ? `${s.levels} levels gained` : 'Level up', at: dayDate(d.key), cheers: 0 })
    }
  }
  for (const r of records || []) {
    if (r.locked || !r.fresh || !r.end) continue
    out.push({ id: `r:${r.key}`, kind: 'record', skill: r.skill || '', title: `New record: ${r.title}`, detail: `${recordValueText(r)} ${recordUnitText(r)}`.trim(), at: dayDate(r.end), cheers: 0 })
  }
  return out.sort((a, b) => b.at - a.at).slice(0, limit)
}
