// The training route as a flat list of steps. Nothing here decides what to train or in what order: the plan and the timeline already
// did that. This only lays their results out step by step (each stretch of levels with its method), so the page can show "what is
// next" and let the rest be opened on demand.
export const NEXT_STEPS = 3
const DAY = 86_400_000

/**
 * Every training step in the order the plan trains them: goal by goal (the order on the timeline), and within a goal, level
 * range by level range. Goals that are already reached have no steps.
 * Each: { id, number, goalIndex, skill, segIndex, seg, hours, startHours, endHours, startDate, endDate }
 */
export function buildSteps(goals, plans, timeline, hoursPerDay, startDate = new Date()) {
  const hpd = Number(hoursPerDay) > 0 ? Number(hoursPerDay) : null
  const dateAt = (hours) => (hpd ? new Date(startDate.getTime() + (hours / hpd) * DAY) : null)
  const steps = []
  goals.forEach((g, goalIndex) => {
    const entry = timeline?.entries?.[goalIndex]
    if (!entry || entry.done) return
    let clock = entry.startHours
    ;(plans[goalIndex]?.segments || []).forEach((seg, segIndex) => {
      const hours = seg.hours || 0
      steps.push({
        id: `${g.skill}:${segIndex}`,
        number: steps.length + 1,
        goalIndex,
        skill: g.skill,
        segIndex,
        seg,
        hours,
        startHours: clock,
        endHours: clock + hours,
        startDate: dateAt(clock),
        endDate: dateAt(clock + hours),
      })
      clock += hours
    })
  })
  return steps
}

/** The first few steps: what to train next. */
export const nextSteps = (steps, count = NEXT_STEPS) => steps.slice(0, count)

/**
 * The same steps grouped under their skill (in the order the skills first appear), with what each skill adds up to.
 * Each: { skill, goalIndex, steps, hours, netGp, startLevel, endLevel, startDate, endDate }
 */
export function groupBySkill(steps) {
  const groups = []
  const bySkill = new Map()
  for (const step of steps) {
    let g = bySkill.get(step.skill)
    if (!g) {
      g = { skill: step.skill, goalIndex: step.goalIndex, steps: [], hours: 0, netGp: null, startLevel: step.seg.startLevel, endLevel: step.seg.endLevel, startDate: step.startDate, endDate: step.endDate }
      bySkill.set(step.skill, g)
      groups.push(g)
    }
    g.steps.push(step)
    g.hours += step.hours
    if (step.seg.netGp != null) g.netGp = (g.netGp ?? 0) + step.seg.netGp
    g.startLevel = Math.min(g.startLevel, step.seg.startLevel)
    g.endLevel = Math.max(g.endLevel, step.seg.endLevel)
    g.endDate = step.endDate
  }
  return groups
}

/** How many steps the training route shows before "view full route". */
export const ROUTE_PREVIEW = 5

/**
 * A step list with what the player has already finished put back in. `steps` (from buildSteps) only holds what is still to do,
 * because the plan is worked out from the player's current XP. For a tracked player, the stretches of the original plan whose end
 * the player has already passed are added in front of their goal's remaining steps, marked `done`, so the route reads as a checklist.
 * `liveXp(skill)` is the player's XP now (or null when nobody is tracked, in which case nothing is added).
 * Done steps keep the plan's order: goal by goal, level range by level range. Numbers run through the whole list.
 */
export function withCompleted(steps, goals, originalPlans, liveXp) {
  const byGoal = goals.map(() => [])
  goals.forEach((g, goalIndex) => {
    const xp = liveXp ? liveXp(g.skill) : null
    if (xp == null) return
    ;(originalPlans[goalIndex]?.segments || []).forEach((seg, segIndex) => {
      if (seg.toXp <= xp) byGoal[goalIndex].push({ id: `${g.skill}:done${segIndex}`, goalIndex, skill: g.skill, segIndex, seg, hours: seg.hours || 0, startHours: 0, endHours: 0, startDate: null, endDate: null, done: true })
    })
  })
  const merged = []
  goals.forEach((_, goalIndex) => {
    merged.push(...byGoal[goalIndex])
    merged.push(...steps.filter((s) => s.goalIndex === goalIndex).map((s) => ({ ...s, done: false })))
  })
  return merged.map((s, i) => ({ ...s, number: i + 1 }))
}

/** Where a goal stands: 'done' (target reached), 'active' (tracked progress made) or 'todo'. `per` is that goal's entry from buildProgress, if any. */
export function goalStatus(plan, per) {
  if (per?.done || plan?.remainingXp === 0) return 'done'
  return per && per.gained > 0 ? 'active' : 'todo'
}
