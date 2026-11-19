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

// --- A whole plan as the profile's goal -------------------------------------------------------------------------------------
export const MAX_PLAN_GOALS = 30
const PLAN_ID = /^[A-Za-z0-9_-]{1,64}$/

/** A target in XP as a profile goal: a level when the XP is exactly a level (2 to 126), otherwise an XP amount. */
export function targetFromXp(xp) {
  const n = Math.round(Number(xp))
  for (let level = 2; level <= MAX_LEVEL; level++) if (xpAtLevel(level) === n) return { type: 'level', target: level }
  return { type: 'xp', target: n }
}

/**
 * A plan sent by its owner, cleaned: { planId, name, goals: [{ skill, type, target }] } in plan order, one goal per skill,
 * or null when it is not usable. Each goal arrives as { skill, targetXp }.
 */
export function cleanPlanInput(input) {
  if (!input || typeof input !== 'object') return null
  const planId = String(input.planId || '')
  if (!PLAN_ID.test(planId)) return null
  const name = String(input.name || '').trim().slice(0, 60) || 'Training plan'
  if (!Array.isArray(input.goals) || !input.goals.length || input.goals.length > MAX_PLAN_GOALS) return null
  const seen = new Set()
  const goals = []
  for (const g of input.goals) {
    const skill = String(g?.skill || '')
    const xp = Math.round(Number(g?.targetXp))
    if (!SKILL_NAMES.includes(skill) || !Number.isFinite(xp) || xp < 1 || xp > MAX_XP) return null
    if (seen.has(skill)) continue
    seen.add(skill)
    goals.push({ skill, ...targetFromXp(xp) })
  }
  return { planId, name, goals }
}

/** Overall progress of a plan's goals (each with targetXp, currentXp, reached): the XP gained toward all the targets, and how many are reached. */
export function planSummary(goals) {
  const total = goals.reduce((s, g) => s + g.targetXp, 0)
  const done = goals.reduce((s, g) => s + (g.reached ? g.targetXp : Math.min(g.currentXp, g.targetXp)), 0)
  return { percent: total ? Math.min(Math.floor((done / total) * 100), 100) : 0, reached: goals.filter((g) => g.reached).length, count: goals.length }
}
