// The "next quest" the dashboard shows beside the quest tracker link: the quest that helps the plan being worked on the most, or failing that
// the best thing to do next in general (see utils/trackerSuggestions.js).
import { AUTO_FAST, DEFAULT_GP_VALUE } from '@/utils/planner'
import { liveGoalFor } from '@/utils/plannerTools'
import { blockedFor } from '@/utils/dashboard'
import { nextForPlan, suggestNext } from '@/utils/trackerSuggestions'
import { SKILL_NAMES } from '@/utils/osrsSkills'

const levelsFrom = (latest) => {
  if (!latest?.skills) return null
  const out = {}
  for (const name of SKILL_NAMES) if (Number.isFinite(latest.skills[name]?.level)) out[name] = latest.skills[name].level
  return Object.keys(out).length ? out : null
}

/**
 * rows: the saved plans measured against their players ([{ plan, status, latest }], in the order to show them). `latest` is the player the dashboard
 * is for; a plan with a tracked player of its own is judged against that player's stats instead. Returns the suggestion, with `source` 'plan' (it
 * helps that plan, and `why` says how) or 'general', or null when everything is done.
 */
export function trackerPick({ rows = [], latest = null, confirmations = {}, respect = true, members = true, build = 'main' } = {}) {
  const row = rows.find((r) => r.status?.tracked && r.latest?.skills && !r.status.progress?.complete)
  if (row) {
    const stats = row.latest
    const goals = (row.plan.goals || []).map((g) => liveGoalFor(g, stats.skills[g.skill]?.xp))
    const pick = nextForPlan(confirmations, levelsFrom(stats), {
      goals,
      strategy: row.plan.globalStrategy || AUTO_FAST,
      gpValue: row.plan.gpValue || DEFAULT_GP_VALUE,
      blockedMethodIds: blockedFor(row.plan, stats, confirmations, respect),
      planName: row.plan.name || 'your plan',
      // A free-to-play plan is only pointed at free quests, and so is a free-to-play account.
      members: members && row.plan.members !== false,
      // The plan's own build (a skiller's plan is only pointed at quests a skiller can do), else the account's.
      build: row.plan.build || build,
    })
    if (pick) return pick
  }
  const general = suggestNext(confirmations, levelsFrom(latest), { limit: 1, members, build })[0]
  return general ? { ...general, source: 'general', planName: '' } : null
}
