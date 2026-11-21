// What a method uses up and what it makes, so its gp an hour can be worked out from live Grand Exchange prices (see utils/methodPricing.js)
// instead of a figure typed in once. For a method listed here:
//   xpPerAction   the xp one action gives (one log chopped, one bone offered, one gem cut)
//   inputs        item names and how many one action uses up, bought at the current price
//   outputs       item names and how many one action makes, sold at the current price after the Grand Exchange tax
// Actions an hour come from the method's xpPerHour in trainingMethods.js, so the two stay in step. Every item name is a Grand Exchange
// item name (the site checks them against the wiki's item list; see scripts/check-item-names.js). A method not listed here, or one with
// an item that has no price, keeps the gpPerHour typed in trainingMethods.js.
const one = (name, qty = 1) => [name, qty]
// What the Blast Furnace's coffer takes an hour on a themed world (see the wiki's Blast Furnace page).
const BLAST_FURNACE_FEE = { label: 'Blast Furnace coffer fee', gp: 72_000 }

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

  // Woodcutting and fishing that are sold as they come: the rarer logs and fish.
  'woodcutting-teak': { xpPerAction: 85, outputs: [one('Teak logs')] },
  'woodcutting-teak-2t': { xpPerAction: 85, outputs: [one('Teak logs')] },
  'woodcutting-teak-15t': { xpPerAction: 85, outputs: [one('Teak logs')] },
  'woodcutting-camphor': { xpPerAction: 143.5, outputs: [one('Camphor logs')] },
  'woodcutting-ironwood': { xpPerAction: 175, outputs: [one('Ironwood logs')] },
  'woodcutting-rosewood': { xpPerAction: 212.5, outputs: [one('Rosewood logs')] },
  'fishing-anglerfish': { xpPerAction: 120, outputs: [one('Raw anglerfish')] },
  'fishing-dark-crabs': { xpPerAction: 130, outputs: [one('Raw dark crab')] },
  'hunter-red-chins': { xpPerAction: 265, outputs: [one('Red chinchompa')] },
  'hunter-black-chins': { xpPerAction: 315, outputs: [one('Black chinchompa')] },

  // Cooking wine and burning logs.
  'cooking-wines': { xpPerAction: 200, inputs: [one('Grapes'), one('Jug of water')], outputs: [one('Jug of wine')] },
  'cooking-karambwan-1t': { xpPerAction: 190, inputs: [one('Raw karambwan')], outputs: [one('Cooked karambwan')] },
  'firemaking-burn-90': { xpPerAction: 350, inputs: [one('Redwood logs')] },

  // Smithing. At the Blast Furnace the coal is half what a normal furnace needs, the coke fuel is free, and a themed world's coffer
  // takes 72,000 gp an hour. The coal bag, the entrance fee and the stamina potions are not counted.
  'smithing-cannonballs': { xpPerAction: 25.5, inputs: [one('Steel bar')], outputs: [one('Steel cannonball', 4)], note: 'One steel bar makes 4 steel cannonballs.' },
  'smithing-blast-iron': { xpPerAction: 12.5, inputs: [one('Iron ore')], outputs: [one('Iron bar')], hourlyFee: BLAST_FURNACE_FEE },
  'smithing-blast-furnace': { xpPerAction: 17.5, inputs: [one('Iron ore'), one('Coal')], outputs: [one('Steel bar')], hourlyFee: BLAST_FURNACE_FEE },
  'smithing-blast-gold': { xpPerAction: 56.2, inputs: [one('Gold ore')], outputs: [one('Gold bar')], hourlyFee: BLAST_FURNACE_FEE, note: 'Needs goldsmith gauntlets for the extra xp.' },
  'smithing-blast-adamant': { xpPerAction: 37.5, inputs: [one('Adamantite ore'), one('Coal', 3)], outputs: [one('Adamantite bar')], hourlyFee: BLAST_FURNACE_FEE },
  'smithing-blast-runite': { xpPerAction: 50, inputs: [one('Runite ore'), one('Coal', 4)], outputs: [one('Runite bar')], hourlyFee: BLAST_FURNACE_FEE },
  // Platebodies at the anvil: five bars each.
  'smithing-platebodies': { xpPerAction: 187.5, inputs: [one('Steel bar', 5)], outputs: [one('Steel platebody')] },
  'smithing-mithril-platebodies': { xpPerAction: 250, inputs: [one('Mithril bar', 5)], outputs: [one('Mithril platebody')] },
  'smithing-adamant-platebodies': { xpPerAction: 312.5, inputs: [one('Adamantite bar', 5)], outputs: [one('Adamant platebody')] },

  // Herblore: the unfinished potion and the second ingredient bought, the finished potion sold.
  'herblore-prayer-pots': { xpPerAction: 87.5, inputs: [one('Ranarr potion (unf)'), one('Snape grass')], outputs: [one('Prayer potion(3)')] },
  'herblore-super-restore': { xpPerAction: 142.5, inputs: [one('Snapdragon potion (unf)'), one("Red spiders' eggs")], outputs: [one('Super restore(3)')] },
  'herblore-antifire': { xpPerAction: 157.5, inputs: [one('Lantadyme potion (unf)'), one('Dragon scale dust')], outputs: [one('Antifire potion(3)')] },
  'herblore-ranging': { xpPerAction: 162.5, inputs: [one('Dwarf weed potion (unf)'), one('Wine of zamorak')], outputs: [one('Ranging potion(3)')] },
  'herblore-magic-pots': { xpPerAction: 172.5, inputs: [one('Lantadyme potion (unf)'), one('Potato cactus')], outputs: [one('Magic potion(3)')] },
  'herblore-sara-brew': { xpPerAction: 180, inputs: [one('Toadflax potion (unf)'), one('Crushed nest')], outputs: [one('Saradomin brew(3)')] },
  'herblore-super-combat': { xpPerAction: 150, inputs: [one('Super attack(4)'), one('Super strength(4)'), one('Super defence(4)'), one('Torstol')], outputs: [one('Super combat potion(4)')] },

  // Crafting: dragonhide bodies from three leathers, and glassblowing orbs. Thread is not counted.
  'crafting-dhide': { xpPerAction: 186, inputs: [one('Green dragon leather', 3)], outputs: [one("Green d'hide body")] },
  'crafting-blue-dhide': { xpPerAction: 210, inputs: [one('Blue dragon leather', 3)], outputs: [one("Blue d'hide body")] },
  'crafting-red-dhide': { xpPerAction: 234, inputs: [one('Red dragon leather', 3)], outputs: [one("Red d'hide body")] },
  'crafting-black-dhide': { xpPerAction: 258, inputs: [one('Black dragon leather', 3)], outputs: [one("Black d'hide body")] },
  'crafting-glassblowing': { xpPerAction: 52.5, inputs: [one('Molten glass')], outputs: [one('Unpowered orb')], note: 'Unpowered orbs, the best glass item to blow.' },

  // Construction: planks bought and built into furniture that is then removed, so the planks are all that is used up.
  'construction-mahogany-tables': { xpPerAction: 840, inputs: [one('Mahogany plank', 6)] },
  'construction-oak-doors': { xpPerAction: 600, inputs: [one('Oak plank', 10)] },

  // Magic: Tan Leather tans five hides a cast.
  'magic-tan-leather': { xpPerAction: 81, inputs: [one('Nature rune'), one('Astral rune', 2), one('Green dragonhide', 5)], outputs: [one('Green dragon leather', 5)], note: 'With a staff of fire for the fire runes. Green dragonhide shown; other hides pay differently.' },

  // Runecraft: essence bought, runes sold. Runes made twice for every essence at the higher levels are noted in the method name.
  'runecraft-nature': { xpPerAction: 9, inputs: [one('Pure essence')], outputs: [one('Nature rune')] },
  'runecraft-nature-double': { xpPerAction: 9, inputs: [one('Pure essence')], outputs: [one('Nature rune', 2)] },
  'runecraft-cosmic-double': { xpPerAction: 8, inputs: [one('Pure essence')], outputs: [one('Cosmic rune', 2)] },
  'runecraft-astral-double': { xpPerAction: 8.7, inputs: [one('Pure essence')], outputs: [one('Astral rune', 2)] },
  'runecraft-law-double': { xpPerAction: 9.5, inputs: [one('Pure essence')], outputs: [one('Law rune', 2)] },
  'runecraft-wrath': { xpPerAction: 8, inputs: [one('Pure essence')], outputs: [one('Wrath rune')] },
}

/** Every item name the economy uses (what to ask the server to price). */
export const ECONOMY_ITEMS = [...new Set(Object.values(ECONOMY).flatMap((e) => [...(e.inputs || []), ...(e.outputs || [])].map(([name]) => name)))]
