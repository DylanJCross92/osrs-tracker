// What a "this plan looks wrong" report carries: the answers and the plan the Smart Planner made, in the small shape the server accepts
// (server/src/utils/feedback.js cleanPlanContext). Never a player name: skills, levels, hours and the planner's own titles and notes.

/** `plan` is the result of recommend() (utils/smartPlanner.js). */
export function reportContext(plan) {
  const p = plan?.profile || {}
  const rows = (plan?.phases || []).filter((x) => !x.later).flatMap((x) => x.rows.filter((r) => r.skill))
  const hoursOf = (skill) => rows.find((r) => r.skill === skill)?.hours
  return {
    profile: { members: p.members, iron: p.iron, goal: p.goal, gp: p.gp, experience: p.experience, hours: p.hours },
    goals: (plan?.goals || []).map((g) => {
      const row = rows.find((r) => r.skill === g.skill)
      return { skill: g.skill, from: row?.from, to: row?.to, hours: Math.round(hoursOf(g.skill) || 0) }
    }),
    phases: (plan?.phases || []).filter((x) => !x.later).map((x) => ({ title: x.title, rows: x.rows.length })),
    notes: plan?.notes || [],
    skipped: (plan?.skippedQuests || []).map((s) => ({ title: s.title, reason: s.reason })),
    assumed: { combat: plan?.assumed?.combat, doneQuests: plan?.assumed?.doneQuests },
  }
}
