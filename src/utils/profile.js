import { SKILL_NAMES, xpForLevel } from '@/utils/osrsSkills'
import { levelAtXp } from '@/utils/planner'
import { methodsForSkill } from '@/data/trainingMethods'
import { planGoal, encodePlan, xpAtLevel } from '@/utils/planner'

export const MAX_TOTAL_LEVEL = SKILL_NAMES.length * 99

/** Highest-level (ties: most xp) skill from a snapshot. */
export function highestSkill(snapshot) {
  const entries = Object.entries(snapshot?.skills || {})
  entries.sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp)
  return entries[0] ? { skill: entries[0][0], ...entries[0][1] } : null
}

export function mostXpSkill(snapshot) {
  const entries = Object.entries(snapshot?.skills || {})
  entries.sort((a, b) => b[1].xp - a[1].xp)
  return entries[0] ? { skill: entries[0][0], ...entries[0][1] } : null
}

export function count99s(snapshot) {
  return Object.values(snapshot?.skills || {}).filter((s) => s.level >= 99).length
}

// Priority for choosing "featured" achievements: 200M xp, then 99s, then
// total-level, then total-xp, then everything else.
function featuredRank(a) {
  if (a.type === 'skill_xp' && a.value >= 200_000_000) return 0
  if (a.type === 'skill_level' && a.value === 99) return 1
  if (a.type === 'total_level') return 2
  if (a.type === 'total_xp') return 3
  return 4
}

export function featuredAchievements(achievements, limit = 5) {
  return achievements
    .filter((a) => a.completed)
    .sort((a, b) => featuredRank(a) - featuredRank(b) || b.value - a.value)
    .slice(0, limit)
}

const fastestMethodFor = (skill) => {
  const list = methodsForSkill(skill)
  return list.find((m) => m.fastest) || [...list].sort((a, b) => b.xpPerHour - a.xpPerHour)[0] || null
}

function hoursFor(skill, currentXp, targetXp) {
  const method = fastestMethodFor(skill)
  if (!method) return null
  const plan = planGoal({ skill, currentXp, targetXp, methodId: method.id })
  return plan.hours > 0 ? plan.hours : null
}

function plannerQuery(username, skill, currentXp, targetXp) {
  const method = fastestMethodFor(skill)
  const params = encodePlan({
    username,
    hoursPerDay: 2,
    goals: [{ skill, currentXp, targetXp, methodId: method ? method.id : 'custom', customXpPerHour: 0 }],
  })
  return Object.fromEntries(params)
}

/**
 * Auto-generated suggestions (not commitments, there are no owned
 * profiles yet): next level of the closest-to-leveling skill, the closest
 * 99, the next total-level milestone, and the next big skill-xp milestone.
 */
export function suggestedGoals(snapshot, username) {
  if (!snapshot) return []
  const skills = Object.entries(snapshot.skills || {}).map(([skill, s]) => ({ skill, ...s }))
  const goals = []

  const make = (title, skill, currentXp, targetXp, targetLabel, currentLabel) => {
    const remaining = Math.max(targetXp - currentXp, 0)
    const start = skill ? 0 : 0
    return {
      title,
      skill,
      currentLabel,
      targetLabel,
      currentXp,
      targetXp,
      remainingXp: remaining,
      percent: Math.min(Math.round((currentXp / targetXp) * 1000) / 10, 100),
      hours: skill ? hoursFor(skill, currentXp, targetXp) : null,
      plannerQuery: skill ? plannerQuery(username, skill, currentXp, targetXp) : { u: username },
      _start: start,
    }
  }

  // Next skill level: the skill with the least xp left to its next level.
  const leveling = skills
    .filter((s) => s.level < 99)
    .map((s) => ({ ...s, left: xpForLevel(s.level + 1) - s.xp }))
    .sort((a, b) => a.left - b.left)[0]
  if (leveling) {
    goals.push({
      ...make(`Next level: ${leveling.skill}`, leveling.skill, leveling.xp, xpForLevel(leveling.level + 1), `Level ${leveling.level + 1}`, `Level ${leveling.level}`),
      percent: Math.round(((leveling.xp - xpForLevel(leveling.level)) / (xpForLevel(leveling.level + 1) - xpForLevel(leveling.level))) * 1000) / 10,
    })
  }

  // Closest 99: highest xp progress toward 99 among skills under it.
  const closest99 = skills.filter((s) => s.level < 99).sort((a, b) => b.xp - a.xp)[0]
  if (closest99 && (!leveling || closest99.skill !== leveling.skill || closest99.level + 1 !== 99)) {
    goals.push(make(`Closest 99: ${closest99.skill}`, closest99.skill, closest99.xp, xpAtLevel(99), 'Level 99', `Level ${closest99.level}`))
  }

  // Next total-level milestone.
  const totalTargets = [500, 1000, 1500, 2000, 2200, MAX_TOTAL_LEVEL]
  const nextTotal = totalTargets.find((t) => t > snapshot.overallLevel)
  if (nextTotal) {
    goals.push({
      title: `Next Overall: ${nextTotal.toLocaleString()}`,
      skill: null,
      currentLabel: `${snapshot.overallLevel.toLocaleString()} Overall`,
      targetLabel: `${nextTotal.toLocaleString()} Overall`,
      currentXp: snapshot.overallLevel,
      targetXp: nextTotal,
      remainingXp: null,
      remainingLevels: nextTotal - snapshot.overallLevel,
      percent: Math.round((snapshot.overallLevel / nextTotal) * 1000) / 10,
      hours: null,
      plannerQuery: { u: username },
    })
  }

  // Next major skill XP milestone for the player's top-xp skill that isn't maxed.
  const xpTargets = [10_000_000, 25_000_000, 50_000_000, 100_000_000, 200_000_000]
  const topXp = [...skills].sort((a, b) => b.xp - a.xp).find((s) => xpTargets.some((t) => t > s.xp))
  if (topXp) {
    const target = xpTargets.find((t) => t > topXp.xp)
    goals.push(make(`${target / 1e6}M XP: ${topXp.skill}`, topXp.skill, topXp.xp, target, `${target / 1e6}M XP`, `${(topXp.xp / 1e6).toFixed(1)}M XP`))
  }
  return goals
}

export { levelAtXp }
