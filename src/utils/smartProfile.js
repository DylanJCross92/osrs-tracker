import { AUTO_BALANCED, AUTO_CHEAP, AUTO_FAST } from '@/utils/planner'

// The answers to the Smart Planner's questions and what they are allowed to be. Kept apart from the planning (utils/smartPlanner.js) so the saved
// plans and the account data can check answers without pulling the planner in.
// Answers (the "profile"): { members, goal, hours, gp, experience, iron }.

export const GOALS = [
  { key: 'skills', label: 'Max my skills', hint: 'Bring every skill up, tier by tier' },
  { key: 'money', label: 'Make money', hint: 'The levels that unlock better gp per hour' },
  { key: 'combat', label: 'Combat and bossing', hint: 'The levels behind each tier of gear and prayers' },
  { key: 'quests', label: 'Quests and unlocks', hint: 'Quest shortcuts first, then the levels they lead to' },
  { key: 'afk', label: 'AFK training', hint: 'Relaxed methods you can leave running with little attention' },
  { key: 'hardcore', label: 'Hardcore skilling', hint: 'The fastest hands-on methods: Runecraft, Agility, Mining and more' },
]
export const EXPERIENCE = [
  { key: 'new', label: 'New', hint: 'Small steps first' },
  { key: 'returning', label: 'Returning', hint: 'Skip the basics' },
  { key: 'veteran', label: 'Veteran', hint: 'Go for the big levels' },
]
// Starting gp changes how the planner weighs time against gp: with little to spend it picks the cheapest routes, with plenty the fastest.
export const GP_LEVELS = [
  { key: 'low', label: 'Under 1M', strategy: AUTO_CHEAP, gpValue: 1_000_000, budget: 1_000_000 },
  { key: 'some', label: '1M to 10M', strategy: AUTO_BALANCED, gpValue: 2_000_000, budget: 10_000_000 },
  { key: 'good', label: '10M to 100M', strategy: AUTO_BALANCED, gpValue: 4_000_000, budget: 100_000_000 },
  { key: 'rich', label: '100M or more', strategy: AUTO_FAST, gpValue: 6_000_000, budget: null },
]

export const DEFAULT_PROFILE = { members: true, goal: 'skills', hours: 2, gp: 'low', experience: 'returning', iron: false }

/** Answers that are safe to use: anything unknown falls back to the default. */
export function cleanProfile(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const pick = (value, list, fallback) => (list.some((o) => o.key === value) ? value : fallback)
  const hours = Number(r.hours)
  return {
    members: typeof r.members === 'boolean' ? r.members : DEFAULT_PROFILE.members,
    goal: pick(r.goal, GOALS, DEFAULT_PROFILE.goal),
    hours: Number.isFinite(hours) ? Math.min(12, Math.max(0.5, Math.round(hours * 2) / 2)) : DEFAULT_PROFILE.hours,
    gp: pick(r.gp, GP_LEVELS, DEFAULT_PROFILE.gp),
    experience: pick(r.experience, EXPERIENCE, DEFAULT_PROFILE.experience),
    iron: typeof r.iron === 'boolean' ? r.iron : DEFAULT_PROFILE.iron,
  }
}


const label = (list, key) => list.find((x) => x.key === key)?.label || ''
/** The answers in a few words, for a line on the plan: "Members · Combat and bossing · 2 h a day · Veteran · Ironman". */
export function describeProfile(raw) {
  const p = cleanProfile(raw)
  return [p.members ? 'Members' : 'Free-to-play', label(GOALS, p.goal), `${p.hours} h a day`, label(EXPERIENCE, p.experience), p.iron ? 'Ironman' : null].filter(Boolean).join(' · ')
}
