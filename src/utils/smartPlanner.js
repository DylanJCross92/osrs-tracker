import { F2P_SKILLS, F2P_METHOD_IDS, LEVEL_STEPS, START_LEVEL, COMBAT_TIERS } from '@/data/plannerMilestones'
import { methodsForSkill } from '@/data/trainingMethods'
import { questBySlug } from '@/data/questList'
import { getQuest } from '@/data/quests'
import { AUTO_CHEAP, AUTO_FAST, AUTO_PROFIT, levelAtXp, planGoal, suggestedQuests, xpAtLevel, formatGp } from '@/utils/planner'
import { resolveGoal, summarizePlan } from '@/utils/plannerTools'
import { skillStates, recommendedPlans } from '@/utils/recommendedPlans'
import { smartOrder } from '@/utils/smartOrder'
import { SYNERGIES } from '@/data/skillSynergies'
import { formatXp } from '@/utils/osrsSkills'
import { canUseMethod, combatLevel, evaluateQuests, fitBudget, fundingFor, levelsOf, unlockFor } from '@/utils/smartReasons'
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

/** A combat step shorter than this (hours of fast training) is folded together with the tier after it, so a plan never opens with "Ranged 60 to 61". */
const MIN_COMBAT_STEP_HOURS = 3

/** The next tier of the combat ladder with something left to do (with stats the first one still ahead; without, from the starting tier). */
function combatPhase(states, profile, hasStats) {
  const byName = Object.fromEntries(states.map((s) => [s.skill, s]))
  const startIndex = hasStats ? 0 : { new: 0, returning: 1, veteran: 2 }[profile.experience]
  const tiers = COMBAT_TIERS.slice(startIndex)
  const goalsOf = (tier) => {
    const goals = []
    for (const g of tier.goals) {
      if (!profile.members && g.members) continue
      const s = byName[g.skill]
      const to = reachable(g.skill, g.level, profile)
      if (s && s.level < to) goals.push({ ...mk(s, to, profile), why: g.why ? [g.why] : [] })
    }
    return goals
  }
  const hoursOf = (goals) => goals.reduce((sum, g) => sum + (planGoal({ ...g, methodId: AUTO_FAST }).hours || 0), 0)
  for (let i = 0; i < tiers.length; i++) {
    let goals = goalsOf(tiers[i])
    if (!goals.length) continue
    const first = tiers[i]
    let last = first
    // A stretch of a few hours is not a step worth a heading: carry on into the next tier (the higher level of a skill wins).
    for (let j = i + 1; j < tiers.length && hoursOf(goals) < MIN_COMBAT_STEP_HOURS; j++) {
      const more = goalsOf(tiers[j])
      if (!more.length) continue
      const merged = new Map(goals.map((g) => [g.skill, g]))
      for (const g of more) {
        const have = merged.get(g.skill)
        merged.set(g.skill, have ? { ...g, why: [...new Set([...g.why, ...have.why])] } : g)
      }
      goals = [...merged.values()]
      last = tiers[j]
    }
    const title = last === first ? first.title : `${first.title} and ${last.title.charAt(0).toLowerCase()}${last.title.slice(1)}`
    return { id: `combat-${first.level}`, title, why: first.why || `Level ${first.level} and up opens the next tier of gear.`, goals }
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

/** The most hours one money step is worth setting out (a few weeks at a normal pace), and how much play a money plan should be at least. */
const MONEY_STEP_HOURS = 40
const MONEY_MIN_DAYS = 7

/** The best-paying methods the player can already do: train that skill with that method for the next stretch. */
function moneyNowPhase(states, profile, done = new Set(), hoursPerDay = 2) {
  const levels = levelsOf(states)
  const best = []
  for (const s of states) {
    if (!profile.members && !F2P_SKILLS.includes(s.skill)) continue
    if (s.level >= 99) continue
    const allowed = profile.members ? null : new Set(f2pIds(s.skill))
    let top = null
    for (const m of methodsForSkill(s.skill)) {
      if (allowed && !allowed.has(m.id)) continue
      if (m.minLevel > s.level || (m.maxLevel != null && s.level > m.maxLevel) || !(m.gpPerHour > 0) || isTrick(m) || !canUseMethod(m, levels, done)) continue
      if (!top || m.gpPerHour > top.gpPerHour) top = m
    }
    if (top) best.push({ s, m: top })
  }
  best.sort((a, b) => b.m.gpPerHour - a.m.gpPerHour || (a.s.skill < b.s.skill ? -1 : 1))
  // Each skill is trained for the best-paying method at every level (the planner's profit strategy), as far as about 40 hours go, so the
  // step is a real stretch of play that moves on to the next method when this one runs out.
  const stretch = ({ s, m }) => {
    const f2p = profile.members ? null : new Set(f2pIds(s.skill))
    // The methods this player can actually do (everything but the skill's own level is checked), so the profit route never needs a quest they lack.
    const allowedMethodIds = methodsForSkill(s.skill).filter((x) => !(f2p && !f2p.has(x.id)) && canUseMethod(x, { ...levels, [s.skill]: 99 }, done)).map((x) => x.id)
    const base = { ...mk(s, s.level + 1, profile), methodId: AUTO_PROFIT, allowedMethodIds }
    const candidates = [...new Set([...LEVEL_STEPS.filter((t) => t > s.level), 99, Math.min(99, s.level + 5)])].map((t) => reachable(s.skill, t, profile)).filter((t) => t > s.level).sort((a, b) => b - a)
    let to = null
    for (const t of candidates) {
      const plan = planGoal({ ...base, targetXp: xpAtLevel(t) })
      // A step for making money must not lose money, so it stops where the best route turns into a cost.
      if (plan.complete !== false && plan.hours != null && plan.hours <= MONEY_STEP_HOURS && (plan.netGp == null || plan.netGp >= 0)) {
        to = t
        break
      }
    }
    if (to == null) return null
    return { ...base, targetXp: xpAtLevel(to), why: [`${m.name} pays about ${gpShortText(m.gpPerHour)} gp an hour now, and the plan moves to the next best method as you level.`] }
  }
  // The top three, then more of them until the plan is about a week of play (at most six).
  const goals = []
  let hours = 0
  for (const b of best.slice(0, 6)) {
    if (goals.length >= 3 && hours >= hoursPerDay * MONEY_MIN_DAYS) break
    const g = stretch(b)
    if (!g || !(g.targetXp > g.currentXp)) continue
    goals.push(g)
    hours += planGoal(g).hours || 0
  }
  return goals.length ? { id: 'money-now', title: 'Make money while you train', why: 'The best-paying methods you can already do. Check each one’s requirements before you start.', goals } : null
}

/** The levels that unlock a much better gp-an-hour method. */
function moneyUnlockPhase(states, profile, done = new Set()) {
  const levels = levelsOf(states)
  const rows = []
  for (const s of states) {
    if (!profile.members && !F2P_SKILLS.includes(s.skill)) continue
    const allowed = profile.members ? null : new Set(f2pIds(s.skill))
    const now = bestGpAt(s.skill, s.level, allowed)
    let best = null
    for (const m of methodsForSkill(s.skill)) {
      if (allowed && !allowed.has(m.id)) continue
      if (m.minLevel <= s.level || m.gpPerHour == null || m.gpPerHour - now < 150_000 || isTrick(m) || !canUseMethod(m, { ...levels, [s.skill]: m.minLevel }, done)) continue
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

// --- AFK training and hardcore skilling ------------------------------------------------------------------------------------------

/** The skills where the fastest training is the hands-on kind (see the "intensity" of each method in data/trainingMethods.js). */
export const HARDCORE_SKILLS = ['Runecraft', 'Agility', 'Mining', 'Thieving', 'Hunter', 'Fishing', 'Woodcutting', 'Firemaking', 'Smithing']
const INTENSITY_KINDS = {
  afk: { levels: ['AFK', 'Low'], hours: 30, id: 'afk', title: 'AFK training', why: 'Methods that need little attention, so you can train while doing something else.' },
  hardcore: { levels: ['High', 'Medium'], hours: 40, id: 'hardcore', title: 'Hardcore skilling', why: 'The fastest hands-on methods in the skills that reward effort most: Runecraft, Agility, Mining and the like.' },
}
const TIERS = [...LEVEL_STEPS]

/** How far up a skill the given methods carry a player who is at `level` (the level they get to, with no gaps). */
function coverTo(methods, level) {
  let l = level
  while (l < 99 && methods.some((m) => m.minLevel <= l && (m.maxLevel == null || l <= m.maxLevel))) l++
  return l
}

/** One stretch of AFK or hardcore training: per skill, the next level its methods of that kind carry the player to (within about a day's training). */
function intensityPhase(states, profile, done, kind) {
  const cfg = INTENSITY_KINDS[kind]
  const levels = levelsOf(states)
  const rows = []
  for (const s of states) {
    if (s.level >= 99) continue
    if (!profile.members && !F2P_SKILLS.includes(s.skill)) continue
    if (kind === 'hardcore' && !HARDCORE_SKILLS.includes(s.skill)) continue
    const f2p = profile.members ? null : new Set(f2pIds(s.skill))
    const methods = methodsForSkill(s.skill).filter((m) => cfg.levels.includes(m.intensity) && !(f2p && !f2p.has(m.id)) && canUseMethod(m, { ...levels, [s.skill]: 99 }, done))
    if (!methods.length) continue
    const cap = reachable(s.skill, coverTo(methods, s.level), profile)
    if (cap <= s.level) continue
    const here = methods.filter((m) => m.minLevel <= s.level && (m.maxLevel == null || s.level <= m.maxLevel))
    const top = here.reduce((a, m) => (!a || m.xpPerHour > a.xpPerHour ? m : a), null)
    if (!top) continue
    const allowedMethodIds = methods.map((m) => m.id)
    const goalFor = (to) => ({ ...mk(s, to, profile), allowedMethodIds })
    const candidates = [...new Set([...TIERS.filter((t) => t > s.level && t <= cap), cap])].sort((a, b) => a - b)
    let pick = candidates[0]
    for (const t of [...candidates].reverse()) {
      if (planGoal(resolveGoal(goalFor(t), AUTO_FAST, 0)).hours <= cfg.hours) {
        pick = t
        break
      }
    }
    const feel = top.intensity === 'AFK' ? 'with almost no attention' : top.intensity === 'Low' ? 'with little effort' : 'hands-on'
    rows.push({ goal: { ...goalFor(pick), why: [`${top.name}: about ${formatXp(top.xpPerHour)} xp an hour, ${feel}.`] }, rate: top.xpPerHour, skill: s.skill })
  }
  rows.sort((a, b) => b.rate - a.rate || (a.skill < b.skill ? -1 : 1))
  const goals = rows.slice(0, kind === 'hardcore' ? 9 : 8).map((r) => r.goal)
  return goals.length ? { id: cfg.id, title: cfg.title, why: cfg.why, goals } : null
}

// --- reasons: why each step is in the plan ---------------------------------------------------------------------------------------

const gpShortText2 = (n) => formatGp(Math.round(n)).replace(/^\+/, '').replace(/ gp$/, '')
const hoursText = (h) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h >= 10 ? `${Math.round(h)} h` : `${h.toFixed(1)} h`)

/** "Before Cooking: free raw fish": what a skill gives the skills that come after it in this order (the links in data/skillSynergies.js). */
function synergyLines(goals) {
  const pos = new Map(goals.map((g, i) => [g.skill, i]))
  const byName = new Map(goals.map((g) => [g.skill, g]))
  const lines = new Map()
  for (const g of goals) {
    const groups = new Map()
    for (const e of SYNERGIES) {
      if (e.from !== g.skill || !byName.has(e.to) || pos.get(e.to) <= pos.get(g.skill)) continue
      const target = byName.get(e.to)
      const gotTo = levelAtXp(g.targetXp, true)
      if (levelAtXp(target.targetXp, true) < e.toMin || levelAtXp(g.currentXp, true) >= e.fromEnough || (e.fromTargetMin && gotTo < e.fromTargetMin)) continue
      groups.set(e.why, [...(groups.get(e.why) || []), e.to])
    }
    const list = [...groups.entries()].map(([why, to]) => `Before ${to.length <= 2 ? to.join(' and ') : `${to.slice(0, -1).join(', ')} and ${to[to.length - 1]}`}: ${why}.`)
    if (list.length) lines.set(g.skill, list)
  }
  return lines
}

const mkGoalFor = (state, targetLevel, profile) => mk(state, targetLevel, profile)

/**
 * The plan for "Max my skills" and "Quests and unlocks", built from reasons: quests worth doing (and the levels they need), the level in each skill
 * that opens something much faster, and, when the plan costs a lot, a skill to train first that pays for it. Returns phases (the first is the plan,
 * and a later one is what could come after) or [] when none of these reasons apply.
 */
/** What a quest row says: what it saves against what it costs (a first-timer's length, so an estimate), and the combat it needs. */
function questReasons(q) {
  const cost = q.minutes >= 60 ? hoursText(q.minutes / 60) : `${q.minutes} min`
  const lines = [
    q.savedHours * 60 >= q.minutes
      ? `Skips about ${hoursText(q.savedHours)} of training for about ${cost} if it is your first time (estimated).`
      : `Takes about ${cost} the first time (estimated). Its XP is only worth about ${hoursText(q.savedHours)} of training, so do it for the quest itself.`,
  ]
  if (q.combatNeed >= 20) lines.push(`Its fights need roughly combat level ${q.combatNeed}.`)
  if (q.qpNeed > 0 && !q.qpOk) lines.push(`Needs ${q.qpNeed} quest points to start; check your quest log.`)
  if (q.quest.note) lines.push(q.quest.note)
  // A lamp's experience goes to a skill of the player's choice, so it is mentioned, not counted in the plan.
  const lamp = q.quest.lamps?.[0]?.xp?.replace(/\s*\[[^\]]*\]/g, '').trim()
  if (lamp && !q.quest.note) lines.push(`Also gives an XP lamp (${lamp} XP, in a skill you choose), not counted here.`)
  return lines
}

function purposePhases(states, profile, settings, done, mode, sink = {}) {
  const byName = Object.fromEntries(states.map((s) => [s.skill, s]))
  // Only a few skills left: finishing them is the plan (see skillsPhase), not a search for what opens up.
  if (states.filter((s) => s.level < 99 && (profile.members || F2P_SKILLS.includes(s.skill))).length <= 3) return []
  const goals = new Map() // skill -> goal (with `why` lines and a `purpose`)
  const touch = (state, level, why, purpose, extra = {}) => {
    const have = goals.get(state.skill)
    const to = Math.max(level, have ? levelAtXp(have.targetXp) : 0)
    if (to <= state.level && !extra.keepIfQuest) return
    const g = have || { ...mkGoalFor(state, to, profile), why: [], purpose }
    g.targetXp = xpAtLevel(to)
    if (why) g.why.push(why)
    if (!have) g.purpose = purpose
    Object.assign(g, extra)
    goals.set(state.skill, g)
  }
  const nQuests = mode === 'quests' ? 6 : 4
  // Asked for quests, they are worth doing for the quest itself even when they take about as long as the training they replace.
  const evaluated = evaluateQuests(states, profile, done, { minNet: mode === 'quests' ? -1.2 : 0.5 })
  sink.skipped = evaluated.skipped
  const picks = evaluated.rows.slice(0, nQuests)

  // 1. The levels the quests need.
  const questRows = []
  for (const q of picks) {
    const savedText = hoursText(q.savedHours)
    for (const u of q.unmet) {
      const xp = Object.entries(q.xp).map(([sk, x]) => `${x.toLocaleString('en-US')} ${sk} XP`).join(' and ')
      touch(byName[u.skill], u.need, `Needed for ${q.quest.name} (${xp}, skips about ${savedText} of training).`, 'quest')
    }
  }
  // 2. The levels that open something much faster.
  const unlocks = []
  for (const s of states) {
    const u = unlockFor(s, profile, done, levelsOf(states))
    if (u) unlocks.push({ s, u, score: u.gain / Math.max(u.hours, 1) })
  }
  unlocks.sort((a, b) => b.score - a.score || (a.s.skill < b.s.skill ? -1 : 1))
  for (const { s, u } of unlocks.slice(0, mode === 'quests' ? 5 : 8)) touch(s, u.to, u.reason, 'unlock')
  // 3. The quests' own XP, on the goals they feed (a quest that feeds a skill with no goal gets one: its XP is the level).
  for (const q of picks) {
    let counted = false
    for (const [sk, amount] of Object.entries(q.xp)) {
      const g = goals.get(sk)
      if (!g) continue
      for (const id of q.chain) if (!g.quests.includes(id)) g.quests.push(id)
      counted = true
    }
    if (!counted) {
      const [sk, amount] = Object.entries(q.xp).sort((a, b) => b[1] - a[1])[0]
      const st = byName[sk]
      if (st && (profile.members || F2P_SKILLS.includes(sk))) {
        // Only when the quest's xp really is a level (or more) for this player: a quest that gives less than the next level is done for itself, and
        // does not turn into a goal that claims a level it does not reach.
        const to = levelAtXp(st.xp + amount)
        if (to > st.level) {
          const g = { ...mkGoalFor(st, to, profile), why: [`${q.quest.name} gives ${amount.toLocaleString('en-US')} ${sk} XP, about level ${to}.`], purpose: 'quest', quests: [...q.chain] }
          goals.set(sk, g)
        }
      }
    }
    questRows.push({
      kind: 'quest',
      id: q.quest.id,
      title: q.quest.name,
      rewards: Object.entries(q.xp).map(([sk, x]) => `${x.toLocaleString('en-US')} ${sk} XP`).join(', '),
      hours: q.minutes / 60,
      estimated: q.estimated,
      reasons: questReasons(q),
    })
  }
  // 4. A skill to train first, to pay for the costly ones.
  const planOf = (g) => planGoal(resolveGoal(g, settings.globalStrategy, settings.gpValue))
  const spenders = [...goals.values()].map((g) => ({ skill: g.skill, netGp: planOf(g).netGp }))
  const funds = fundingFor(states, profile, spenders, new Set(goals.keys()))
  const fundGoals = funds.map((f) => ({ ...mkGoalFor(byName[f.skill], f.to, profile), methodId: AUTO_PROFIT, why: [f.reason], purpose: 'fund', quests: [] }))

  const all = [...goals.values()]
  if (!all.length && !fundGoals.length) return []
  const questGoals = all.filter((g) => g.purpose === 'quest')
  const unlockGoals = all.filter((g) => g.purpose !== 'quest').sort((a, b) => (unlocks.findIndex((x) => x.s.skill === b.skill) < 0 ? -1 : 0) - 0)
  // Unlock goals in the order of how much faster they make you per hour spent; the links between skills show as reasons.
  const rank = new Map(unlocks.map((x, i) => [x.s.skill, i]))
  unlockGoals.sort((a, b) => (rank.get(a.skill) ?? 99) - (rank.get(b.skill) ?? 99))
  const syn = synergyLines(unlockGoals)
  for (const g of unlockGoals) g.why = [...g.why, ...(syn.get(g.skill) || [])]

  const phases = []
  if (fundGoals.length) phases.push({ id: 'fund', title: 'Earn first', why: 'These pay for the costly skills below, so you are not stopping to farm gp later.', goals: fundGoals, keepOrder: true, keepQuests: true })
  if (questGoals.length || questRows.length) phases.push({ id: 'quests', title: 'Quest shortcuts', why: 'Quests hand out XP, and some need a level first. Times are for a first run, not a speedrun.', goals: questGoals, questRows, keepOrder: true, keepQuests: true })
  if (unlockGoals.length) phases.push({ id: 'unlock', title: 'Unlock better training', why: 'Each level is picked because it opens a much faster way to train the skill.', goals: unlockGoals, keepOrder: true, keepQuests: true })

  // What could come after: the next level that opens something, from where this plan leaves each skill.
  const virtual = states.map((s) => {
    const g = all.concat(fundGoals).find((x) => x.skill === s.skill)
    return g ? { ...s, xp: g.targetXp, level: levelAtXp(g.targetXp) } : s
  })
  const later = []
  for (const s of virtual) {
    const u = unlockFor(s, profile, done, levelsOf(virtual))
    if (u) later.push({ s, u, score: u.gain / Math.max(u.hours, 1) })
  }
  later.sort((a, b) => b.score - a.score || (a.s.skill < b.s.skill ? -1 : 1))
  const laterGoals = later.slice(0, 5).map(({ s, u }) => ({ ...mkGoalFor(s, u.to, profile), why: [u.reason], quests: [] }))
  if (laterGoals.length) phases.push({ id: 'then', title: 'Unlock better training', why: '', goals: laterGoals, later: true, keepOrder: true, keepQuests: true })
  return phases
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
 * phases: [{ id, title, why, later, rows }] in the order to do them (a `later` phase is what could come after the plan and is only shown); rows are
 * a skill step { skill, from, to, goal, hours, netGp, reasons, quests } or a quest { kind: 'quest', title, rewards, hours, reasons }; goals: the plan's
 * goals in order (a plan has one goal per skill); totals: { goals, hours, days, netGp }. `done` is the set of quest ids the player has finished.
 */
export function recommend(rawProfile, skills, { done = new Set() } = {}) {
  const profile = cleanProfile(rawProfile)
  const states = skillStates(skills)
  const settings = settingsFor(profile)
  const hasStats = !!skills
  const doneSet = done instanceof Set ? done : new Set(done)
  const next = (kind, from, i) => (kind === 'afk' || kind === 'hardcore' ? intensityPhase(from, profile, doneSet, kind) : kind === 'combat' ? combatPhase(from, profile, hasStats) : kind === 'money' ? (i === 0 ? moneyNowPhase(from, profile, doneSet, settings.hoursPerDay) : moneyUnlockPhase(from, profile, doneSet)) : skillsPhase(from, profile, hasStats))
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
  // What was left out and why (the quests that need more combat than the account has), for the plan to show.
  const sink = { skipped: [] }
  const reasoned = () => purposePhases(states, profile, settings, doneSet, profile.goal === 'quests' ? 'quests' : 'skills', sink)
  let phases = profile.goal === 'skills' || profile.goal === 'quests' ? reasoned() : build(profile.goal)
  const notes = []
  // Nothing reasoned (every skill is far from anything that opens up, or all done): the plain levels, and say so.
  if (!phases.length && (profile.goal === 'skills' || profile.goal === 'quests')) phases = build('skills')
  // Nothing in the chosen kind of plan is left to do: say so, and show what is next instead of an empty list.
  if (!phases.length && profile.goal !== 'skills' && profile.goal !== 'quests') {
    phases = reasoned()
    if (!phases.length) phases = build('skills')
    notes.push(
      {
        combat: "You've finished the combat ladder. Here is what's next instead.",
        money: "None of the money methods we know pay more than what you can already do. Here is what's next instead.",
        afk: "We don't have an AFK method that takes you further. Here is what's next instead.",
        hardcore: "We don't have a faster hands-on method for you right now. Here is what's next instead.",
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

  // Combat: the quests that feed those skills, as a step of their own (their XP counts in the goals).
  let combatQuestRows = []
  if (profile.goal === 'combat' && phases[0]) {
    const combatSkills = new Set(['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Prayer', 'Magic'])
    const evaluated = evaluateQuests(states, profile, doneSet, { skills: combatSkills })
    sink.skipped = evaluated.skipped
    for (const q of evaluated.rows.slice(0, 4)) {
      for (const [sk] of Object.entries(q.xp)) {
        const g = phases[0].goals.find((x) => x.skill === sk)
        if (g) for (const id of q.chain) if (!(g.quests || []).includes(id)) g.quests = [...(g.quests || []), id]
      }
      combatQuestRows.push({ kind: 'quest', id: q.quest.id, title: q.quest.name, rewards: Object.entries(q.xp).map(([sk, x]) => `${x.toLocaleString('en-US')} ${sk} XP`).join(', '), hours: q.minutes / 60, estimated: q.estimated, reasons: questReasons(q) })
    }
  }

  // Quests that save time on each goal where the phase did not choose them itself (members: any short XP quest; free: only free ones).
  for (const p of phases) if (!p.keepQuests) for (const g of p.goals) if (!g.quests?.length) g.quests = questsOf(g, settings, profile)
  for (const p of phases) for (const g of p.goals) g.quests = g.quests || []

  // Within a phase: the order the reasons give, or for the plain phases the order that helps the most (Fishing before Cooking and so on).
  const planOf = (g) => planGoal(resolveGoal(g, settings.globalStrategy, settings.gpValue))
  const passes = phases.map((p) => {
    const plans = p.goals.map(planOf)
    let sorted = p.goals
    let reasonsFor = (g) => g.why || []
    if (!p.keepOrder) {
      const so = smartOrder(p.goals, plans)
      const rank = new Map(so.order.map((s, i) => [s, i]))
      sorted = [...p.goals].sort((a, b) => rank.get(a.skill) - rank.get(b.skill))
      reasonsFor = (g) => [...(g.why || []), ...(so.reasons[g.skill] || [])]
    }
    return { p, plans, sorted, reasonsFor }
  })

  // Hitpoints comes with fighting: every point of damage gives the combat skill 4 xp and Hitpoints 1.33, a third as much. When the plan already trains
  // Attack, Strength, Defence or Ranged enough for the Hitpoints it asks for, Hitpoints has no steps of its own (its hours would be counted twice).
  const fightingIn = (list) => list.reduce((sum, x) => sum + x.p.goals.reduce((n, g, i) => n + (['Attack', 'Strength', 'Defence', 'Ranged'].includes(g.skill) ? x.plans[i].remainingXp || 0 : 0), 0), 0)
  const fightingNow = fightingIn(passes.filter((x) => !x.p.later))
  const fightingAll = fightingIn(passes)
  const covered = new Set() // the Hitpoints goals that need no steps of their own
  for (const x of passes) {
    for (const g of x.p.goals) {
      // A Hitpoints goal that is there because a quest gives Hitpoints xp is a quest reward, not training.
      if (g.skill === 'Hitpoints' && g.purpose !== 'quest' && g.targetXp - g.currentXp <= (x.p.later ? fightingAll : fightingNow) / 3) covered.add(g)
    }
  }
  if ([...covered].some((g) => passes.some((x) => !x.p.later && x.p.goals.includes(g)))) notes.push('Hitpoints comes along with your combat training (about a third of its xp), so it has no steps of its own.')

  // The gp answer: the plan, in the order it is trained, has to fit inside it (making money and ironmen are measured differently).
  const budget = GP_LEVELS.find((l) => l.key === profile.gp)?.budget
  let changes = new Map()
  let trims = new Map()
  if (profile.goal !== 'money' && !profile.iron && budget) {
    const inOrder = passes.filter((x) => !x.p.later).flatMap((x) => x.sorted).filter((g) => !covered.has(g))
    const fit = fitBudget(inOrder, settings, budget)
    changes = fit.goals
    trims = fit.trims
    notes.push(...fit.notes)
  }

  // The budget may have cut some training short; Hitpoints that was not covered by the plan as first made can be covered by what is left of it.
  const finalOf = (x, g) => (!x.p.later && changes.has(g.skill) ? changes.get(g.skill) : g)
  const fightingFinal = passes.filter((x) => !x.p.later).reduce((sum, x) => sum + x.p.goals.reduce((n, g) => {
    const f = finalOf(x, g)
    return n + (f && ['Attack', 'Strength', 'Defence', 'Ranged'].includes(g.skill) ? f.targetXp - f.currentXp : 0)
  }, 0), 0)
  for (const x of passes) {
    if (x.p.later) continue
    for (const g of x.p.goals) {
      const f = finalOf(x, g)
      if (f && g.skill === 'Hitpoints' && g.purpose !== 'quest' && f.targetXp - f.currentXp <= fightingFinal / 3 && !covered.has(g)) {
        covered.add(g)
        if (!notes.some((n) => /^Hitpoints comes along/.test(n))) notes.push('Hitpoints comes along with your combat training (about a third of its xp), so it has no steps of its own.')
      }
    }
  }

  // No budget note for a Hitpoints goal that turned out to need no steps.
  if ([...covered].some((g) => g.skill === 'Hitpoints')) for (let i = notes.length - 1; i >= 0; i--) if (/^Hitpoints (stops at|is left out)/.test(notes[i])) notes.splice(i, 1)
  const ordered = []
  const outPhases = passes.map(({ p, plans, sorted, reasonsFor }) => {
    const rows = []
    for (const g0 of sorted) {
      if (covered.has(g0)) continue
      const changed = !p.later && changes.has(g0.skill)
      const fitted = changed ? changes.get(g0.skill) : g0
      if (!fitted) continue
      const g = fitted
      const plan = changed ? planOf(g) : plans[p.goals.indexOf(g0)]
      let reasons = reasonsFor(g0).filter((t) => t !== 'Done')
      // Stopped short by the budget: the reasons for the planned level (an unlock, a piece of gear) no longer hold, so they say what it would have done.
      const trim = !p.later ? trims.get(g0.skill) : null
      if (trim && reasons.length) {
        const first = reasons[0].replace(/\.$/, '')
        reasons = [`Stopped at level ${trim.to}, not ${trim.from}, to stay inside your budget. At ${trim.from} it would: ${first.charAt(0).toLowerCase()}${first.slice(1)}.`]
      }
      // The quests' own XP can cover a whole goal: say that, not "Done".
      if (plan.remainingXp === 0 && g.quests.length) reasons = [...reasons, 'The quest XP above covers this.']
      // Every step says why: a step with nothing more to say is at least named for the stretch it belongs to.
      if (!reasons.length) reasons = [`${levelAtXp(g.currentXp, true)} to ${levelAtXp(g.targetXp, true)} is part of "${p.title}".`]
      rows.push({
        skill: g.skill,
        from: levelAtXp(g.currentXp, true),
        to: levelAtXp(g.targetXp, true),
        goal: g,
        hours: plan.hours,
        netGp: plan.netGp,
        reasons: reasons.slice(0, 3),
        quests: g.quests.map((id) => getQuest(id)?.name).filter(Boolean),
      })
    }
    if (!p.later) for (const r of rows) ordered.push({ ...r.goal, why: undefined })
    const lead = p.questRows ? p.questRows : []
    return { id: p.id, title: p.title, why: p.why, later: !!p.later, rows: [...lead, ...rows] }
  })

  if (combatQuestRows.length) outPhases.unshift({ id: 'quests', title: 'Quest shortcuts', why: 'Quests hand out XP. Times are for a first run, not a speedrun.', later: false, rows: combatQuestRows })
  if (profile.goal === 'quests' && !outPhases.some((p) => p.id === 'quests')) notes.push('No quest in our list would save you time at your levels.')
  const goals = ordered.map(({ why, purpose, ...g }) => g)
  // A quest that gave a skill no goal of its own (its xp is under a level) still takes its time; the ones inside a goal are counted there already.
  const inGoals = new Set(goals.flatMap((g) => g.quests || []))
  const looseQuestHours = outPhases.filter((p) => !p.later).flatMap((p) => p.rows).filter((r) => r.kind === 'quest' && !inGoals.has(r.id)).reduce((n, r) => n + (r.hours || 0), 0)
  const sum = goals.length ? summarizePlan({ goals, globalStrategy: settings.globalStrategy, gpValue: settings.gpValue, hoursPerDay: settings.hoursPerDay }) : { totalHours: 0, netGp: 0, days: 0 }
  // Left out, and what the plan took for granted, so none of it is a mystery.
  const skippedQuests = (sink.skipped || []).slice(0, 4).map((x) => ({ id: x.quest.id, title: x.quest.name, reason: `Its fights need about combat level ${x.combatNeed}${x.quest.combatGuess ? ' (worked out from its enemies)' : ''}; yours is ${x.combat}.` }))
  const assumed = { combat: combatLevel(levelsOf(states)), members: profile.members, iron: profile.iron, doneQuests: doneSet.size }
  return { profile, settings, phases: outPhases, notes, goals, skippedQuests, assumed, totals: { goals: goals.length, hours: sum.totalHours + looseQuestHours, days: sum.days + looseQuestHours / Math.max(settings.hoursPerDay || 1, 0.1), netGp: sum.netGp }, empty: !goals.length && !looseQuestHours }
}

/** What to start a plan from: the ordered goals and the settings. */
export function planFromProfile(rawProfile, skills, opts) {
  const r = recommend(rawProfile, skills, opts)
  return { goals: r.goals, ...r.settings, profile: r.profile }
}
