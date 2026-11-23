import { F2P_SKILLS, F2P_METHOD_IDS, LEVEL_STEPS, START_LEVEL, COMBAT_TIERS } from '@/data/plannerMilestones'
import { methodsForSkill } from '@/data/trainingMethods'
import { questBySlug } from '@/data/questList'
import { getQuest } from '@/data/quests'
import { AUTO_CHEAP, AUTO_FAST, AUTO_PROFIT, levelAtXp, planGoal, suggestedQuests, xpAtLevel, formatGp } from '@/utils/planner'
import { resolveGoal, summarizePlan } from '@/utils/plannerTools'
import { skillStates, recommendedPlans } from '@/utils/recommendedPlans'
import { smartOrder } from '@/utils/smartOrder'
import { SYNERGIES } from '@/data/skillSynergies'
import { canUseMethod, fundingFor, levelsOf, questsFor, unlockFor } from '@/utils/smartReasons'
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
function moneyNowPhase(states, profile, done = new Set()) {
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
  const goals = best.slice(0, 3).map(({ s, m }) => {
    const to = reachable(s.skill, Math.min(99, s.level + 10), profile)
    return { ...mk(s, to, profile), methodId: m.id, why: [`${m.name}: about ${gpShortText(m.gpPerHour)} gp an hour while you train.`] }
  }).filter((g) => g.targetXp > g.currentXp)
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
function purposePhases(states, profile, settings, done, mode) {
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
  const picks = questsFor(states, profile, done).slice(0, nQuests)

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
        const to = Math.max(levelAtXp(st.xp + amount), st.level + 1)
        const g = { ...mkGoalFor(st, to, profile), why: [`${q.quest.name} gives ${amount.toLocaleString('en-US')} ${sk} XP, about level ${to}.`], purpose: 'quest', quests: [...q.chain] }
        goals.set(sk, g)
      }
    }
    questRows.push({
      kind: 'quest',
      id: q.quest.id,
      title: q.quest.name,
      rewards: Object.entries(q.xp).map(([sk, x]) => `${x.toLocaleString('en-US')} ${sk} XP`).join(', '),
      hours: q.minutes / 60,
      estimated: q.estimated,
      reasons: [`Skips about ${hoursText(q.savedHours)} of training for about ${q.minutes >= 60 ? hoursText(q.minutes / 60) : `${q.minutes} min`}${q.estimated ? ' (estimated)' : ''}.`],
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
  if (questGoals.length || questRows.length) phases.push({ id: 'quests', title: 'Quest shortcuts', why: 'Quests hand out XP for a few minutes of work, and some need a level first.', goals: questGoals, questRows, keepOrder: true, keepQuests: true })
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
  const next = (kind, from, i) => (kind === 'combat' ? combatPhase(from, profile, hasStats) : kind === 'money' ? (i === 0 ? moneyNowPhase(from, profile, doneSet) : moneyUnlockPhase(from, profile, doneSet)) : skillsPhase(from, profile, hasStats))
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
  const reasoned = () => purposePhases(states, profile, settings, doneSet, profile.goal === 'quests' ? 'quests' : 'skills')
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
    for (const q of questsFor(states, profile, doneSet, { skills: combatSkills }).slice(0, 4)) {
      for (const [sk] of Object.entries(q.xp)) {
        const g = phases[0].goals.find((x) => x.skill === sk)
        if (g) for (const id of q.chain) if (!(g.quests || []).includes(id)) g.quests = [...(g.quests || []), id]
      }
      combatQuestRows.push({ kind: 'quest', id: q.quest.id, title: q.quest.name, rewards: Object.entries(q.xp).map(([sk, x]) => `${x.toLocaleString('en-US')} ${sk} XP`).join(', '), hours: q.minutes / 60, estimated: q.estimated, reasons: [`Skips about ${hoursText(q.savedHours)} of training for about ${q.minutes} min${q.estimated ? ' (estimated)' : ''}.`] })
    }
  }

  // Quests that save time on each goal where the phase did not choose them itself (members: any short XP quest; free: only free ones).
  for (const p of phases) if (!p.keepQuests) for (const g of p.goals) if (!g.quests?.length) g.quests = questsOf(g, settings, profile)
  for (const p of phases) for (const g of p.goals) g.quests = g.quests || []

  // Within a phase: the order the reasons give, or for the plain phases the order that helps the most (Fishing before Cooking and so on).
  const ordered = []
  const planOf = (g) => planGoal(resolveGoal(g, settings.globalStrategy, settings.gpValue))
  const outPhases = phases.map((p) => {
    const plans = p.goals.map(planOf)
    let sorted = p.goals
    let reasonsFor = (g) => g.why || []
    if (!p.keepOrder) {
      const so = smartOrder(p.goals, plans)
      const rank = new Map(so.order.map((s, i) => [s, i]))
      sorted = [...p.goals].sort((a, b) => rank.get(a.skill) - rank.get(b.skill))
      reasonsFor = (g) => [...(g.why || []), ...(so.reasons[g.skill] || [])]
    }
    const rows = sorted.map((g) => {
      const plan = plans[p.goals.indexOf(g)]
      let reasons = reasonsFor(g).filter((t) => t !== 'Done')
      // The quests' own XP can cover a whole goal: say that, not "Done".
      if (plan.remainingXp === 0 && g.quests.length) reasons = [...reasons, 'The quest XP above covers this.']
      return {
        skill: g.skill,
        from: levelAtXp(g.currentXp, true),
        to: levelAtXp(g.targetXp, true),
        goal: g,
        hours: plan.hours,
        netGp: plan.netGp,
        reasons: reasons.slice(0, 3),
        quests: g.quests.map((id) => getQuest(id)?.name).filter(Boolean),
      }
    })
    if (!p.later) for (const r of rows) ordered.push({ ...r.goal, why: undefined })
    const lead = p.questRows ? p.questRows : []
    return { id: p.id, title: p.title, why: p.why, later: !!p.later, rows: [...lead, ...rows] }
  })

  if (combatQuestRows.length) outPhases.unshift({ id: 'quests', title: 'Quest shortcuts', why: 'Quests hand out XP for a few minutes of work.', later: false, rows: combatQuestRows })
  if (profile.goal === 'quests' && !outPhases.some((p) => p.id === 'quests')) notes.push('No quest in our list would save you time at your levels.')
  const goals = ordered.map(({ why, purpose, ...g }) => g)
  const sum = goals.length ? summarizePlan({ goals, globalStrategy: settings.globalStrategy, gpValue: settings.gpValue, hoursPerDay: settings.hoursPerDay }) : { totalHours: 0, netGp: 0, days: 0 }
  return { profile, settings, phases: outPhases, notes, goals, totals: { goals: goals.length, hours: sum.totalHours, days: sum.days, netGp: sum.netGp }, empty: !goals.length }
}

/** What to start a plan from: the ordered goals and the settings. */
export function planFromProfile(rawProfile, skills, opts) {
  const r = recommend(rawProfile, skills, opts)
  return { goals: r.goals, ...r.settings, profile: r.profile }
}
