// Which skill helps another, for the planner's suggested training order (see utils/smartOrder.js). Each entry says training `from` first
// makes `to` cheaper or faster, and when that is true:
//   toMin           the level the plan takes `to` up to has to reach this, or the help is not used
//   fromEnough      once `from` is already at this level there is nothing to gain by training it first
//   fromTargetMin   (optional) `from` has to be taken up to at least this level for the help to exist
//   w               how much it matters, from 1 (a small help) to 5 (a big one)
//   why             the reason shown to the player, in plain words
export const SYNERGIES = [
  { from: 'Fishing', to: 'Cooking', toMin: 30, fromEnough: 76, w: 5, why: 'Cooking can use the fish you catch, so the raw fish cost nothing.' },
  { from: 'Woodcutting', to: 'Firemaking', toMin: 30, fromEnough: 60, w: 4, why: 'Firemaking can burn the logs you chop.' },
  { from: 'Woodcutting', to: 'Fletching', toMin: 20, fromEnough: 60, w: 4, why: 'Fletching needs logs, and chopping your own saves buying them.' },
  { from: 'Mining', to: 'Smithing', toMin: 15, fromEnough: 70, w: 5, why: 'Smithing needs ore and coal, and mining your own saves buying them.' },
  { from: 'Mining', to: 'Crafting', toMin: 20, fromEnough: 40, w: 2, why: 'Gem rocks give the uncut gems that Crafting cuts.' },
  { from: 'Farming', to: 'Herblore', toMin: 30, fromEnough: 50, w: 4, why: 'Herb runs grow the herbs Herblore uses up.' },
  { from: 'Prayer', to: 'Attack', toMin: 60, fromEnough: 70, fromTargetMin: 70, w: 2, why: 'Piety (70 Prayer) boosts melee, so fights go faster.' },
  { from: 'Prayer', to: 'Strength', toMin: 60, fromEnough: 70, fromTargetMin: 70, w: 2, why: 'Piety (70 Prayer) boosts melee, so fights go faster.' },
  { from: 'Prayer', to: 'Defence', toMin: 60, fromEnough: 70, fromTargetMin: 70, w: 2, why: 'Piety (70 Prayer) boosts melee, so fights go faster.' },
  { from: 'Attack', to: 'Slayer', toMin: 30, fromEnough: 70, w: 2, why: 'Slayer tasks go faster with stronger combat stats.' },
  { from: 'Strength', to: 'Slayer', toMin: 30, fromEnough: 70, w: 2, why: 'Slayer tasks go faster with stronger combat stats.' },
  { from: 'Defence', to: 'Slayer', toMin: 30, fromEnough: 70, w: 2, why: 'Slayer tasks go faster with stronger combat stats.' },
  { from: 'Construction', to: 'Prayer', toMin: 70, fromEnough: 75, fromTargetMin: 75, w: 3, why: 'A gilded altar (75 Construction) makes Prayer training much faster.' },
  { from: 'Magic', to: 'Construction', toMin: 50, fromEnough: 86, fromTargetMin: 86, w: 2, why: 'Plank Make (86 Magic) turns logs into the planks Construction uses.' },
]
