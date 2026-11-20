// What a method uses up and what it makes, so its gp an hour can be worked out from live Grand Exchange prices (see utils/methodPricing.js)
// instead of a figure typed in once. For a method listed here:
//   xpPerAction   the xp one action gives (one log chopped, one bone offered, one gem cut)
//   inputs        item names and how many one action uses up, bought at the current price
//   outputs       item names and how many one action makes, sold at the current price after the Grand Exchange tax
// Actions an hour come from the method's xpPerHour in trainingMethods.js, so the two stay in step. Every item name is a Grand Exchange
// item name (the site checks them against the wiki's item list; see scripts/check-item-names.js). A method not listed here, or one with
// an item that has no price, keeps the gpPerHour typed in trainingMethods.js.
const one = (name, qty = 1) => [name, qty]

export const ECONOMY = {
  // Bones offered at an altar: every one is used up.
  'prayer-dragon': { xpPerAction: 252, inputs: [one('Dragon bones')], note: 'Dragon bones at a Gilded Altar give 3.5 times their xp.' },
  'prayer-superior': { xpPerAction: 525, inputs: [one('Superior dragon bones')], note: 'Superior dragon bones at a Gilded Altar give 3.5 times their xp.' },
  'prayer-wildy-altar': { xpPerAction: 288, inputs: [one('Dragon bones')], note: 'The Wilderness altar gives 4 times the bones\' xp.' },

  // Gathering: what you collect is sold.
  'woodcutting-oak': { xpPerAction: 37.5, outputs: [one('Oak logs')] },
  'woodcutting-willow': { xpPerAction: 67.5, outputs: [one('Willow logs')] },
  'woodcutting-maple': { xpPerAction: 100, outputs: [one('Maple logs')] },
  'woodcutting-yew': { xpPerAction: 175, outputs: [one('Yew logs')] },
  'woodcutting-magic': { xpPerAction: 250, outputs: [one('Magic logs')] },
  'woodcutting-mahogany': { xpPerAction: 125, outputs: [one('Mahogany logs')] },
  'woodcutting-redwood': { xpPerAction: 380, outputs: [one('Redwood logs')] },
  'woodcutting-arctic-pine': { xpPerAction: 40, outputs: [one('Arctic pine logs')] },
  'fishing-sharks': { xpPerAction: 110, outputs: [one('Raw shark')] },
  'fishing-monkfish': { xpPerAction: 120, outputs: [one('Raw monkfish')] },
  'fishing-karambwan': { xpPerAction: 50, outputs: [one('Raw karambwan')] },
  'mining-amethyst': { xpPerAction: 240, outputs: [one('Amethyst')] },

  // Cooking: raw fish bought, cooked fish sold.
  'cooking-karambwan': { xpPerAction: 190, inputs: [one('Raw karambwan')], outputs: [one('Cooked karambwan')] },
  'cooking-sharks': { xpPerAction: 210, inputs: [one('Raw shark')], outputs: [one('Shark')] },
  'cooking-anglerfish': { xpPerAction: 230, inputs: [one('Raw anglerfish')], outputs: [one('Anglerfish')] },
  'cooking-manta': { xpPerAction: 216, inputs: [one('Raw manta ray')], outputs: [one('Manta ray')] },
  'cooking-monkfish': { xpPerAction: 150, inputs: [one('Raw monkfish')], outputs: [one('Monkfish')] },

  // Gem cutting: uncut gems bought, cut gems sold.
  'crafting-gems': { xpPerAction: 50, inputs: [one('Uncut sapphire')], outputs: [one('Sapphire')] },
  'crafting-emerald-cut': { xpPerAction: 67.5, inputs: [one('Uncut emerald')], outputs: [one('Emerald')] },
  'crafting-ruby-cut': { xpPerAction: 85, inputs: [one('Uncut ruby')], outputs: [one('Ruby')] },
  'crafting-diamond-cut': { xpPerAction: 107.5, inputs: [one('Uncut diamond')], outputs: [one('Diamond')] },
  'crafting-dragonstone-cut': { xpPerAction: 137.5, inputs: [one('Uncut dragonstone')], outputs: [one('Dragonstone')] },

  // Magic: runes used up with each cast.
  'magic-camelot-tele': { xpPerAction: 55.5, inputs: [one('Law rune')], note: 'With a staff of air only the law rune is paid for.' },
}

/** Every item name the economy uses (what to ask the server to price). */
export const ECONOMY_ITEMS = [...new Set(Object.values(ECONOMY).flatMap((e) => [...(e.inputs || []), ...(e.outputs || [])].map(([name]) => name)))]
