// Per-goal calculator pages such as /calculators/agility/1-to-99. Searchers type goals ("osrs agility 1 to 99"),
// so each popular goal gets its own page with a computed quick answer, route table, method table, XP milestones
// and FAQ. Everything here is derived from the same planner engine and data the calculator uses, so the numbers
// on these pages can never drift from what the calculator shows. The build also runs this module (see
// vite.config.js) to give the server crawler-readable HTML and structured data for every page.
import {
  AUTO_FAST,
  DEFAULT_GP_VALUE,
  compareStrategies,
  profitableMethods,
  relevantMethods,
  xpAtLevel,
  formatNum,
  formatHours,
  formatGp,
} from '@/utils/planner'
import { SKILL_INFO } from '@/data/skillInfo'

// The goals people actually search for. Each skill gets the ones that make sense for it.
export const GOAL_RANGES = [
  [1, 99],
  [1, 70],
  [1, 50],
  [50, 99],
  [70, 99],
  [80, 99],
  [90, 99],
  [92, 99],
]

// Hitpoints starts at level 10, so "1 to 99" there really means 10 to 99.
const START_LEVEL = { Hitpoints: 10 }
const HOURS_PER_DAY = 2

export const goalSlug = (from, to) => `${from}-to-${to}`

/** The goal ranges offered for one skill, as { from, to, slug, label }. */
export function goalsForSkill(info) {
  const start = START_LEVEL[info.name] || 1
  const seen = new Set()
  const out = []
  for (const [a, b] of GOAL_RANGES) {
    const from = Math.max(a, start)
    if (from >= b) continue
    const slug = goalSlug(from, b)
    if (seen.has(slug)) continue
    seen.add(slug)
    out.push({ from, to: b, slug, label: `${from} to ${b}` })
  }
  return out
}

/** Looks a URL segment such as "1-to-99" up in a skill's offered goals. */
export function findGoal(info, slug) {
  return goalsForSkill(info).find((g) => g.slug === String(slug || '').toLowerCase()) || null
}

const money = (gp) => formatGp(Math.abs(gp)).replace(/^[+-]/, '')

function gpPhrase(plan) {
  if (plan.netGp == null) return 'has no reliable gp figure'
  if (Math.abs(plan.netGp) < 1000) return 'is roughly break-even'
  const partial = plan.gpPartial ? ' (not counting unpriced steps)' : ''
  return plan.netGp > 0 ? `makes about ${money(plan.netGp)}${partial}` : `costs about ${money(plan.netGp)}${partial}`
}

const stepsText = (plan) => plan.segments.map((s) => `${s.method.name} from level ${s.startLevel} to ${s.endLevel}`).join(', then ')
const daysText = (hours) => {
  const d = Math.max(Math.ceil(hours / HOURS_PER_DAY), 1)
  return `${d.toLocaleString('en-US')} day${d === 1 ? '' : 's'}`
}

function routeRow(id, label, plan) {
  return {
    id,
    label,
    hours: plan.hours,
    hoursText: formatHours(plan.hours),
    netGp: plan.netGp,
    gpText: plan.netGp == null ? 'No GP data' : formatGp(plan.netGp),
    gpPartial: plan.gpPartial,
    steps: plan.segments.map((s) => ({
      from: s.startLevel,
      to: s.endLevel,
      method: s.method.name,
      xp: s.xp,
      xpPerHour: s.xpPerHour,
      hours: s.hours,
      hoursText: formatHours(s.hours),
      gpText: s.netGp == null ? 'Unpriced' : formatGp(s.netGp),
    })),
  }
}

/**
 * Everything one goal page shows, or null when the catalog cannot plan the whole goal (a page with a hole in
 * its numbers is worse than no page).
 */
export function buildGoalContent(info, from, to) {
  const skill = info.name
  const fromXp = xpAtLevel(from)
  const toXp = xpAtLevel(to)
  const xp = toXp - fromXp
  const plans = compareStrategies({ skill, currentXp: fromXp, targetXp: toXp, methodId: AUTO_FAST, gpValuePerHour: DEFAULT_GP_VALUE })
  const complete = (p) => p && p.complete && p.hours != null && p.segments.length > 0
  if (!complete(plans.fast) || !complete(plans.cheap) || !complete(plans.balanced)) return null

  const profit = profitableMethods(skill, from, to)
  const routes = [routeRow('fast', 'Fastest', plans.fast), routeRow('cheap', 'Cheapest', plans.cheap), routeRow('balanced', 'Balanced', plans.balanced)]
  if (profit.length && complete(plans.profit)) routes.push(routeRow('profit', 'Most profitable', plans.profit))

  const methods = relevantMethods(skill, from, to)
    .slice()
    .sort((a, b) => b.xpPerHour - a.xpPerHour)
    .slice(0, 12)
    .map((m) => ({
      name: m.name,
      minLevel: m.minLevel,
      maxLevel: m.maxLevel ?? null,
      xpPerHour: m.xpPerHour,
      gpPerHour: m.gpPerHour ?? null,
      gpText: m.gpPerHour == null ? 'No GP data' : m.gpPerHour === 0 ? 'Break-even' : `${formatGp(m.gpPerHour)}/h`,
    }))

  // Milestone levels: every tenth level inside the range plus the goal itself, with XP from the starting level.
  const levels = []
  for (let l = from + 1; l <= to; l++) if (l % 10 === 0 || l === to) levels.push(l)
  const milestones = levels.map((l) => ({ level: l, totalXp: xpAtLevel(l), fromStart: xpAtLevel(l) - fromXp }))

  const fast = plans.fast
  const cheap = plans.cheap
  const label = `${from} to ${to}`
  const q = `${skill} ${label}`
  const faq = [
    {
      q: `How much XP do you need to train ${skill} from ${from} to ${to} in OSRS?`,
      a: `Level ${to} ${skill} needs ${formatNum(toXp)} XP in total. Starting at level ${from} (${formatNum(fromXp)} XP), you need to gain ${formatNum(xp)} XP.${to === 99 && from < 92 ? ` Level 92 is only the halfway point in XP terms, at ${formatNum(xpAtLevel(92))} XP, so the last seven levels take as much XP as the first ninety-one.` : ''}`,
    },
    {
      q: `How long does it take to train ${skill} from ${from} to ${to}?`,
      a: `With the fastest route it takes about ${formatHours(fast.hours)} of play, roughly ${daysText(fast.hours)} at ${HOURS_PER_DAY} hours a day. The cheapest route takes about ${formatHours(cheap.hours)}. Your own time depends on your gear, stats and how closely you follow each method.`,
    },
    {
      q: `What is the fastest way to train ${skill} from ${from} to ${to}?`,
      a: `The fastest route is ${stepsText(fast)}. It averages about ${formatNum(xp / fast.hours)} XP per hour over the whole goal.`,
    },
    {
      q: `How much does it cost to train ${skill} from ${from} to ${to}?`,
      a: `The cheapest route ${gpPhrase(cheap)}, while the fastest route ${gpPhrase(fast)}. These are estimates from typical prices and rates, net of supplies and loot.`,
    },
  ]
  if (routes.some((r) => r.id === 'profit')) {
    const best = profit[0]
    faq.push({
      q: `Can you make money training ${skill} from ${from} to ${to}?`,
      a: `Yes. ${best.name} makes about ${formatGp(best.gpPerHour).replace(/^\+/, '')} per hour in this range, and the most profitable route ${gpPhrase(plans.profit)} over the whole goal.`,
    })
  }

  const path = `/calculators/${info.slug}/${goalSlug(from, to)}`
  const gpClause = routes.some((r) => r.id === 'profit') ? ', cheapest and most profitable' : ' and cheapest'
  return {
    skill,
    slug: info.slug,
    path,
    from,
    to,
    label,
    fromXp,
    toXp,
    xp,
    title: `OSRS ${q}: XP, Hours and Best Methods | TickGains`,
    description: `${q} in OSRS needs ${formatNum(xp)} XP, about ${formatHours(fast.hours)} on the fastest route. Compare fastest${gpClause} methods with a free calculator.`,
    h1: `OSRS ${skill} ${label} Calculator`,
    lead: `${formatNum(xp)} XP separates level ${from} from level ${to} in ${skill}. Check the fastest, cheapest and balanced routes below, then enter your own stats to see your own numbers.`,
    summary: `${q} takes ${formatNum(xp)} XP. The fastest route needs about ${formatHours(fast.hours)} and the cheapest about ${formatHours(cheap.hours)}.`,
    routes,
    methods,
    milestones,
    faq,
  }
}

/** Every goal page the site serves, for the build to write out and the sitemap to list. */
export function allGoalPages() {
  const pages = []
  for (const info of SKILL_INFO) {
    for (const g of goalsForSkill(info)) {
      const content = buildGoalContent(info, g.from, g.to)
      if (content) pages.push({ ...content, category: info.category })
    }
  }
  return pages
}
