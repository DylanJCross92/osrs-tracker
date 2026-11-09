// Item materials for item-based training methods, keyed by method id. Methods that only gather
// (Mining, Woodcutting, Fishing, ...) or run minigames have no materials and are simply left out.
//
// Each entry lists the items you can train with. For every level the planner picks the highest-xp
// item you can use at that level and works out how many are needed to cover that level's xp:
//   name   item name, also used to load its icon from the OSRS Wiki
//   level  minimum skill level for this item
//   xp     xp gained per action (per item crafted, cooked, burned, built, buried, ...)
//   qty    how many of `name` one action uses up (default 1)
//   extra  other items one action uses up: [{ name, qty }]
// Quantities assume no burns, failures or lost items.

const item = (name, level, xp, qty = 1, extra = []) => ({ name, level, xp, qty, extra })
const x = (name, qty = 1) => ({ name, qty })

const LOGS = [
  item('Logs', 1, 40),
  item('Oak logs', 15, 60),
  item('Willow logs', 30, 90),
  item('Teak logs', 35, 105),
  item('Arctic pine logs', 42, 125),
  item('Maple logs', 45, 135),
  item('Mahogany logs', 50, 157.5),
  item('Yew logs', 60, 202.5),
  item('Magic logs', 75, 303.8),
  item('Redwood logs', 90, 350),
]

const arrows = (tip, xp, level) => [item(tip, level, xp, 1, [x('Headless arrow')])]
const potion = (unf, level, xp, secondary) => item(unf, level, xp, 1, [x(secondary)])

export const MATERIALS = {
  // --- Firemaking (xp per log burned) ---
  'firemaking-campfire': LOGS,
  'firemaking-logs': LOGS,
  'firemaking-burn-30': LOGS,
  'firemaking-burn-45': LOGS,
  'firemaking-burn-75': LOGS,
  'firemaking-burn-90': LOGS,

  // --- Prayer (xp per bone, with the method's altar multiplier) ---
  'prayer-ectofuntus': [item('Big bones', 1, 60, 1, [x('Bucket of slime')])],
  'prayer-chaos': [item('Big bones', 1, 52.5, 0.5)],
  'prayer-dragon': [item('Dragon bones', 1, 252)],
  'prayer-superior': [item('Superior dragon bones', 70, 525)],
  'prayer-chaos-dragon': [item('Dragon bones', 1, 252, 0.5)],
  'prayer-wildy-altar': [item('Dragon bones', 1, 252)],

  // --- Cooking (xp per fish cooked) ---
  'cooking-early': [
    item('Raw shrimps', 1, 30),
    item('Raw sardine', 1, 40),
    item('Raw herring', 5, 50),
    item('Raw mackerel', 10, 60),
    item('Raw trout', 15, 70),
    item('Raw pike', 20, 80),
    item('Raw salmon', 25, 90),
  ],
  'cooking-swordfish': [item('Raw lobster', 40, 120), item('Raw swordfish', 45, 140)],
  'cooking-monkfish': [item('Raw monkfish', 62, 150)],
  'cooking-sharks': [item('Raw shark', 80, 210)],
  'cooking-anglerfish': [item('Raw anglerfish', 84, 230)],
  'cooking-manta': [item('Raw manta ray', 91, 216)],
  'cooking-karambwan': [item('Raw karambwan', 30, 190)],
  'cooking-karambwan-1t': [item('Raw karambwan', 30, 190)],
  'cooking-wines': [item('Grapes', 35, 200, 1, [x('Jug of water')])],

  // --- Construction (xp per piece built, planks per piece) ---
  'construction-oak-larders': [item('Oak plank', 33, 480, 8)],
  'construction-mythical-capes': [item('Teak plank', 50, 370, 3)],
  'construction-mahogany-tables': [item('Mahogany plank', 52, 840, 6)],
  'construction-teak-benches': [item('Teak plank', 66, 540, 6)],
  'construction-oak-doors': [item('Oak plank', 74, 600, 10)],
  'construction-gnome-benches': [item('Mahogany plank', 77, 840, 6)],

  // --- Crafting ---
  'crafting-gems': [item('Uncut sapphire', 20, 50)],
  'crafting-emerald-cut': [item('Uncut emerald', 27, 67.5)],
  'crafting-ruby-cut': [item('Uncut ruby', 34, 85)],
  'crafting-diamond-cut': [item('Uncut diamond', 43, 107.5)],
  'crafting-dragonstone-cut': [item('Uncut dragonstone', 55, 137.5)],
  'crafting-glassblowing': [item('Molten glass', 46, 52.5), item('Molten glass', 49, 55)],
  'crafting-light-orbs': [item('Molten glass', 87, 70)],
  'crafting-battlestaves': [
    item('Water orb', 54, 100, 1, [x('Battlestaff')]),
    item('Earth orb', 58, 112.5, 1, [x('Battlestaff')]),
    item('Fire orb', 62, 125, 1, [x('Battlestaff')]),
    item('Air orb', 66, 137.5, 1, [x('Battlestaff')]),
  ],
  'crafting-dhide': [item('Green dragon leather', 63, 186, 3)],
  'crafting-blue-dhide': [item('Blue dragon leather', 71, 210, 3)],
  'crafting-red-dhide': [item('Red dragon leather', 77, 234, 3)],
  'crafting-black-dhide': [item('Black dragon leather', 84, 258, 3)],

  // --- Fletching (xp per arrow made) ---
  'fletching-arrows': arrows('Bronze arrowtips', 1.3, 1),
  'fletching-iron-arrows': arrows('Iron arrowtips', 2.5, 15),
  'fletching-steel-arrows': arrows('Steel arrowtips', 5, 30),
  'fletching-mithril-arrows': arrows('Mithril arrowtips', 7.5, 45),
  'fletching-adamant-arrows': arrows('Adamant arrowtips', 10, 60),
  'fletching-rune-arrows': arrows('Rune arrowtips', 12.5, 75),
  'fletching-dragon-arrows': arrows('Dragon arrowtips', 15, 90),
  'fletching-redwood-shields': [item('Redwood logs', 92, 216, 2)],

  // --- Herblore (xp per potion made from an unfinished potion plus its secondary) ---
  'herblore-early': [
    potion('Guam potion (unf)', 3, 25, 'Eye of newt'),
    potion('Marrentill potion (unf)', 5, 37.5, 'Unicorn horn dust'),
    potion('Tarromin potion (unf)', 12, 50, 'Limpwurt root'),
    potion('Harralander potion (unf)', 22, 62.5, "Red spiders' eggs"),
    potion('Harralander potion (unf)', 26, 67.5, 'Chocolate dust'),
    potion('Harralander potion (unf)', 36, 84, 'Goat horn dust'),
  ],
  'herblore-prayer-pots': [potion('Ranarr potion (unf)', 38, 87.5, 'Snape grass')],
  'herblore-unf-finish': [
    potion('Irit potion (unf)', 45, 100, 'Eye of newt'),
    potion('Avantoe potion (unf)', 52, 117.5, 'Mort myre fungus'),
    potion('Kwuarm potion (unf)', 55, 125, 'Limpwurt root'),
  ],
  'herblore-super-restore': [potion('Snapdragon potion (unf)', 63, 142.5, "Red spiders' eggs"), potion('Cadantine potion (unf)', 66, 150, 'White berries')],
  'herblore-antifire': [potion('Lantadyme potion (unf)', 69, 157.5, 'Dragon scale dust')],
  'herblore-ranging': [potion('Dwarf weed potion (unf)', 72, 162.5, 'Wine of zamorak')],
  'herblore-magic-pots': [potion('Lantadyme potion (unf)', 76, 172.5, 'Potato cactus')],
  'herblore-sara-brew': [potion('Toadflax potion (unf)', 81, 180, 'Crushed nest')],
  'herblore-menaphite': [potion('Dwarf weed potion (unf)', 88, 200, 'Lily of the sands')],
  'herblore-armadyl-brew': [potion('Umbral potion (unf)', 89, 205, 'Rainbow crab paste')],

  // --- Smithing ---
  'smithing-blast-iron': [item('Iron ore', 15, 12.5)],
  'smithing-blast-furnace': [item('Iron ore', 30, 17.5, 1, [x('Coal')]), item('Mithril ore', 50, 30, 1, [x('Coal', 2)])],
  'smithing-blast-gold': [item('Gold ore', 40, 56.2)],
  'smithing-blast-adamant': [item('Adamantite ore', 70, 37.5, 1, [x('Coal', 3)])],
  'smithing-blast-runite': [item('Runite ore', 85, 50, 1, [x('Coal', 4)])],
  'smithing-cannonballs': [item('Steel bar', 35, 25.6)],
  'smithing-platebodies': [item('Steel bar', 48, 187.5, 5)],
  'smithing-mithril-platebodies': [item('Mithril bar', 68, 250, 5)],
  'smithing-adamant-platebodies': [item('Adamantite bar', 88, 312.5, 5)],

  // --- Runecraft (xp per essence crafted) ---
  'runecraft-early': [
    item('Rune essence', 1, 5),
    item('Rune essence', 2, 5.5),
    item('Rune essence', 5, 6),
    item('Rune essence', 9, 6.5),
    item('Rune essence', 14, 7),
    item('Rune essence', 20, 7.5),
  ],
  'runecraft-nature': [item('Pure essence', 44, 9)],
}

/** Wiki icon URL for an item name. */
export const itemIconUrl = (name) => `https://oldschool.runescape.wiki/images/${encodeURI(name.replace(/ /g, '_'))}.png`
