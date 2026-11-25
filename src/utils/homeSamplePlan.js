// The example plan on the welcome page. It is the Smart Planner's own answer for a sample account (the same code the planner page runs),
// so the order, the reasons and the hours are real, not a picture. The gp figures use the Grand Exchange prices once they have loaded
// (see startPrices): they are read through the price book, so a plan built after that uses live prices.
import { recommend } from '@/utils/smartPlanner'
import { xpAtLevel } from '@/utils/planner'
import { SKILL_NAMES } from '@/utils/osrsSkills'
import { priceStatus, priceVersion, usePrices } from '@/utils/priceBook'
import { PRICE_NAMES } from '@/utils/priceNames'

export { priceStatus, priceVersion }

// A sample account: a returning player with decent combat and mid skills.
export const SAMPLE_LEVELS = {
  Attack: 70, Strength: 72, Defence: 68, Ranged: 70, Prayer: 55, Magic: 68, Runecraft: 42, Construction: 50, Hitpoints: 72, Agility: 55,
  Herblore: 60, Thieving: 58, Crafting: 55, Fletching: 55, Slayer: 60, Hunter: 45, Mining: 70, Smithing: 60, Fishing: 62, Cooking: 65,
  Firemaking: 60, Woodcutting: 70, Farming: 55,
}
export const SAMPLE_PROFILE = { members: true, goal: 'quests', hours: 2, gp: 'low', experience: 'returning' }

/** Starts loading live prices for the plan; returns the function that stops refreshing them. Never throws. */
export function startPrices() {
  try {
    return usePrices(PRICE_NAMES)
  } catch {
    return () => {}
  }
}

const minutesText = (hours) => (hours < 1 ? `${Math.max(5, Math.round((hours * 60) / 5) * 5)} min` : `${Math.round(hours)} h`)

/**
 * { quests: [{ title, rewards, time, reason }], steps: [{ skill, from, to, time, netGp, reason }], goals, hours, days, netGp, doneQuests }
 * quests are the quest shortcuts the plan starts with, steps the first skill steps, the other figures the totals of the whole plan.
 */
export function buildSamplePlan() {
  const skills = {}
  for (const skill of SKILL_NAMES) {
    const level = SAMPLE_LEVELS[skill] ?? 1
    skills[skill] = { xp: xpAtLevel(level), level }
  }
  const r = recommend(SAMPLE_PROFILE, skills)
  const rows = r.phases.filter((p) => !p.later).flatMap((p) => p.rows)
  const quests = rows
    .filter((x) => x.kind === 'quest')
    .slice(0, 1)
    .map((x) => ({ title: x.title, rewards: x.rewards, time: minutesText(x.hours || 0.25), reason: (x.reasons || [])[0] || '' }))
  const steps = rows
    .filter((x) => x.kind !== 'quest' && x.skill)
    .slice(0, 3)
    .map((x) => ({ skill: x.skill, from: x.from, to: x.to, time: minutesText(x.hours), netGp: Number.isFinite(x.netGp) ? x.netGp : null, reason: (x.reasons || [])[0] || '' }))
  return { quests, steps, goals: r.totals.goals, hours: r.totals.hours, days: Math.ceil(r.totals.days), netGp: Number.isFinite(r.totals.netGp) ? r.totals.netGp : null, doneQuests: r.assumed.doneQuests }
}
