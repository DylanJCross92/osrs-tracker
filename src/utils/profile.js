import { SKILL_NAMES } from '@/utils/osrsSkills'
import { levelAtXp } from '@/utils/planner'

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

export { levelAtXp }
