import { F2P_SKILLS, F2P_METHOD_IDS, LEVEL_STEPS, START_LEVEL, COMBAT_TIERS } from '@/data/plannerMilestones'
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

/**
 * The next set of levels to work on. With stats to go on it is the first "bring everything up to N" step that still has several skills
 * below it (a few skills left are simply finished off to 99); with none, how experienced the player says they are decides where to start.
 */
function skillsPhase(states, profile, hasStats) {
  const eligible = states.filter((s) => profile.members || F2P_SKILLS.includes(s.skill))
  const below = (t) => eligible.filter((s) => s.level < reachable(s.skill, t, profile)).length
  const left = below(99)
  if (!left) return null
  if (left <= 3) {
    return { id: 'finish', title: left === 1 ? 'Finish your last skill' : 'Finish your last skills', why: 'Everything else is further along, so these are what is left to take to 99.', goals: tierGoals(states, 99, profile) }
  }
  const floor = hasStats ? LEVEL_STEPS[0] : START_LEVEL[profile.experience]
  for (const t of LEVEL_STEPS) {
    if (t < floor || below(t) < 4) continue
    if (t === 99) return { id: 'tier-99', title: 'Take everything to 99', why: 'The long road, one skill at a time.', goals: tierGoals(states, 99, profile) }
    return { id: `tier-${t}`, title: `Bring everything up to level ${t}`, why: t === LEVEL_STEPS[0] || t === floor ? 'A solid base makes every later skill easier.' : '', goals: tierGoals(states, t, profile) }
  }
  return { id: 'tier-99', title: 'Take everything to 99', why: 'The long road, one skill at a time.', goals: tierGoals(states, 99, profile) }
}

/** The next tier of the combat ladder with something left to do (with stats the first one still ahead; without, from the starting tier). */
function combatPhase(states, profile, hasStats) {
  const byName = Object.fromEntries(states.map((s) => [s.skill, s]))
  const startIndex = hasStats ? 0 : { new: 0, returning: 1, veteran: 2 }[profile.experience]
  for (const tier of COMBAT_TIERS.slice(startIndex)) {
    const goals = []
    for (const g of tier.goals) {
      if (!profile.members && g.members) continue
      const s = byName[g.skill]
      const to = reachable(g.skill, g.level, profile)
      if (s && s.level < to) goals.push({ ...mk(s, to, profile), why: g.why ? [g.why] : [] })
    }
    if (goals.length) return { id: `combat-${tier.level}`, title: tier.title, why: tier.why || `Level ${tier.level} and up opens the next tier of gear.`, goals }
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

const isTrick = (m) => /tick manipulation|-tick\b/i.test(`${m.name} ${m.requirements}`)
const gpShortText = (n) => formatGp(n).replace(/^\+/, '').replace(/ gp$/, '')

/** The best-paying methods the player can already do: train that skill with that method for the next stretch. */
function moneyNowPhase(states, profile) {
  const best = []
  for (const s of states) {
    if (!profile.members && !F2P_SKILLS.includes(s.skill)) continue
    if (s.level >= 99) continue
    const allowed = profile.members ? null : new Set(f2pIds(s.skill))
    let top = null
    for (const m of methodsForSkill(s.skill)) {
      if (allowed && !allowed.has(m.id)) continue
      if (m.minLevel > s.level || (m.maxLevel != null && s.level > m.maxLevel) || !(m.gpPerHour > 0) || isTrick(m)) continue
      if (!top || m.gpPerHour > top.gpPerHour) top = m
    }
    if (top) best.push({ s, m: top })
  }
  best.sort((a, b) => b.m.gpPerHour - a.m.gpPerHour || (a.s.skill < b.s.skill ? -1 : 1))
  const goals = best.slice(0, 3).map(({ s, m }) => {
    const to = reachable(s.skill, Math.min(99, s.level + 10), profile)
    return { ...mk(s, to, profile), methodId: m.id, why: [`${m.name}: about ${gpShortText(m.gpPerHour)} gp an hour while you train.`] }
  }).filter((g) => g.targetXp > g.currentXp)
  return goals.length ? { id: 'money-now', title: 'Make money while you train', why: 'The best-paying methods you can already do. Check each one’s requirements before you start.', goals } : null
}

/** The levels that unlock a much better gp-an-hour method. */
function moneyUnlockPhase(states, profile) {
  const rows = []
  for (const s of states) {
    if (!profile.members && !F2P_SKILLS.includes(s.skill)) continue
    const allowed = profile.members ? null : new Set(f2pIds(s.skill))
    const now = bestGpAt(s.skill, s.level, allowed)
    let best = null
    for (const m of methodsForSkill(s.skill)) {
      if (allowed && !allowed.has(m.id)) continue
      if (m.minLevel <= s.level || m.gpPerHour == null || m.gpPerHour - now < 150_000 || isTrick(m)) continue
      if (!best || m.gpPerHour > best.m.gpPerHour) best = { m }
    }
    if (!best) continue
    const to = reachable(s.skill, best.m.minLevel, profile)
    if (to <= s.level) continue
    const goal = mk(s, to, profile)
    const hours = planGoal({ ...goal, methodId: AUTO_FAST }).hours
    const gain = best.m.gpPerHour - now
    rows.push({ goal: { ...goal, why: [`Unlocks ${best.m.name}, about ${gpShortText(best.m.gpPerHour)} gp an hour.`] }, score: gain / Math.max(hours || 1, 0.5) })
  }
  rows.sort((a, b) => b.score - a.score || (a.goal.skill < b.goal.skill ? -1 : 1))
  const goals = rows.slice(0, 5).map((r) => r.goal)
  return goals.length ? { id: 'money-unlock', title: 'Levels that unlock better money', why: 'Each of these opens a method that makes much more gp an hour.', goals } : null
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
  const hasStats = !!skills
  const next = (kind, from, i) => (kind === 'combat' ? combatPhase(from, profile, hasStats) : kind === 'money' ? (i === 0 ? moneyNowPhase(from, profile) : moneyUnlockPhase(from, profile)) : skillsPhase(from, profile, hasStats))
  const build = (kind) => {
    const out = []
    let virtual = states
    // The next phase starts where this one ends, so its rows read "50 to 60" and not "20 to 60".
    for (let i = 0; i < 2; i++) {
      const p = next(kind, virtual, i)
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
  // Nothing in the chosen kind of plan is left to do: say so, and show the next levels to work on instead of an empty list.
  if (!phases.length && profile.goal !== 'skills') {
    phases = build('skills')
    notes.push(
      {
        combat: "You've finished the combat ladder. Here is what's next instead.",
        money: "None of the money methods we know pay more than what you can already do. Here is what's next instead.",
        quests: 'No quick XP quest would help at your levels. Here are the next levels to work on.',
      }[profile.goal],
    )
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
  // "Quests and unlocks": the quests worth doing come first, as a step of their own (their XP is already counted in the goals).
  let questRows = []
  if (profile.goal === 'quests' && phases[0]) {
    const seen = new Set()
    for (const g of phases[0].goals) for (const id of g.quests) {
      const q = getQuest(id)
      if (!q || seen.has(id)) continue
      seen.add(id)
      questRows.push({ kind: 'quest', id, title: q.name, rewards: Object.entries(q.rewards).map(([skill, xp]) => `${xp.toLocaleString('en-US')} ${skill} XP`).join(', '), hours: (q.minutes || 0) / 60 })
    }
    if (!questRows.length) notes.push('No quick XP quest would help at your levels, so these are the levels to work on.')
  }

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

  if (questRows.length) outPhases.unshift({ id: 'quests', title: 'Quests worth doing first', why: 'Each hands out a lump of XP that skips hours of training.', later: false, rows: questRows })
  const goals = ordered.map(({ why, ...g }) => g)
  const sum = goals.length ? summarizePlan({ goals, globalStrategy: settings.globalStrategy, gpValue: settings.gpValue, hoursPerDay: settings.hoursPerDay }) : { totalHours: 0, netGp: 0, days: 0 }
  return { profile, settings, phases: outPhases, notes, goals, totals: { goals: goals.length, hours: sum.totalHours, days: sum.days, netGp: sum.netGp }, empty: !goals.length }
}

/** What to start a plan from: the ordered goals and the settings. */
export function planFromProfile(rawProfile, skills) {
  const r = recommend(rawProfile, skills)
  return { goals: r.goals, ...r.settings, profile: r.profile }
}

