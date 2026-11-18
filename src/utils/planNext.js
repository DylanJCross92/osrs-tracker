// What a plan reaches next, and on which day: the next level, the next milestone (the next training method it unlocks) and each skill's goal, dated from the plan's
// own pace (the hours its routes take, at the hours a day it is set to). Pure, so it can be tested without a page. The items
// have the shape the dashboard's timeline lays out (see timelineModel in dashboard.js).
import { formatHours, levelAtXp, xpAtLevel } from '@/utils/planner'
import { hoursToXp } from '@/utils/plannerTools'
import { formatXp } from '@/utils/osrsSkills'

const MAX_ITEMS = 8

/**
 * @param goals    the plan's goals, in training order
 * @param plans    the calculated plan for each goal (startXp, targetXp, segments, hours)
 * @param timeline buildTimeline() of them: entries with start/end hours and milestones
 * @param hoursPerDay how many hours a day the player trains
 * Each item: { key, kind: 'level' | 'milestone' | 'goal', tag, skill, title, detail, etaDays, dateText }, soonest first.
 */
export function planNext(goals, plans, timeline, hoursPerDay, now = new Date()) {
  const hpd = Number(hoursPerDay)
  if (!(hpd > 0)) return []
  const entries = (timeline?.entries || []).map((e, i) => ({ e, i })).filter(({ e }) => !e.done && e.hours > 0)
  if (!entries.length) return []

  const days = (hours) => hours / hpd
  const dateText = (d) => new Date(now.getTime() + d * 86_400_000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const left = (plan, xp) => `${formatXp(Math.max(xp - plan.startXp, 0))} XP to go`
  const make = (kind, tag, skill, title, plan, xp, atHours, extra = '') => ({
    key: `${kind}:${skill}:${xp}`,
    kind,
    tag,
    skill,
    title,
    detail: `${left(plan, xp)}${extra}`,
    etaDays: days(atHours),
    dateText: dateText(days(atHours)),
  })

  const items = []
  const first = entries[0]
  const firstPlan = plans[first.i]
  const firstSkill = goals[first.i].skill

  // The next level in the skill being trained now.
  const nextLevel = levelAtXp(firstPlan.startXp, true) + 1
  const nextXp = xpAtLevel(nextLevel)
  if (nextXp < firstPlan.targetXp) {
    const hours = first.e.startHours + hoursToXp(firstPlan, nextXp)
    const item = make('level', 'Next level', firstSkill, `Reach level ${nextLevel} ${firstSkill}`, firstPlan, nextXp, hours)
    items.push(item)
  }

  // The next milestone: the moment the plan moves on to a new training method, in this skill or the first one after it that
  // has one. A skill's first method is not one (it is where you start); only a switch partway through is.
  for (const { e, i } of entries) {
    const plan = plans[i]
    const timed = (plan.segments || []).filter((seg) => seg.method && seg.hours > 0)
    const sameMethod = (a, b) => (a.method.id != null && b.method.id != null ? a.method.id === b.method.id : a.method.name === b.method.name)
    const k = timed.findIndex((seg, n) => n > 0 && !sameMethod(seg, timed[n - 1]))
    if (k < 0) continue
    const seg = timed[k]
    const skill = goals[i].skill
    const item = make('milestone', 'Milestone', skill, `Unlock ${seg.method.name}`, plan, seg.fromXp, e.startHours + hoursToXp(plan, seg.fromXp))
    item.detail = `Level ${levelAtXp(seg.fromXp, true)} ${skill} · ${item.detail}`
    items.push(item)
    break
  }

  // Every skill's goal. The last one is the end of the plan.
  entries.forEach(({ e, i }, n) => {
    const plan = plans[i]
    const skill = goals[i].skill
    const lvl = levelAtXp(plan.targetXp, true)
    const exact = xpAtLevel(lvl) === plan.targetXp
    const title = exact ? `Reach level ${lvl} ${skill}` : `Reach ${formatXp(plan.targetXp)} ${skill} XP`
    const last = n === entries.length - 1 && entries.length > 1
    items.push(make('goal', last ? 'Plan complete' : 'Goal', skill, title, plan, plan.targetXp, e.endHours, ` · ${formatHours(e.hours)} of training`))
  })

  // A level that is also a goal is shown once, as the goal.
  const goalKeys = new Set(items.filter((x) => x.kind === 'goal').map((x) => x.key.replace(/^goal:/, '')))
  const unique = items.filter((x) => x.kind !== 'level' || !goalKeys.has(x.key.replace(/^level:/, '')))
  unique.sort((a, b) => a.etaDays - b.etaDays)
  if (unique.length <= MAX_ITEMS) return unique
  // Too many: keep the soonest and always the end of the plan.
  return [...unique.slice(0, MAX_ITEMS - 1), unique[unique.length - 1]]
}
