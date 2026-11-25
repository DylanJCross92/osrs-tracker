// The example plan on the welcome page. It is worked out with the planner's own routing, so the methods and hours are the real
// ones for these goals (fastest route, no quests), not a picture. Gp is left out on purpose: the planner prices everything from live
// Grand Exchange data, and this page only needs the shape of a plan.
import { AUTO_FAST, planGoal, xpAtLevel } from '@/utils/planner'

export const SAMPLE_GOALS = [
  { skill: 'Fletching', from: 55, to: 99 },
  { skill: 'Herblore', from: 60, to: 99 },
  { skill: 'Woodcutting', from: 70, to: 99 },
  { skill: 'Mining', from: 70, to: 99 },
]

/**
 * { rows: [{ skill, from, to, hours, method, more, done: Date }], totalHours, days }. Goals are done one after another at
 * `hoursPerDay`, so each row's `done` is the day it would be finished. `method` is the route's longest stretch, `more` how many
 * other methods the route uses.
 */
export function buildSamplePlan({ hoursPerDay = 2, start = new Date() } = {}) {
  let elapsed = 0
  const rows = []
  for (const g of SAMPLE_GOALS) {
    const r = planGoal({ skill: g.skill, currentXp: xpAtLevel(g.from), targetXp: xpAtLevel(g.to), methodId: AUTO_FAST, customXpPerHour: 0, quests: [] })
    const segments = (r.segments || []).filter((s) => s.method)
    if (!segments.length || !Number.isFinite(r.hours)) continue
    const longest = segments.reduce((a, b) => (b.hours > a.hours ? b : a))
    elapsed += r.hours
    rows.push({
      skill: g.skill,
      from: g.from,
      to: g.to,
      hours: r.hours,
      method: longest.method.name,
      more: segments.length - 1,
      done: new Date(start.getTime() + Math.ceil(elapsed / hoursPerDay) * 86_400_000),
    })
  }
  return { rows, totalHours: elapsed, days: Math.ceil(elapsed / hoursPerDay) }
}
