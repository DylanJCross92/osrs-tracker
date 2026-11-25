// The kinds of account a person can plan for. A build says which skills the account must keep low, so the planner never trains or recommends
// anything that would break it; an ironman kind says how careful the routes have to be. Plain data, used by utils/builds.js.
//
//   caps         the highest level each skill may reach (a skill not listed has no limit). A skill capped at its starting level (1, or 10 for
//                Hitpoints) is "locked": it is never trained and its goals are not offered.
//   noFights     the account cannot fight, so quests that need a fight, and methods that need such a quest or a combat level, are left out
//   blurb/effects what the choice does, in the words the setup screen shows
//
// Limits follow what players mean by each name: a level 3 skiller keeps Hitpoints at 10 and every other combat skill and Slayer at 1; a 1 Defence
// pure never trains Defence and stops Prayer at 52 (the usual pure's Smite); a zerker stops Defence at 45 and Prayer at 52.
export const BUILDS = [
  {
    key: 'main',
    label: 'Any build',
    short: 'Main',
    blurb: 'No limits. Every skill can be trained to 99.',
    effects: [],
    caps: {},
  },
  {
    key: 'skiller',
    label: 'Level 3 skiller',
    short: 'Level 3 skiller',
    noun: 'skiller',
    blurb: 'Combat level 3: Hitpoints stays at 10 and every other combat skill, with Slayer, stays at 1.',
    effects: ['Combat skills and Slayer are locked', 'Methods and quests that need a fight or a combat level are left out', 'The max total counts only the skills a skiller trains'],
    caps: { Attack: 1, Strength: 1, Defence: 1, Ranged: 1, Prayer: 1, Magic: 1, Slayer: 1, Hitpoints: 10 },
    noFights: true,
    // How a ready-made plan words itself for this build (utils/recommendedPlans.js).
    planNote: 'Combat skills and Slayer stay locked.',
    maxTitle: 'Max your skiller: every skill to 99',
    combatTitle: 'Combat skills',
    combatText: 'A level 3 skiller keeps every combat skill locked, so there is no combat plan.',
  },
  {
    key: 'pure',
    label: '1 Defence pure',
    short: '1 Defence pure',
    noun: 'pure',
    blurb: 'Defence stays at 1, and Prayer stops at 52. Attack, Strength, Ranged and Magic train as far as you like.',
    effects: ['Defence is locked at 1 and Prayer stops at 52', 'Quests that give Defence experience are left out', 'Methods that need more than 1 Defence are left out'],
    caps: { Defence: 1, Prayer: 52 },
    planNote: 'Defence stays at 1 and Prayer stops at 52.',
    maxTitle: 'Max your pure: every skill to 99',
    combatTitle: 'Pure combat skills',
    combatText: 'Attack, Strength, Hitpoints, Ranged and Magic to 99 and Prayer to 52. Defence stays at 1.',
  },
  {
    key: 'zerker',
    label: 'Zerker (45 Defence)',
    short: 'Zerker',
    noun: 'zerker',
    blurb: 'Defence stops at 45 and Prayer at 52. The other combat skills train as normal.',
    effects: ['Defence stops at 45 and Prayer at 52', 'Quests whose Defence reward goes past 45 are left out', 'Methods that need more than 45 Defence are left out'],
    caps: { Defence: 45, Prayer: 52 },
    planNote: 'Defence stops at 45 and Prayer at 52.',
    maxTitle: 'Max your zerker: every skill to 99',
    combatTitle: 'Zerker combat skills',
    combatText: 'Attack, Strength, Hitpoints, Ranged and Magic to 99, Defence to 45 and Prayer to 52.',
  },
]

// What kind of ironman, when the account is one. Only Hardcore changes the routes (it cannot risk dying); the others are noted so the plan says
// who it is for: an Ultimate ironman has no bank, so a plan's shopping list cannot be stocked up in advance.
export const IRON_KINDS = [
  { key: 'standard', label: 'Ironman', blurb: 'No trading or Grand Exchange.' },
  { key: 'hardcore', label: 'Hardcore ironman', blurb: 'One life: the plan leaves out Wilderness and other risky methods.' },
  { key: 'ultimate', label: 'Ultimate ironman', blurb: 'No bank: supplies lists cannot be stocked up in advance.' },
  { key: 'group', label: 'Group ironman', blurb: 'Like an ironman; the plan is for your own account.' },
]

export const buildOf = (key) => BUILDS.find((b) => b.key === key) || BUILDS[0]
export const cleanBuild = (value) => (BUILDS.some((b) => b.key === value) ? value : 'main')
export const cleanIronKind = (value) => (IRON_KINDS.some((k) => k.key === value) ? value : 'standard')
export const ironKindOf = (key) => IRON_KINDS.find((k) => k.key === key) || IRON_KINDS[0]
