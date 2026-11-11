// Recommended plans for a player: ready-made sets of goals built from their own stats. Nothing here is stored, the plans are
// worked out from the player's current XP each time, so they always start from where the player really is.
import { SKILL_NAMES } from '@/utils/osrsSkills'
import { SKILL_CATEGORIES } from '@/utils/plannerTools'
import { MAX_VIRTUAL_LEVEL, MAX_XP, levelAtXp, xpAtLevel } from '@/utils/planner'

export const MAX_LEVEL = 99
export const MAX_TOTAL = SKILL_NAMES.length * MAX_LEVEL
const LEVEL_TARGETS = [70, 80, 90, 99]
const TOTAL_TARGETS = [1250, 1500, 1750, 2000, 2100, 2200, 2300, MAX_TOTAL]

// A skill nobody has trained starts at level 1 (Hitpoints at 10), which is what a missing or unranked hiscores entry means.
const startXp = (skill) => xpAtLevel(skill === 'Hitpoints' ? 10 : 1)

/** [{ skill, xp, level }] for every skill, from a hiscores skills object like { Mining: { xp, level }, ... } (or null for a new player). */
export function skillStates(skills) {
  return SKILL_NAMES.map((skill) => {
    const raw = skills?.[skill]?.xp
    const xp = Number.isFinite(raw) && raw >= startXp(skill) ? raw : startXp(skill)
    return { skill, xp, level: Math.min(levelAtXp(xp), MAX_LEVEL) }
  })
}

// Past 99: for players who have everything at 99, the only goals left are virtual levels and 200M XP.
const goalToXp = (state, targetXp) => ({ skill: state.skill, currentXp: state.xp, targetXp, methodId: 'global', customXpPerHour: 0, quests: [] })
const goalFor = (state, targetLevel) => ({ skill: state.skill, currentXp: state.xp, targetXp: xpAtLevel(targetLevel), methodId: 'global', customXpPerHour: 0, quests: [] })
const remaining = (g) => g.targetXp - g.currentXp
// Quickest wins first, so the plan's timeline starts finishing goals soon.
const byQuickest = (a, b) => remaining(a) - remaining(b)

function describe(goals) {
  return { skillCount: goals.length, xpNeeded: goals.reduce((sum, g) => sum + remaining(g), 0) }
}

/** Every listed skill (default all) that is below `level`, taken up to it. */
export function levelPlan(states, level, skills = null) {
  return states
    .filter((s) => (!skills || skills.includes(s.skill)) && s.level < level)
    .map((s) => goalFor(s, level))
    .sort(byQuickest)
}

/**
 * The cheapest way, in XP, to reach a total level: keep taking whichever single level costs the least XP across all skills.
 * Each skill's levels cost more as it goes up, so this greedy choice is the true minimum. Returns goals (only skills that
 * need to move) or null when the target is already reached or out of reach.
 */
export function totalLevelPlan(states, targetTotal) {
  const now = states.reduce((sum, s) => sum + s.level, 0)
  if (targetTotal <= now || targetTotal > MAX_TOTAL) return null
  const level = Object.fromEntries(states.map((s) => [s.skill, s.level]))
  // The first step in a skill is measured from the XP the player really has, later steps from the level table.
  const cost = (s) => (level[s.skill] === s.level ? xpAtLevel(level[s.skill] + 1) - s.xp : xpAtLevel(level[s.skill] + 1) - xpAtLevel(level[s.skill]))
  let total = now
  while (total < targetTotal) {
    let best = null
    for (const s of states) {
      if (level[s.skill] >= MAX_LEVEL) continue
      const c = cost(s)
      if (best === null || c < best.c) best = { s, c }
    }
    if (!best) return null
    level[best.s.skill] += 1
    total += 1
  }
  return states.filter((s) => level[s.skill] > s.level).map((s) => goalFor(s, level[s.skill])).sort(byQuickest)
}

const fmt = (n) => n.toLocaleString('en-US')

/**
 * The whole catalogue for a player, in a sensible order. Plans that are already done are left out.
 * Each: { id, kind: 'levels' | 'combat' | 'total', title, description, goals, skillCount, xpNeeded }
 */
export function recommendedPlans(skills) {
  const states = skillStates(skills)
  const total = states.reduce((sum, s) => sum + s.level, 0)
  const out = []
  const add = (plan) => plan.goals.length && out.push({ ...plan, ...describe(plan.goals) })

  for (const level of LEVEL_TARGETS) {
    add({
      id: `all-${level}`,
      kind: 'levels',
      title: level === MAX_LEVEL ? 'Max your account: all skills to 99' : `All skills to ${level}`,
      description: level === MAX_LEVEL ? 'Every skill to 99. The long road, in order from the quickest wins to the longest grinds.' : `Bring every skill up to level ${level}, starting with the ones closest to it.`,
      goals: levelPlan(states, level),
    })
  }
  add({
    id: 'combat-99',
    kind: 'combat',
    title: 'Combat skills to 99',
    description: 'Attack, Strength, Defence, Hitpoints, Ranged, Prayer and Magic, all the way to 99.',
    goals: levelPlan(states, MAX_LEVEL, SKILL_CATEGORIES.combat.skills),
  })
  // Only once every skill is at 99 (a total level of 2,376): the goals that come after maxing.
  if (total >= MAX_TOTAL) {
    const toXp = (xp) => states.filter((st) => st.xp < xp).map((st) => goalToXp(st, xp)).sort(byQuickest)
    add({
      id: 'virtual-126',
      kind: 'levels',
      title: `All skills to ${MAX_VIRTUAL_LEVEL} (virtual max)`,
      description: 'Past 99 every skill keeps levelling, up to virtual level 126. Quickest skills first.',
      goals: toXp(xpAtLevel(MAX_VIRTUAL_LEVEL)),
    })
    add({
      id: 'xp-200m',
      kind: 'levels',
      title: '200M XP in every skill',
      description: 'The ultimate completionist goal: every skill to the 200 million XP cap.',
      goals: toXp(MAX_XP),
    })
  }
  for (const target of TOTAL_TARGETS) {
    const goals = totalLevelPlan(states, target)
    if (goals) {
      add({
        id: `total-${target}`,
        kind: 'total',
        title: target === MAX_TOTAL ? `Max total level (${fmt(target)})` : `Total level ${fmt(target)}`,
        description: `${fmt(target - total)} levels to go. Takes the cheapest levels first, wherever they are, so you reach ${fmt(target)} with the least XP.`,
        goals,
        targetTotal: target,
      })
    }
  }
  return out
}

/** A short list worth showing when someone already has plans: the nearest few of each kind. */
export function suggestedPlans(plans, limit = 4) {
  const byXp = (a, b) => a.xpNeeded - b.xpNeeded
  const levels = plans.filter((p) => p.kind === 'levels').sort(byXp)
  const totals = plans.filter((p) => p.kind === 'total').sort(byXp)
  const combat = plans.filter((p) => p.kind === 'combat')
  const picked = [...levels.slice(0, 2), ...totals.slice(0, 1), ...combat.slice(0, 1), ...levels.slice(2), ...totals.slice(1)]
  return picked.slice(0, limit)
}
