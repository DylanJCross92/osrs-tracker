// What a build (data/builds.js) does to a plan: which skills are locked or capped, which methods and quests would break it, how a goal is trimmed
// to fit, and which build a player's stats already look like. Pure functions, so they are easy to test.
import { QUEST_DATA } from '@/data/questData.generated'
import { buildOf, cleanBuild, cleanIronKind } from '@/data/builds'
import { requirementsFor } from '@/data/methodRequirements'
import { getQuest, questChain } from '@/data/quests'
import { methodsForSkill } from '@/data/trainingMethods'
import { combatLevel } from '@/utils/combat'
import { SKILL_NAMES } from '@/utils/osrsSkills'
import { levelAtXp, xpAtLevel } from '@/utils/planner'
import { F2P_SKILLS } from '@/data/plannerMilestones'
import { questBySlug } from '@/data/questList'
import { questSlug } from '@/utils/questSlug'

const MAX = 99
// Every skill starts at 1, Hitpoints at 10.
export const startLevel = (skill) => (skill === 'Hitpoints' ? 10 : 1)

// Most functions below take the account's rules, { build, members }, or just a build key. A free-to-play account (members false) never trains a members-only skill.
const rulesOf = (x) => (x && typeof x === 'object' ? { build: x.build ?? 'main', members: x.members !== false } : { build: x ?? 'main', members: true })
/** True when a free-to-play account cannot train this skill at all (it is members-only). */
export const isMembersSkill = (skill) => !F2P_SKILLS.includes(skill)
const isFreeQuest = (q) => q.members === false || questBySlug(questSlug(q.name))?.type === 'F'

/** The highest level this account may take a skill to (99 when it has no limit): the build's cap, or the starting level for a members-only skill when free-to-play. */
export function skillCap(rules, skill) {
  const r = rulesOf(rules)
  if (!r.members && isMembersSkill(skill)) return startLevel(skill)
  return Math.min(buildOf(r.build).caps[skill] ?? MAX, MAX)
}
/** Why a skill is locked for these rules: 'members' (free-to-play), 'build', or '' when it can be trained. */
export function lockReason(rules, skill) {
  const r = rulesOf(rules)
  if (!r.members && isMembersSkill(skill)) return 'members'
  return skillCap(r.build, skill) <= startLevel(skill) ? 'build' : ''
}
/** True when the account never trains this skill (it is capped at the level it starts at). */
export const isLocked = (build, skill) => skillCap(build, skill) <= startLevel(skill)
/** The skills a build never trains, in the game's order. */
export const lockedSkills = (build) => SKILL_NAMES.filter((s) => isLocked(build, s))
/** The skills a build can train. */
export const trainableSkills = (build) => SKILL_NAMES.filter((s) => !isLocked(build, s))
/** The total level the build can reach: every skill at its cap. */
export const buildMaxTotal = (build) => SKILL_NAMES.reduce((sum, s) => sum + skillCap(build, s), 0)
/** The XP at which the build stops a skill. */
export const capXp = (build, skill) => xpAtLevel(skillCap(build, skill))

const RISKY = /wilderness|revenant/i
const isRisky = (method) => RISKY.test(`${method.id} ${method.name} ${method.requirements || ''}`)

const BY_NAME = new Map(QUEST_DATA.map((d) => [d.name, d]))

/** Whether a quest (and everything it needs first) is safe for a build: no forced fight when the account cannot fight, no reward that pushes a capped skill past its cap. */
export function questFitsBuild(quest, rules) {
  const { build, members } = rulesOf(rules)
  const b = buildOf(build)
  if (!quest || (b.key === 'main' && members)) return true
  const chain = questChain(quest.id || quest).map((id) => getQuest(id)).filter(Boolean)
  for (const q of chain) {
    if (!members && !isFreeQuest(q)) return false
    if (b.noFights && BY_NAME.get(q.name)?.mustDefeat != null) return false
    for (const [skill, xp] of Object.entries(q.rewards || {})) {
      if (levelAtXp(xpAtLevel(startLevel(skill)) + xp) > skillCap({ build, members }, skill)) return false
    }
    for (const [skill, need] of Object.entries(q.reqs || {})) if (need > skillCap({ build, members }, skill)) return false
  }
  return true
}

/** Whether a training method can be used by an account with this build (and, for an ironman, this kind). */
export function methodFits(method, { build = 'main', iron = false, ironKind = 'standard' } = {}) {
  if (!method) return false
  const b = buildOf(build)
  if (isLocked(build, method.skill) || method.minLevel > skillCap(build, method.skill)) return false
  if (b.key !== 'main') {
    for (const r of requirementsFor(method)) {
      if (r.kind === 'skill' && r.level > skillCap(build, r.skill)) return false
      if (r.kind === 'quest' && b.noFights) {
        const q = getQuest(String(r.id).replace(/^quest:/, '').replace(/:partial$/, ''))
        if (q && !questFitsBuild(q, build)) return false
      }
    }
    if (b.noFights && isRisky(method)) return false
  }
  if (iron && ironKind === 'hardcore' && isRisky(method)) return false
  return true
}

/** Why an account cannot use a method (words for the picker), or '' when it can. */
export function methodBlockReason(method, rules) {
  if (methodFits(method, rules)) return ''
  // Only the hardcore rule: it would be fine for a plain ironman.
  if (rules?.iron && rules.ironKind === 'hardcore' && methodFits(method, { ...rules, iron: false })) return 'Too risky for a hardcore ironman'
  return `Not for a ${buildOf(rules?.build).short.toLowerCase()}`
}

/**
 * The method ids an account may use for a skill, or null when nothing is ruled out. `rules` is { members, build, iron, ironKind }: free-to-play
 * keeps to free methods (given in `freeIds`), a build and a hardcore ironman take out what would break them.
 */
export function ruleIdsFor(skill, rules, freeIds = null) {
  const { members = true, build = 'main', iron = false, ironKind = 'standard' } = rules || {}
  const all = methodsForSkill(skill)
  const fit = all.filter((m) => methodFits(m, { build, iron, ironKind })).map((m) => m.id)
  const limited = fit.length !== all.length
  if (members !== false && !limited) return null
  // Free-to-play: only free methods (an empty list means this skill has no free route at all).
  if (members === false && freeIds) return fit.filter((id) => freeIds.includes(id))
  return limited ? fit : null
}

const sameSet = (a, b) => a.length === b.length && a.every((id) => b.includes(id))

/**
 * The goals for an account with these rules. Goals for locked skills are dropped, targets are held at the build's cap (and a goal that is
 * already there is dropped), and each goal's method list is cut to what the rules allow. `prev` is the rules the goals were last given: a method
 * list that was only the old rules is replaced, while a list the person chose (AFK only, say) is kept and cut to fit. Same goals back when
 * nothing changes.
 */
export function applyRules(goals, next, prev = null, freeIds = (skill) => null) {
  const out = []
  for (const g of goals || []) {
    if (isLocked(next, g.skill)) continue
    let goal = g
    const cap = capXp(next, g.skill)
    if (goal.targetXp > cap) goal = { ...goal, targetXp: cap }
    if (goal.targetXp <= goal.currentXp) continue
    const wanted = ruleIdsFor(g.skill, next, freeIds(g.skill))
    const had = ruleIdsFor(g.skill, prev || { members: true }, prev ? freeIds(g.skill) : null)
    const has = Array.isArray(goal.allowedMethodIds) ? goal.allowedMethodIds : []
    let allowed
    if (has.length && had && sameSet(has, had)) allowed = wanted || null
    else if (has.length) allowed = wanted ? (has.filter((id) => wanted.includes(id)).length ? has.filter((id) => wanted.includes(id)) : wanted) : has
    else allowed = wanted
    if (!allowed || !allowed.length) {
      if (Array.isArray(goal.allowedMethodIds)) {
        const { allowedMethodIds, ...rest } = goal
        goal = rest
      }
    } else if (!sameSet(allowed, has)) goal = { ...goal, allowedMethodIds: allowed }
    out.push(goal)
  }
  return out
}

/** The build a player's stats already look like, or null. `levels` is { Skill: level }. */
export function detectBuild(levels) {
  if (!levels || Object.keys(levels).length < 10) return null
  const l = (s) => levels[s] ?? startLevel(s)
  if (combatLevel(levels) <= 3 && l('Hitpoints') <= 12) return 'skiller'
  const attacker = l('Attack') > 1 || l('Strength') > 1 || l('Ranged') > 1 || l('Magic') > 1
  if (l('Defence') <= 1 && attacker) return 'pure'
  if (l('Defence') >= 40 && l('Defence') <= 45 && l('Strength') >= 60) return 'zerker'
  return null
}

/** The label for an account's settings, such as "Members · Hardcore ironman · Level 3 skiller". */
export function accountLabel({ members = true, build = 'main', iron = false, ironKind = 'standard' } = {}, kinds) {
  const parts = [members === false ? 'Free-to-play' : 'Members']
  if (iron) parts.push(kinds?.[cleanIronKind(ironKind)] || 'Ironman')
  if (cleanBuild(build) !== 'main') parts.push(buildOf(build).short)
  return parts.join(' · ')
}
