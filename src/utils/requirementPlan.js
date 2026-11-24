// A skill plan for a quest or diary tier: the levels it needs (and what the quests it needs first need), as planner goals the player can open.
import { getQuest, questChain } from '@/data/quests'
import { questSlug } from '@/utils/questSlug'
import { completedQuestSlugs } from '@/utils/questProgress'
import { tierDone } from '@/utils/diaryProgress'
import { lowerTierIds } from '@/data/diaryIds'
import { getDiaryTier } from '@/data/diaries'
import { GLOBAL_STRATEGY, MAX_XP, encodePlan, xpAtLevel } from '@/utils/planner'
import { SKILL_NAMES } from '@/utils/osrsSkills'

const bump = (into, skill, level) => {
  if (SKILL_NAMES.includes(skill) && level > (into[skill] || 0)) into[skill] = level
}

/** Add the levels of a quest, and of every quest it needs first that is not done, to `into` (a { Skill: level } map). Returns the not-done quests used. */
function addQuest(into, slug, done, used) {
  for (const id of questChain(slug)) {
    const q = getQuest(id)
    if (!q || done.has(questSlug(q.name)) || used.has(q.name)) continue
    used.add(q.name)
    for (const [skill, level] of Object.entries(q.reqs)) bump(into, skill, level)
  }
}

/**
 * The levels to reach before a quest can be done: { skills, quests (not done, first one last), qp (quest points it asks for) }.
 * `confirmations` is the player's answers: quests already done need nothing.
 */
export function questRequirements(slug, confirmations = {}) {
  const done = completedQuestSlugs(confirmations)
  const skills = {}
  const used = new Set()
  addQuest(skills, slug, done, used)
  const quest = getQuest(slug)
  const qp = Math.max(...questChain(slug).map((id) => getQuest(id)?.qpReq || 0), 0)
  return { skills, quests: [...used].filter((n) => n !== quest?.name), qp }
}

/**
 * The same for a diary tier: its own levels, the levels of the tiers below it that are not done, and what the quests all of those need need.
 */
export function diaryRequirements(tierId, confirmations = {}) {
  const done = completedQuestSlugs(confirmations)
  const skills = {}
  const used = new Set()
  const ids = [...lowerTierIds(tierId).filter((id) => !tierDone(id, confirmations)), tierId]
  for (const id of ids) {
    const tier = getDiaryTier(id)
    if (!tier) continue
    for (const [skill, level] of Object.entries(tier.skills)) bump(skills, skill, level)
    for (const q of [...tier.quests, ...tier.partial]) if (q.id) addQuest(skills, q.id.replace(/^quest:/, ''), done, used)
  }
  return { skills, quests: [...used], qp: Math.max(getDiaryTier(tierId)?.qp || 0, 0) }
}

/**
 * Planner goals that take a { Skill: level } map from where the player is (`xp`: { Skill: xp }, or null to start every skill from level 1) to
 * those levels. Skills the player already has are left out; biggest jump first.
 */
export function goalsForLevels(skills, xp = null) {
  const goals = []
  for (const [skill, level] of Object.entries(skills)) {
    const targetXp = Math.min(xpAtLevel(Math.min(level, 99)), MAX_XP)
    const currentXp = xp ? Math.max(xp[skill] ?? 0, skill === 'Hitpoints' ? xpAtLevel(10) : 0) : skill === 'Hitpoints' ? xpAtLevel(10) : 0
    if (currentXp >= targetXp) continue
    goals.push({ skill, currentXp, targetXp, methodId: GLOBAL_STRATEGY, customXpPerHour: 0, quests: [], overrides: [] })
  }
  return goals.sort((a, b) => b.targetXp - b.currentXp - (a.targetXp - a.currentXp))
}

/** The planner address that opens these goals as a new plan (for this player when given). */
export function planQuery({ goals, username = '', hoursPerDay = 2, name = '' }) {
  const params = encodePlan({ username, hoursPerDay, goals, strategy: null, gpValue: null, budget: null, statsAt: null })
  // A name for the new plan, which the planner uses until it is saved.
  if (name) params.set('name', String(name).slice(0, 60))
  return Object.fromEntries(params.entries())
}
