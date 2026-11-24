import { F2P_SKILLS, F2P_METHOD_IDS } from '@/data/plannerMilestones'
import { methodsForSkill } from '@/data/trainingMethods'
import { requirementsFor } from '@/data/methodRequirements'
import { QUESTS, getQuest, questChain } from '@/data/quests'
import { questBySlug } from '@/data/questList'
import { questSlug } from '@/utils/questSlug'
import { AUTO_CHEAP, AUTO_FAST, AUTO_PROFIT, levelAtXp, planGoal, xpAtLevel, formatGp } from '@/utils/planner'
import { resolveGoal } from '@/utils/plannerTools'
import { formatXp } from '@/utils/osrsSkills'
import { combatLevel } from '@/utils/combat'

// The reasoning behind the Smart Planner's steps (see utils/smartPlanner.js): the next level that opens something better, which skill to
// train first to pay for the rest, and which quests are worth their time. Pure; every figure comes from the planner's own methods and quests.

/** How long a quest is taken to take when we do not know: a stated estimate, and shown as one. */
export const ESTIMATED_QUEST_MINUTES = 60

export { combatLevel }
const MAX_STRETCH_HOURS = 40 // how far one step goes for one skill

const isTrick = (m) => /tick manipulation|-tick\b/i.test(`${m.name} ${m.requirements}`)
const f2pIds = (skill) => methodsForSkill(skill).filter((m) => F2P_METHOD_IDS.has(m.id)).map((m) => m.id)
export const isFreeQuest = (quest) => quest.members === false || questBySlug(questSlug(quest.name))?.type === 'F'
const gpShort = (n) => formatGp(Math.round(n)).replace(/^\+/, '').replace(/ gp$/, '')
const eligible = (skill, profile) => profile.members || F2P_SKILLS.includes(skill)

/**
 * Whether a player with these levels can use a method today: the skill levels it asks for are met, and it needs no quest, unlock or special item
 * (spellbooks, teleports, shards) that we cannot know they have, unless the quest is marked finished. Only such methods are recommended.
 */
export function canUseMethod(m, levels, done = new Set()) {
  for (const r of requirementsFor(m)) {
    if (r.kind === 'skill') {
      if ((levels[r.skill] ?? 1) < r.level) return false
    } else if (r.kind === 'quest') {
      if (!done.has(r.id.replace(/^quest:/, '').replace(/:partial$/, ''))) return false
    } else if (r.kind === 'unlock' || r.kind === 'equipment') return false
  }
  return true
}

function usableMethods(skill, profile) {
  const allowed = profile.members ? null : new Set(f2pIds(skill))
  return methodsForSkill(skill).filter((m) => (!allowed || allowed.has(m.id)) && !isTrick(m))
}
const openAt = (m, level) => m.minLevel <= level && (m.maxLevel == null || level <= m.maxLevel)
const bestRate = (methods, level, key = 'xpPerHour') => methods.filter((m) => openAt(m, level) && m[key] != null).reduce((best, m) => Math.max(best, m[key]), 0)

/** Hours to take a skill from one level to another by the fastest route (null when the catalogue has a gap). */
export function hoursBetween(state, toLevel, profile) {
  const allowedMethodIds = profile.members ? undefined : f2pIds(state.skill)
  // No free-to-play route at all (an empty list would mean "any method" to the planner).
  if (allowedMethodIds && !allowedMethodIds.length) return null
  const plan = planGoal({ skill: state.skill, currentXp: state.xp, targetXp: xpAtLevel(toLevel), methodId: AUTO_FAST, quests: [], ...(allowedMethodIds ? { allowedMethodIds } : {}) })
  return plan.complete ? plan.hours : null
}

/**
 * The next level in a skill that opens a clearly faster way to train it (30% more xp an hour or better), and why:
 * { to, method, fromRate, toRate, hours, partial, reason } or null when nothing like that is in reach. A long way off is cut to what fits in
 * about 40 hours, as "on the way".
 */
export function unlockFor(state, profile, done = new Set(), levels = {}) {
  if (!eligible(state.skill, profile) || state.level >= 99) return null
  const all = usableMethods(state.skill, profile)
  const okAt = (m, lvl) => canUseMethod(m, { ...levels, [state.skill]: lvl }, done)
  const fromRate = bestRate(all.filter((m) => okAt(m, state.level)), state.level)
  const options = all.filter((m) => m.minLevel > state.level && m.minLevel <= 99 && m.xpPerHour >= Math.max(fromRate, 1) * 1.3 && okAt(m, m.minLevel)).sort((a, b) => a.minLevel - b.minLevel || b.xpPerHour - a.xpPerHour)
  for (const m of options) {
    const toRate = bestRate(all.filter((x) => okAt(x, m.minLevel)), m.minLevel)
    if (toRate < Math.max(fromRate, 1) * 1.3) continue
    const hours = hoursBetween(state, m.minLevel, profile)
    if (hours == null) continue
    let to = m.minLevel
    let used = hours
    if (hours > MAX_STRETCH_HOURS) {
      // The long way: as far as about 40 hours reach.
      let lo = state.level + 1
      let hi = m.minLevel - 1
      let best = null
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const h = hoursBetween(state, mid, profile)
        if (h != null && h <= MAX_STRETCH_HOURS) {
          best = { level: mid, hours: h }
          lo = mid + 1
        } else hi = mid - 1
      }
      if (!best || best.level <= state.level + 2) continue
      to = best.level
      used = best.hours
    }
    const partial = to < m.minLevel
    const rates = fromRate ? `about ${formatXp(toRate)} xp an hour, up from ${formatXp(fromRate)}` : `about ${formatXp(toRate)} xp an hour`
    const reason = partial ? `On the way to level ${m.minLevel}, which opens ${m.name}: ${rates}.` : `Level ${to} opens ${m.name}: ${rates}.`
    return { to, method: m, fromRate, toRate, hours: used, partial, reason, gain: toRate - fromRate }
  }
  return null
}

/**
 * Quests worth doing (each with whatever it needs first), with what they are worth: { quest, chain, xp, savedHours, minutes, estimated, unmet,
 * reqHours, net, combatNeed, qpNeed, qpOk }. A quest is worth it when the training time its XP saves beats its own length plus the hours to
 * reach any level it needs. `skipped` is the quests that would have been worth it but for the combat level they need: [{ quest, combatNeed, combat, net }].
 * Quest points are not tracked, so a quest that needs some is shown with a note (`qpOk` false) unless the finished quests and the ones it comes
 * after add up to enough.
 */
export function evaluateQuests(states, profile, done = new Set(), { skills = null, minNet = 0.5 } = {}) {
  const byName = Object.fromEntries(states.map((s) => [s.skill, s]))
  const rows = []
  const skipped = []
  const doneQp = [...done].reduce((sum, id) => sum + (getQuest(id)?.qp || 0), 0)
  for (const q of QUESTS) {
    if (done.has(q.id)) continue
    if (!profile.members && !isFreeQuest(q)) continue
    const chain = questChain(q.id).filter((id) => !done.has(id))
    if (!profile.members && chain.some((id) => !isFreeQuest(getQuest(id)))) continue
    const xp = {}
    const unmet = []
    let estimated = true // every length here is a first-timer's estimate, shown as one
    let minutes = 0
    let combatNeed = 0
    let qpNeed = 0
    let qpBefore = doneQp
    for (const id of chain) {
      const c = getQuest(id)
      for (const [sk, amount] of Object.entries(c.rewards)) xp[sk] = (xp[sk] || 0) + amount
      for (const [sk, need] of Object.entries(c.reqs)) {
        const have = byName[sk]?.level ?? 1
        if (have < need && !unmet.some((u) => u.skill === sk && u.need >= need)) unmet.push({ skill: sk, need, have })
      }
      minutes += c.minutes || ESTIMATED_QUEST_MINUTES
      combatNeed = Math.max(combatNeed, c.combat || 0)
      qpNeed = Math.max(qpNeed, c.qpReq || 0)
      if (id !== q.id) qpBefore += c.qp || 0
    }
    if (skills && !Object.keys(xp).some((sk) => skills.has(sk))) continue
    if (!profile.members && unmet.some((u) => !F2P_SKILLS.includes(u.skill))) continue
    let reqHours = 0
    let blocked = false
    for (const u of unmet) {
      const h = hoursBetween(byName[u.skill], u.need, profile)
      if (h == null) blocked = true
      else reqHours += h
    }
    if (blocked) continue
    let saved = 0
    for (const [sk, amount] of Object.entries(xp)) {
      const s = byName[sk]
      if (!s || (!profile.members && !F2P_SKILLS.includes(sk))) continue
      const methods = usableMethods(sk, profile)
      const level = Math.max(s.level, ...unmet.filter((u) => u.skill === sk).map((u) => u.need))
      const rate = bestRate(methods, level) || bestRate(methods, s.level)
      if (!rate) continue
      saved += Math.min(amount, Math.max(xpAtLevel(99) - s.xp, 0)) / rate
    }
    const net = saved - minutes / 60 - reqHours
    if (net < minNet) continue
    // Its fights need a combat level: counted with the levels the quest itself asks for first, and left out until the account has it.
    const levels = { ...levelsOf(states) }
    for (const u of unmet) levels[u.skill] = Math.max(levels[u.skill] || 1, u.need)
    const combat = combatLevel(levels)
    if (combat < combatNeed) {
      skipped.push({ quest: q, combatNeed, combat, net })
      continue
    }
    rows.push({ quest: q, chain, xp, savedHours: saved, minutes, estimated, unmet, reqHours, net, combatNeed, qpNeed, qpOk: qpNeed <= qpBefore })
  }
  rows.sort((a, b) => b.net - a.net || (a.quest.name < b.quest.name ? -1 : 1))
  skipped.sort((a, b) => b.net - a.net || (a.quest.name < b.quest.name ? -1 : 1))
  return { rows, skipped }
}

/** The quests worth doing: the rows of evaluateQuests. */
export function questsFor(states, profile, done = new Set(), opts = {}) {
  return evaluateQuests(states, profile, done, opts).rows
}

/**
 * Which skill to train first so its profit pays for the costly ones: { skill, to, netGp, hours, covers: [{ skill, cost }], reason } for up to two
 * skills, or [] when the costly goals come to less than 1M (nothing to fund). `spenders` is [{ skill, netGp }] from the rest of the plan.
 */
export function levelsOf(states) {
  return Object.fromEntries(states.map((x) => [x.skill, x.level]))
}

export function fundingFor(states, profile, spenders, avoid = new Set()) {
  const costly = spenders.filter((s) => s.netGp != null && s.netGp < -100_000).sort((a, b) => a.netGp - b.netGp)
  const need = -costly.reduce((sum, s) => sum + s.netGp, 0)
  if (need < 1_000_000) return []
  const spend = new Set([...costly.map((s) => s.skill), ...avoid])
  const options = []
  for (const s of states) {
    if (!eligible(s.skill, profile) || s.level >= 99 || spend.has(s.skill)) continue
    const methods = usableMethods(s.skill, profile)
    if (!methods.some((m) => m.gpPerHour >= 300_000 && m.minLevel <= s.level + 25)) continue
    const allowedMethodIds = profile.members ? undefined : f2pIds(s.skill)
    let best = null
    for (const gap of [8, 16, 25]) {
      const to = Math.min(99, s.level + gap)
      if (to <= s.level) continue
      const plan = planGoal({ skill: s.skill, currentXp: s.xp, targetXp: xpAtLevel(to), methodId: AUTO_PROFIT, quests: [], ...(allowedMethodIds ? { allowedMethodIds } : {}) })
      if (!plan.complete || !(plan.hours > 0) || !(plan.netGp > 0) || plan.hours > MAX_STRETCH_HOURS) continue
      if (!best || plan.netGp > best.netGp) best = { skill: s.skill, from: s.level, to, netGp: plan.netGp, hours: plan.hours, rate: plan.netGp / plan.hours }
    }
    if (best && best.rate >= 250_000) options.push(best)
  }
  options.sort((a, b) => b.rate - a.rate || (a.skill < b.skill ? -1 : 1))
  const chosen = []
  let have = 0
  for (const o of options) {
    if (chosen.length >= 2 || have >= need) break
    chosen.push(o)
    have += o.netGp
  }
  const names = costly.slice(0, 3).map((c) => `${c.skill} (${gpShort(c.netGp)})`)
  return chosen.map((o) => ({
    ...o,
    covers: costly,
    reason: `Earns about ${gpShort(o.netGp)} in ${o.hours >= 10 ? Math.round(o.hours) : o.hours.toFixed(1)} h, which helps pay for ${names.join(', ')}.`,
  }))
}

export { levelAtXp }

/**
 * Keeps a plan inside the gp the player said they can spend. Goals are taken in the order they will be trained, with a running balance (the
 * budget, less what each goal costs and plus what an earlier one made). A goal that does not fit is first planned with the cheapest methods,
 * then stopped at the highest level that does fit, then left out. Returns { goals: Map(skill -> goal | null), notes, trims } (null is left out);
 * only goals that changed or went are in the map. `budgetGp` of null or Infinity means no limit.
 */
export function fitBudget(goals, { globalStrategy, gpValue }, budgetGp) {
  const changes = new Map()
  const notes = []
  // Where a goal was stopped short: skill -> { from: planned level, to: level reached }, so its row can say its original reason no longer holds.
  const trims = new Map()
  if (!(budgetGp > 0) || !Number.isFinite(budgetGp)) return { goals: changes, notes, trims }
  const netOf = (g) => {
    const plan = planGoal(resolveGoal(g, globalStrategy, gpValue))
    return plan.netGp ?? 0
  }
  const money = (n) => formatXp(Math.round(n))
  let balance = budgetGp
  for (const g of goals) {
    const net = netOf(g)
    if (balance + net >= 0) {
      balance += net
      continue
    }
    const cheap = { ...g, methodId: AUTO_CHEAP }
    const cheapNet = netOf(cheap)
    if (balance + cheapNet >= 0) {
      changes.set(g.skill, cheap)
      balance += cheapNet
      continue
    }
    // Stop short: the highest level whose cost still fits.
    const from = levelAtXp(g.currentXp)
    let lo = from + 1
    let hi = levelAtXp(g.targetXp) - 1
    let best = null
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      const trial = { ...cheap, targetXp: xpAtLevel(mid) }
      if (balance + netOf(trial) >= 0) {
        best = { level: mid, goal: trial }
        lo = mid + 1
      } else hi = mid - 1
    }
    if (best) {
      changes.set(g.skill, best.goal)
      trims.set(g.skill, { from: levelAtXp(g.targetXp), to: best.level })
      balance += netOf(best.goal)
      notes.push(`${g.skill} stops at level ${best.level} to stay inside your ${money(budgetGp)} gp budget.`)
    } else {
      changes.set(g.skill, null)
      notes.push(`${g.skill} is left out: even the cheapest route costs about ${money(-cheapNet)} gp, over your ${money(budgetGp)} gp budget.`)
    }
  }
  return { goals: changes, notes, trims }
}
