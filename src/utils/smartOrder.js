import { SYNERGIES } from '@/data/skillSynergies'
import { levelAtXp, planGoal } from '@/utils/planner'
import { resolveGoal } from '@/utils/plannerTools'

// A suggested training order for the skills in a plan, tailored to the player: which skills to train first because they help others
// (see data/skillSynergies.js), which earn the gp that pays for the expensive ones, and which are quick to finish. The planner works out each
// skill on its own, so this does not change a skill's time; it picks the order that makes later skills cheaper and easier. Pure.

const FUND_MIN_COST = 1_000_000 // the plan has to cost at least this for gp to shape the order
const EARNER_GPH = 50_000 // gp an hour from which a skill counts as earning
const SPENDER_GPH = -150_000 // gp an hour at which a skill counts as an expense
const QUICK_WEIGHT = 0.6 // how much a short skill moves up (a tie-break next to the synergies)

const money = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : `${Math.round(n / 1e3)}K`)
const joinNames = (list) => (list.length <= 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`)

/**
 * goals: [{ skill, currentXp, targetXp }], plans: the planner's result for each goal ({ hours, netGp, remainingXp }), in the same order.
 * Returns { order: [skill, ...], reasons: { skill: [text, ...] }, changed } where `order` is the suggestion (skills that are done keep the
 * front) and `changed` says whether it differs from the order given.
 */
export function smartOrder(goals, plans) {
  const items = goals.map((g, i) => ({
    skill: g.skill,
    index: i,
    done: !((plans[i]?.remainingXp ?? g.targetXp - g.currentXp) > 0),
    from: levelAtXp(g.currentXp, true),
    to: levelAtXp(g.targetXp, true),
    hours: plans[i]?.hours || 0,
    gph: plans[i]?.hours > 0 && plans[i]?.netGp != null ? plans[i].netGp / plans[i].hours : null,
  }))
  const open = items.filter((x) => !x.done)
  const done = items.filter((x) => x.done)
  const by = new Map(open.map((x) => [x.skill, x]))

  // The synergies that apply to this player and this plan.
  const edges = SYNERGIES.filter((e) => {
    const a = by.get(e.from)
    const b = by.get(e.to)
    return a && b && b.to >= e.toMin && a.from < e.fromEnough && (!e.fromTargetMin || a.to >= e.fromTargetMin)
  })

  // gp only shapes the order when the plan has real costs to fund.
  const totalCost = open.reduce((sum, x) => sum + (x.gph != null && x.gph < 0 ? -x.gph * x.hours : 0), 0)
  const funding = totalCost >= FUND_MIN_COST
  const fundScore = (x) => {
    if (!funding || x.gph == null) return 0
    if (x.gph >= EARNER_GPH) return Math.min(3, x.gph / 150_000)
    if (x.gph <= SPENDER_GPH) return -Math.min(3, -x.gph / 300_000)
    return 0
  }
  // Short skills first, a little: the rank among the open skills by hours, 1 for the shortest down to 0.
  const byHours = [...open].sort((a, b) => a.hours - b.hours || a.index - b.index)
  const quick = new Map(byHours.map((x, i) => [x.skill, open.length > 1 ? 1 - i / (open.length - 1) : 0]))

  // Greedy: the skill that helps the most others still to come (and needs the fewest) goes next.
  const remaining = new Set(open.map((x) => x.skill))
  const placed = []
  while (remaining.size) {
    let best = null
    let bestScore = -Infinity
    for (const x of open) {
      if (!remaining.has(x.skill)) continue
      const gives = edges.filter((e) => e.from === x.skill && remaining.has(e.to)).reduce((s, e) => s + e.w, 0)
      const needs = edges.filter((e) => e.to === x.skill && remaining.has(e.from)).reduce((s, e) => s + e.w, 0)
      const score = gives - needs + fundScore(x) + QUICK_WEIGHT * (quick.get(x.skill) || 0)
      if (score > bestScore + 1e-9) {
        best = x
        bestScore = score
      }
    }
    placed.push(best)
    remaining.delete(best.skill)
  }

  const order = [...done, ...placed].map((x) => x.skill)
  const position = new Map(order.map((s, i) => [s, i]))

  // Why each skill sits where it does: the help it gives later skills, then what it earns or costs, then its length.
  const reasons = {}
  for (const x of open) {
    const list = []
    const helps = edges.filter((e) => e.from === x.skill && position.get(e.to) > position.get(x.skill))
    const groups = new Map()
    for (const e of helps) groups.set(e.why, [...(groups.get(e.why) || []), e.to])
    for (const [why, targets] of groups) list.push(`Before ${joinNames(targets)}: ${why}`)
    const spenders = open.filter((y) => fundScore(y) < 0 && position.get(y.skill) > position.get(x.skill)).map((y) => y.skill)
    if (fundScore(x) > 0 && spenders.length) list.push(`Earns ${money(x.gph)} gp/h to pay for ${joinNames(spenders.slice(0, 2))}`)
    else if (fundScore(x) < 0 && open.some((y) => fundScore(y) > 0 && position.get(y.skill) < position.get(x.skill))) list.push(`Costs ${money(-x.gph)} gp/h, so after the earners`)
    if (!list.length && open.length > 2) {
      const longest = Math.max(...open.map((y) => y.hours))
      if (x.skill === placed[placed.length - 1].skill && x.hours >= longest) list.push('Longest grind, so last')
      else if (quick.get(x.skill) >= 0.75 && position.get(x.skill) < done.length + Math.ceil(open.length / 2)) list.push('Quick win, so early')
    }
    reasons[x.skill] = list.slice(0, 2)
  }
  for (const x of done) reasons[x.skill] = ['Done']

  return { order, reasons, changed: order.some((s, i) => s !== goals[i].skill) }
}

/**
 * The goals in the suggested order, worked out with the planner's own settings (so a plan can be ordered before it is on screen).
 * Returns { goals, changed }.
 */
export function smartOrderGoals(goals, { globalStrategy, gpValue } = {}) {
  const plans = goals.map((g) => planGoal(resolveGoal(g, globalStrategy, gpValue)))
  const { order, changed } = smartOrder(goals, plans)
  const rank = new Map(order.map((skill, i) => [skill, i]))
  return { goals: [...goals].sort((a, b) => rank.get(a.skill) - rank.get(b.skill)), changed }
}
