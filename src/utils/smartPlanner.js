import { F2P_SKILLS, F2P_METHOD_IDS, LEVEL_TIERS, COMBAT_TIERS } from '@/data/plannerMilestones'
import { methodsForSkill } from '@/data/trainingMethods'
import { questBySlug } from '@/data/questList'
import { getQuest } from '@/data/quests'
import { AUTO_CHEAP, AUTO_FAST, levelAtXp, planGoal, suggestedQuests, xpAtLevel, formatGp } from '@/utils/planner'
import { resolveGoal, summarizePlan } from '@/utils/plannerTools'
import { skillStates, recommendedPlans } from '@/utils/recommendedPlans'
import { smartOrder } from '@/utils/smartOrder'
import { GOALS, EXPERIENCE, GP_LEVELS, DEFAULT_PROFILE, cleanProfile } from '@/utils/smartProfile'

// The Smart Planner: from a few answers and a player's levels, the steps to take, in order, each with why. Pure and deterministic.
// Answers (the "profile"): { members, goal, hours, gp, experience, iron }.

export { GOALS, EXPERIENCE, GP_LEVELS, DEFAULT_PROFILE, cleanProfile }

/** The planner settings the answers lead to. */
export function settingsFor(profile) {
  const gp = GP_LEVELS.find((g) => g.key === profile.gp) || GP_LEVELS[0]
  // Ironmen cannot buy anything, and money is not the goal of a plan made for making it by hand: the cheapest routes.
  const cheap = profile.iron || profile.goal === 'money'
  return { hoursPerDay: profile.hours, globalStrategy: cheap ? AUTO_CHEAP : gp.strategy, gpValue: gp.gpValue }
}

// --- free-to-play ----------------------------------------------------------------------------------------------------------------

const f2pIds = (skill) => methodsForSkill(skill).filter((m) => F2P_METHOD_IDS.has(m.id)).map((m) => m.id)
const capCache = new Map()
/** The highest level a free-to-play player can be taken to in a skill with the methods we have (0 when there are none). */
export function f2pCap(skill) {
  if (capCache.has(skill)) return capCache.get(skill)
  const allowed = f2pIds(skill)
  let cap = 0
  if (allowed.length && F2P_SKILLS.includes(skill)) {
    for (let level = 2; level <= 99; level++) {
      const plan = planGoal({ skill, currentXp: xpAtLevel(level - 1), targetXp: xpAtLevel(level), methodId: AUTO_FAST, allowedMethodIds: allowed })
      if (!plan.complete) break
      cap = level
    }
  }
  capCache.set(skill, cap)
  return cap
}

// --- goals ------------------------------------------------------------------------------------------------------------------------

const mk = (state, targetLevel, profile) => ({
  skill: state.skill,
  currentXp: state.xp,
  targetXp: xpAtLevel(targetLevel),
  methodId: 'global',
  customXpPerHour: 0,
  quests: [],
  ...(profile.members ? {} : { allowedMethodIds: f2pIds(state.skill) }),
})

/** The level a skill can be taken to for this player: the target, held back for free-to-play where the methods run out. */
function reachable(skill, targetLevel, profile) {
  if (profile.members) return targetLevel
  return Math.min(targetLevel, f2pCap(skill))
}

function tierGoals(states, tierLevel, profile) {
  const goals = []
  for (const s of states) {
    if (!profile.members && !F2P_SKILLS.includes(s.skill)) continue
    const to = reachable(s.skill, tierLevel, profile)
    if (s.level < to) goals.push({ ...mk(s, to, profile), why: [] })
  }
  return goals
}

/** The next "bring everything up to N" tier that still has something to do, for the levels in `states`. */
function skillsPhase(states, profile) {
  const tiers = LEVEL_TIERS[profile.experience]
  for (const t of tiers) {
    const goals = tierGoals(states, t, profile)
    if (goals.length) return { id: `tier-${t}`, title: `Bring everything up to level ${t}`, why: t === tiers[0] ? 'A solid base makes every later skill easier.' : '', goals }
  }
  return null
}

/** The next tier of the combat ladder with something left to do, from the starting tier for how experienced the player is. */
function combatPhase(states, profile) {
  const byName = Object.fromEntries(states.map((s) => [s.skill, s]))
  const startIndex = { new: 0, returning: 1, veteran: 2 }[profile.experience]
  for (const tier of COMBAT_TIERS.slice(startIndex)) {
    const goals = []
    for (const g of tier.goals) {
      if (!profile.members && g.members) continue
      const s = byName[g.skill]
      const to = reachable(g.skill, g.level, profile)
      if (s && s.level < to) goals.push({ ...mk(s, to, profile), why: [g.why] })
    }
    if (goals.length) return { id: `combat-${tier.level}`, title: tier.title, why: `Level ${tier.level} and up opens the next tier of gear.`, goals }
  }
  return null
}

function bestGpAt(skill, level, allowed) {
  let best = 0
  for (const m of methodsForSkill(skill)) {
    if (allowed && !allowed.has(m.id)) continue
    if (m.minLevel <= level && (m.maxLevel == null || level <= m.maxLevel) && m.gpPerHour != null && m.gpPerHour > best) best = m.gpPerHour
  }
  return best
}

function moneyPhase(states, profile) {
  const rows = []
  for (const s of states) {
    if (!profile.members && !F2P_SKILLS.includes(s.skill)) continue
    const allowed = profile.members ? null : new Set(f2pIds(s.skill))
    const now = bestGpAt(s.skill, s.level, allowed)
    let best = null
    for (const m of methodsForSkill(s.skill)) {
      if (allowed && !allowed.has(m.id)) continue
      // Tick-manipulation methods are a technique of their own, not something to recommend to a typical player.
      if (m.minLevel <= s.level || m.gpPerHour == null || m.gpPerHour - now < 150_000 || /tick manipulation|-tick\b/i.test(`${m.name} ${m.requirements}`)) continue
      if (!best || m.gpPerHour > best.m.gpPerHour) best = { m }
    }
    if (!best) continue
    const to = reachable(s.skill, best.m.minLevel, profile)
    if (to <= s.level) continue
    const goal = mk(s, to, profile)
    const hours = planGoal({ ...goal, methodId: AUTO_FAST }).hours
    const gain = best.m.gpPerHour - now
    rows.push({ goal: { ...goal, why: [`Unlocks ${best.m.name}, about ${formatGp(best.m.gpPerHour).replace(/^\+/, '').replace(/ gp$/, '')} gp an hour.`] }, score: gain / Math.max(hours || 1, 0.5) })
  }
  rows.sort((a, b) => b.score - a.score || (a.goal.skill < b.goal.skill ? -1 : 1))
  const goals = rows.slice(0, 5).map((r) => r.goal)
  return goals.length ? { id: 'money', title: 'Levels that unlock better money', why: 'Each of these opens a method that makes much more gp an hour.', goals } : null
}

// --- putting it together ----------------------------------------------------------------------------------------------------------

function questsOf(goal, settings, profile) {
  let picked = []
  try {
    picked = suggestedQuests({ ...goal, quests: [], methodId: settings.globalStrategy, gpValuePerHour: settings.gpValue })
  } catch {
    picked = []
  }
  if (!profile.members && picked.some((id) => questBySlug(id.replace(/^quest:/, ''))?.type !== 'F')) return []
  return picked
}

/**
 * The recommendation: { profile, settings, phases, notes, goals, totals, empty }.
 * phases: [{ id, title, why, later, rows: [{ skill, from, to, goal, hours, netGp, reasons, quests }] }] in the order to do them (a `later` phase is
 * what comes after the plan and is only shown); goals: the plan's goals, the first phase in order (a plan has one goal per skill); totals: { goals, hours, days, netGp }.
 */
export function recommend(rawProfile, skills) {
  const profile = cleanProfile(rawProfile)
  const states = skillStates(skills)
  const settings = settingsFor(profile)
  const next = (kind, from) => (kind === 'combat' ? combatPhase(from, profile) : kind === 'money' ? moneyPhase(from, profile) : skillsPhase(from, profile))
  const build = (kind) => {
    const out = []
    let virtual = states
    // The next phase starts where this one ends, so its rows read "50 to 60" and not "20 to 60".
    for (let i = 0; i < (kind === 'money' ? 1 : 2); i++) {
      const p = next(kind, virtual)
      if (!p) break
      out.push({ ...p, later: i > 0 })
      virtual = virtual.map((s) => {
        const g = p.goals.find((x) => x.skill === s.skill)
        return g ? { ...s, xp: g.targetXp, level: levelAtXp(g.targetXp) } : s
      })
    }
    return out
  }
  let phases = build(profile.goal)
  const notes = []
  // Nothing in the chosen kind of plan is left to do (or, for money, nothing unlocks more): fall back to the levels, then to the big goals.
  if (!phases.length && profile.goal !== 'skills') {
    phases = build('skills')
    if (phases.length) notes.push('Nothing left in that kind of plan for your levels, so these are the next levels to work on.')
  }
  if (!phases.length) {
    const big = recommendedPlans(skills).find((p) => p.kind !== 'total') || recommendedPlans(skills)[0]
    if (big && profile.members) {
      phases = [{ id: 'big', title: big.title, why: big.description, goals: big.goals.map((g) => ({ ...g, why: [] })), later: false }]
      notes.push("You're ahead of every tier here, so this is the next big goal.")
    }
  }
  if (!profile.members) {
    const left = states.filter((s) => F2P_SKILLS.includes(s.skill) && s.level < 99 && f2pCap(s.skill) <= s.level).map((s) => s.skill)
    if (left.length) notes.push(`We don't have free-to-play routes for ${left.join(', ')} yet, so they are not in this plan.`)
  }

  // Quests that save time on each goal (members: any short XP quest; free: only free ones).
  for (const p of phases) for (const g of p.goals) g.quests = questsOf(g, settings, profile)

  // Within a phase, the order that helps the most (Fishing before Cooking and so on).
  const ordered = []
  const planOf = (g) => planGoal(resolveGoal(g, settings.globalStrategy, settings.gpValue))
  const outPhases = phases.map((p) => {
    const plans = p.goals.map(planOf)
    const so = smartOrder(p.goals, plans)
    const rank = new Map(so.order.map((s, i) => [s, i]))
    const sorted = [...p.goals].sort((a, b) => rank.get(a.skill) - rank.get(b.skill))
    const rows = sorted.map((g) => {
      const plan = plans[p.goals.indexOf(g)]
      return {
        skill: g.skill,
        from: levelAtXp(g.currentXp, true),
        to: levelAtXp(g.targetXp, true),
        goal: g,
        hours: plan.hours,
        netGp: plan.netGp,
        reasons: [...(g.why || []), ...(so.reasons[g.skill] || [])].slice(0, 2),
        quests: g.quests.map((id) => getQuest(id)?.name).filter(Boolean),
      }
    })
    if (!p.later) for (const r of rows) ordered.push({ ...r.goal, why: undefined })
    return { id: p.id, title: p.title, why: p.why, later: !!p.later, rows }
  })

  const goals = ordered.map(({ why, ...g }) => g)
  const sum = goals.length ? summarizePlan({ goals, globalStrategy: settings.globalStrategy, gpValue: settings.gpValue, hoursPerDay: settings.hoursPerDay }) : { totalHours: 0, netGp: 0, days: 0 }
  return { profile, settings, phases: outPhases, notes, goals, totals: { goals: goals.length, hours: sum.totalHours, days: sum.days, netGp: sum.netGp }, empty: !goals.length }
}

/** What to start a plan from: the ordered goals and the settings. */
export function planFromProfile(rawProfile, skills) {
  const r = recommend(rawProfile, skills)
  return { goals: r.goals, ...r.settings, profile: r.profile }
}

