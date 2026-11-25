// What the Smart Planner (utils/smartPlanner.js) recommends from: which skills and training methods a free-to-play player has, the level
// tiers a player works through, and the combat ladder. Kept small on purpose, and only what could be checked against the OSRS Wiki.

// The 15 skills free-to-play players can train (the Wiki's Free-to-play page).
export const F2P_SKILLS = ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Prayer', 'Magic', 'Runecraft', 'Mining', 'Smithing', 'Crafting', 'Fishing', 'Cooking', 'Firemaking', 'Woodcutting']

// Training methods (ids from data/trainingMethods.js) a free-to-play player can use, from the Wiki's free-to-play training guides. Only the ones
// the guides clearly show are listed; anything else counts as members-only, so a route never sends a free player somewhere they cannot go.
// The catalogue has no free-to-play melee or Ranged method yet, so those skills are left out of free-to-play recommendations for now.
export const F2P_METHOD_IDS = new Set([
  'magic-splash', 'magic-enchant-jewellery-1', 'magic-enchant-jewellery-2', 'magic-low-alch', 'magic-alch',
  'cooking-early', 'cooking-pizza', 'cooking-wines',
  'woodcutting-early', 'woodcutting-oak', 'woodcutting-willow', 'woodcutting-yew',
  'fishing-early', 'fishing-fly', 'fishing-lobster',
  'firemaking-logs', 'firemaking-burn-30', 'firemaking-burn-45',
  'crafting-early', 'crafting-gems', 'crafting-emerald-cut', 'crafting-ruby-cut', 'crafting-diamond-cut',
  'smithing-early', 'smithing-iron-platebodies', 'smithing-platebodies', 'smithing-mithril-platebodies', 'smithing-adamant-platebodies',
  'mining-early', 'mining-iron', 'mining-guild-iron',
  'runecraft-early', 'runecraft-tiaras',
  'prayer-bones-ashes', 'prayer-boneyard',
  // Free-to-play combat (see the note in data/trainingMethods.js)
  ...['attack', 'strength', 'defence'].flatMap((skill) => ['cows', 'frogs', 'frogs-high', 'moss-giants', 'moss-giants-high', 'brutus', 'brutus-mid', 'brutus-high'].map((id) => `${skill}-${id}`)),
  ...['cows', 'frogs', 'frogs-high', 'moss-giants', 'moss-giants-high', 'brutus', 'brutus-mid', 'brutus-high'].map((id) => `hitpoints-f2p-${id}`),
  'ranged-f2p-early', 'ranged-f2p-frogs', 'ranged-f2p-brutus', 'ranged-f2p-moss-giants',
  'hitpoints-f2p-ranged-early', 'hitpoints-f2p-ranged-frogs', 'hitpoints-f2p-ranged-brutus', 'hitpoints-f2p-ranged-moss-giants',
])

// "Bring everything up to N": the levels a player works through. With stats to go on, the planner picks the first of these that still has
// several skills below it; with none (no name), how experienced the player says they are decides where to start.
export const LEVEL_STEPS = [30, 40, 50, 60, 70, 80, 90, 99]
export const START_LEVEL = { new: 30, returning: 50, veteran: 70 }

// The combat ladder: the levels that open up the next tier of gear and prayers. `members` steps are hidden from free-to-play players.
// Checked against the OSRS Wiki's pages (23 Nov 2026): rune scimitar 40 Attack, dragon scimitar 60 Attack (and Monkey Madness I), dragon chainbody
// 60 Defence, Protect from Melee 43 Prayer, rune crossbow 61 Ranged, abyssal whip 70 Attack, black d'hide body 70 Ranged (and 40 Defence), Piety 70
// Prayer and 70 Defence, abyssal tentacle 75 Attack, toxic blowpipe 75 Ranged. Barrows armour at 70 Defence is from the same guides, not re-read.
export const COMBAT_TIERS = [
  {
    level: 40,
    title: 'Rune tier',
    goals: [
      { skill: 'Attack', level: 40, why: 'Wield rune weapons.', members: false },
      { skill: 'Strength', level: 40, why: 'Hit harder with everything you wield.', members: false },
      { skill: 'Defence', level: 40, why: 'Wear rune armour.', members: false },
    ],
  },
  {
    level: 60,
    title: 'Dragon tier',
    goals: [
      { skill: 'Attack', level: 60, why: 'Wield dragon weapons (the dragon scimitar also needs Monkey Madness I).', members: true },
      { skill: 'Strength', level: 60, why: 'Hit harder with everything you wield.', members: true },
      { skill: 'Defence', level: 60, why: 'Wear dragon armour.', members: true },
      { skill: 'Prayer', level: 43, why: 'Protect from Melee.', members: true },
      { skill: 'Ranged', level: 61, why: 'Use a rune crossbow.', members: true },
    ],
  },
  {
    level: 70,
    title: 'Barrows tier',
    goals: [
      { skill: 'Attack', level: 70, why: 'Wield an abyssal whip and Barrows weapons.', members: true },
      { skill: 'Strength', level: 70, why: 'Hit harder with everything you wield.', members: true },
      { skill: 'Defence', level: 70, why: 'Wear Barrows armour.', members: true },
      { skill: 'Prayer', level: 70, why: 'Unlock Piety, with 70 Defence (and the Knight Waves Training Ground miniquest).', members: true },
      { skill: 'Ranged', level: 70, why: 'Wear black dragonhide armour (with 40 Defence).', members: true },
    ],
  },
  {
    level: 75,
    title: 'Endgame weapons',
    goals: [
      { skill: 'Attack', level: 75, why: 'Wield an abyssal tentacle.', members: true },
      { skill: 'Ranged', level: 75, why: 'Use a toxic blowpipe.', members: true },
    ],
  },
  {
    level: 99,
    title: 'Max your combat',
    why: 'Higher combat levels hit harder, hit more often and survive longer at every boss.',
    goals: ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Prayer', 'Magic'].map((skill) => ({ skill, level: 99, why: '', members: false })),
  },
]
