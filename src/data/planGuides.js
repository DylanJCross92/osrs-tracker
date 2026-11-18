// Plan guide pages such as /plans/max-cape: how long and how much XP a whole-account goal takes, worked out by the same
// engine as the Account Planner and based on a brand new account, with a button that opens the planner with the plan
// already filled in. Because the numbers come from the planner, they cannot drift from what it shows. The build also runs
// this module (see vite.config.js) to give the server crawler-readable HTML and structured data for every page.
import { AUTO_FAST, DEFAULT_GP_VALUE, encodePlan, formatGp, formatHours, formatNum, levelAtXp, planGoal, planTotals } from '@/utils/planner'
import { resolveGoal } from '@/utils/plannerTools'
import { recommendedPlans } from '@/utils/recommendedPlans'
import { SKILL_INFO } from '@/data/skillInfo'
import { findGoal, goalSlug } from '@/data/calculatorGoals'

export const PLANS_PATH = '/plans'
const HOURS = [2, 4]
const SKILL_SLUG = Object.fromEntries(SKILL_INFO.map((i) => [i.name, i.slug]))

// Which of the planner's ready-made plans get a page, and the words searchers use for them.
export const GUIDE_DEFS = [
  { slug: 'max-cape', planId: 'all-99', name: 'Max cape', h1: 'OSRS Max Cape Plan: 99 in Every Skill', q: 'get a max cape', short: 'Every skill to 99, quickest wins first.' },
  { slug: 'all-90s', planId: 'all-90', name: 'All 90s', h1: 'OSRS Plan: Every Skill to Level 90', q: 'get 90 in every skill', short: 'A strong mid-game account.' },
  { slug: 'all-80s', planId: 'all-80', name: 'All 80s', h1: 'OSRS Plan: Every Skill to Level 80', q: 'get 80 in every skill', short: 'The usual stopping point before the long grinds.' },
  { slug: 'all-70s', planId: 'all-70', name: 'All 70s', h1: 'OSRS Plan: Every Skill to Level 70', q: 'get 70 in every skill', short: 'A well-rounded account fast.' },
  { slug: 'combat-99s', planId: 'combat-99', name: 'Combat 99s', h1: 'OSRS Plan: All Combat Skills to 99', q: 'get 99 in every combat skill', short: 'Attack, Strength, Defence, Hitpoints, Ranged, Prayer and Magic.' },
  { slug: 'total-level-1500', planId: 'total-1500', name: 'Total level 1,500', h1: 'OSRS Plan: Total Level 1,500', q: 'reach total level 1,500', short: 'The cheapest levels first.' },
  { slug: 'total-level-2000', planId: 'total-2000', name: 'Total level 2,000', h1: 'OSRS Plan: Total Level 2,000', q: 'reach total level 2,000', short: 'The cheapest levels first.' },
  { slug: 'total-level-2200', planId: 'total-2200', name: 'Total level 2,200', h1: 'OSRS Plan: Total Level 2,200', q: 'reach total level 2,200', short: 'The cheapest levels first.' },
]
export const guideDef = (slug) => GUIDE_DEFS.find((g) => g.slug === String(slug || '').toLowerCase()) || null
export const guidePath = (slug) => `${PLANS_PATH}/${slug}`

const days = (hours, perDay) => Math.max(Math.ceil(hours / perDay), 1).toLocaleString('en-US')
const money = (gp) => formatGp(Math.abs(gp)).replace(/^[+-]/, '')

/**
 * Everything one plan page shows, or null when the plan does not apply to a new account or the catalog cannot plan all
 * of it (a page with a hole in its numbers is worse than no page).
 */
export function buildPlanGuide(def) {
  const plan = recommendedPlans(null).find((p) => p.id === def.planId)
  if (!plan || !plan.goals.length) return null
  const planned = plan.goals.map((goal) => ({ goal, p: planGoal(resolveGoal(goal, AUTO_FAST, DEFAULT_GP_VALUE)) }))
  if (planned.some(({ p }) => !p.complete || p.hours == null)) return null
  // Shortest training time first, so the plan starts with quick wins. The planner link uses the same order.
  planned.sort((a, b) => a.p.hours - b.p.hours)

  const totals = planTotals(planned.map((x) => x.p), HOURS[0])
  const skills = planned.map(({ goal, p }, i) => {
    const from = Math.min(levelAtXp(goal.currentXp), 99)
    const to = Math.min(levelAtXp(goal.targetXp), 99)
    const info = SKILL_INFO.find((s) => s.name === goal.skill)
    const dedicated = info && findGoal(info, goalSlug(from, to))
    return {
      order: i + 1,
      skill: goal.skill,
      from,
      to,
      xp: p.remainingXp,
      hours: p.hours,
      hoursText: formatHours(p.hours),
      gpText: p.netGp == null ? 'No GP data' : formatGp(p.netGp),
      calcPath: dedicated ? `/calculators/${info.slug}/${dedicated.slug}` : `/calculators/${SKILL_SLUG[goal.skill]}`,
    }
  })

  const longest = skills.reduce((a, b) => (b.hours > a.hours ? b : a))
  const first = skills[0]
  const gpPhrase = totals.netGp == null ? 'has no reliable gp figure' : Math.abs(totals.netGp) < 1000 ? 'is roughly break-even' : totals.netGp > 0 ? `makes about ${money(totals.netGp)}` : `costs about ${money(totals.netGp)}`
  const hoursText = formatHours(totals.totalHours)
  const label = def.name
  const title = `${def.h1} | TickGains`
  const description = `${label} in OSRS: ${formatNum(totals.totalXp)} XP and about ${hoursText} of training, roughly ${days(totals.totalHours, HOURS[0])} days at ${HOURS[0]} hours a day. Skill-by-skill plan, ready for the planner.`

  const faq = [
    { q: `How long does it take to ${def.q} in OSRS?`, a: `Starting from a new account, the fastest routes add up to about ${hoursText} of play. That is roughly ${days(totals.totalHours, HOURS[0])} days at ${HOURS[0]} hours a day, or ${days(totals.totalHours, HOURS[1])} days at ${HOURS[1]} hours a day. Gear, quests you already have and how closely you follow each method all change this.` },
    { q: `How much XP does it take to ${def.q}?`, a: `${formatNum(totals.totalXp)} XP across ${skills.length} skills, counting from level 1 (level 10 in Hitpoints). Enter your own username in the planner and it counts only what you still need.` },
    { q: `Which skill takes the longest?`, a: `${longest.skill}, at about ${longest.hoursText} on the fastest route from level ${longest.from} to ${longest.to}. ${first.skill} is the quickest win and comes first in the plan.` },
    { q: `How much does it cost to ${def.q}?`, a: `Training everything on the fastest routes ${gpPhrase} in total, an estimate from typical prices and rates, net of supplies and loot. The cheapest routes change that a lot, and the planner can compare them.` },
  ]

  // The planner link: the whole plan in the address, the same format Share makes, so it opens as a plan to adopt and
  // recalculates from the visitor's own stats once they enter a username.
  const params = encodePlan({ hoursPerDay: HOURS[0], goals: planned.map((x) => x.goal) })
  params.set('from', 'share')

  return {
    slug: def.slug,
    name: def.name,
    path: guidePath(def.slug),
    planId: def.planId,
    h1: def.h1,
    title,
    description,
    lead: `${formatNum(totals.totalXp)} XP and about ${hoursText} of training separate a new account from this goal on the fastest routes. Here is every skill in the order to train it, and the plan ready to open in the planner.`,
    summary: `The ${label.toLowerCase()} plan needs ${formatNum(totals.totalXp)} XP and about ${hoursText} on the fastest routes, roughly ${days(totals.totalHours, HOURS[0])} days at ${HOURS[0]} hours a day.`,
    totalXp: totals.totalXp,
    totalHours: totals.totalHours,
    hoursText,
    daysAt: HOURS.map((h) => ({ hoursPerDay: h, days: days(totals.totalHours, h) })),
    gpText: totals.netGp == null ? 'No GP data' : formatGp(totals.netGp),
    skillCount: skills.length,
    skills,
    faq,
    plannerHref: `/planner/new?${params.toString()}`,
    short: def.short,
  }
}

/** Every plan page the site serves, for the build to write out and the sitemap to list. */
export function allPlanGuides() {
  return GUIDE_DEFS.map(buildPlanGuide).filter(Boolean)
}
