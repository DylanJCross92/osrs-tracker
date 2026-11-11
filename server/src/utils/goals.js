import { SKILL_NAMES } from '../services/osrsHiscores.service.js'

// Public profile goals: a skill and either a level or an XP total. Pure helpers (no database) so they can be tested.
export const MAX_ACTIVE_GOALS = 6
export const MAX_XP = 200_000_000
export const MAX_LEVEL = 126

// The game's XP table, built with integer math (level 99 = 13,034,431; level 126 = 188,884,740).
const XP_TABLE = (() => {
  const table = [0, 0]
  let points = 0
  for (let lvl = 1; lvl < MAX_LEVEL; lvl++) {
    points += Math.floor(lvl + 300 * 2 ** (lvl / 7))
    table[lvl + 1] = Math.floor(points / 4)
  }
  return table
})()
export const xpAtLevel = (level) => XP_TABLE[Math.min(Math.max(Math.floor(level), 1), MAX_LEVEL)]

const fmt = (n) => (n >= 1e6 ? `${parseFloat((n / 1e6).toFixed(n >= 1e7 ? 1 : 2))}M` : n >= 1e3 ? `${parseFloat((n / 1e3).toFixed(1))}K` : String(n))

/** { skill, type, target } from a request, cleaned, or null when it is not a real goal. */
export function cleanGoalInput(input) {
  if (!input || typeof input !== 'object') return null
  const skill = String(input.skill || '')
  if (!SKILL_NAMES.includes(skill)) return null
  const type = input.type === 'level' || input.type === 'xp' ? input.type : null
  const target = Math.floor(Number(input.target))
  if (!type || !Number.isFinite(target)) return null
  if (type === 'level' && (target < 2 || target > MAX_LEVEL)) return null
  if (type === 'xp' && (target < 1 || target > MAX_XP)) return null
  return { skill, type, target }
}

export const goalTargetXp = (g) => (g.type === 'level' ? xpAtLevel(g.target) : g.target)
export const goalTitle = (g) => (g.type === 'level' ? `${g.target} ${g.skill}` : `${fmt(g.target)} ${g.skill} XP`)

/** Where a goal stands for a given current XP. */
export function goalProgress(g, currentXp) {
  const targetXp = goalTargetXp(g)
  const xp = Math.max(Number(currentXp) || 0, 0)
  return {
    targetXp,
    currentXp: xp,
    percent: Math.min(Math.floor((xp / targetXp) * 100), 100),
    remainingXp: Math.max(targetXp - xp, 0),
    reached: xp >= targetXp,
  }
}
