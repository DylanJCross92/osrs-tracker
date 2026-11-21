// Which skill helps another, for the planner's suggested training order (see utils/smartOrder.js). Each entry says training `from` first
// makes `to` cheaper or faster, and when that is true:
//   toMin           the level the plan takes `to` up to has to reach this, or the help is not used
//   fromEnough      once `from` is already at this level there is nothing to gain by training it first
//   fromTargetMin   (optional) `from` has to be taken up to at least this level for the help to exist
//   w               how much it matters, from 1 (a small help) to 5 (a big one)
//   why             the reason shown to the player, a few words that follow "Before <skill>:"
export const SYNERGIES = [
  { from: 'Fishing', to: 'Cooking', toMin: 30, fromEnough: 76, w: 5, why: 'free raw fish' },
  { from: 'Woodcutting', to: 'Firemaking', toMin: 30, fromEnough: 60, w: 4, why: 'logs you chop yourself' },
  { from: 'Woodcutting', to: 'Fletching', toMin: 20, fromEnough: 60, w: 4, why: 'logs for bows, no buying' },
  { from: 'Mining', to: 'Smithing', toMin: 15, fromEnough: 70, w: 5, why: 'ore and coal, no buying' },
  { from: 'Mining', to: 'Crafting', toMin: 20, fromEnough: 40, w: 2, why: 'gems from gem rocks' },
  { from: 'Farming', to: 'Herblore', toMin: 30, fromEnough: 50, w: 4, why: 'herbs from your own runs' },
  { from: 'Prayer', to: 'Attack', toMin: 60, fromEnough: 70, fromTargetMin: 70, w: 2, why: 'Piety at 70 Prayer boosts melee' },
  { from: 'Prayer', to: 'Strength', toMin: 60, fromEnough: 70, fromTargetMin: 70, w: 2, why: 'Piety at 70 Prayer boosts melee' },
  { from: 'Prayer', to: 'Defence', toMin: 60, fromEnough: 70, fromTargetMin: 70, w: 2, why: 'Piety at 70 Prayer boosts melee' },
  { from: 'Attack', to: 'Slayer', toMin: 30, fromEnough: 70, w: 2, why: 'faster tasks with stronger combat' },
  { from: 'Strength', to: 'Slayer', toMin: 30, fromEnough: 70, w: 2, why: 'faster tasks with stronger combat' },
  { from: 'Defence', to: 'Slayer', toMin: 30, fromEnough: 70, w: 2, why: 'faster tasks with stronger combat' },
  { from: 'Construction', to: 'Prayer', toMin: 70, fromEnough: 75, fromTargetMin: 75, w: 3, why: 'a gilded altar at 75 Construction' },
  { from: 'Magic', to: 'Construction', toMin: 50, fromEnough: 86, fromTargetMin: 86, w: 2, why: 'Plank Make at 86 Magic' },
]
