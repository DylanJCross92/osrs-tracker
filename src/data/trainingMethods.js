// Version-controlled training-method catalog for the Account Planner.
//
// Every number here is a deliberately rounded, community-ballpark figure —
// real rates swing with gear, boosts, quests, and how efficiently you play —
// so the planner always labels them "approximate". gpPerHour is NET gp/hr
// (negative = a cost) or null when there is no trustworthy figure, in which
// case the UI says "no GP data" rather than showing 0.
//
// Shape: { id, skill, name, description, minLevel, maxLevel|null,
//          xpPerHour, gpPerHour|null, intensity, requirements }
// intensity: 'AFK' | 'Low' | 'Medium' | 'High'
// A method only contributes xp between xpForLevel(minLevel) and
// xpForLevel(maxLevel + 1) — see planner.js's planGoal().

const m = (skill, id, name, minLevel, xpPerHour, gpPerHour, intensity, description, requirements = '', maxLevel = null, fastest = false) => ({
  id: `${skill.toLowerCase()}-${id}`,
  skill,
  name,
  description,
  minLevel,
  maxLevel,
  xpPerHour,
  gpPerHour,
  intensity,
  requirements,
  fastest,
})

export const TRAINING_METHODS = [
  // --- Combat ---
  m('Attack', 'crabs', 'Rock / Ammonite Crabs', 1, 35000, 0, 'AFK', 'Fight low-defence crabs for long, low-effort stretches.', '', 69),
  m('Attack', 'sand-crabs', 'Sand Crabs', 40, 40000, 0, 'AFK', 'AFK crabs in Zeah with a very reliable reset.', 'Zeah access', 79),
  m('Attack', 'nmz', 'Nightmare Zone (absorptions)', 60, 50000, -250000, 'Low', 'Fight bosses in NMZ with absorption potions.', 'Quest points for NMZ access', null, true),
  m('Attack', 'slayer', 'Slayer tasks', 50, 40000, 300000, 'Medium', 'Combat xp plus task loot that usually covers supplies.', 'Slayer Master access'),
  m('Strength', 'crabs', 'Rock / Ammonite Crabs', 1, 35000, 0, 'AFK', 'Fight low-defence crabs for long, low-effort stretches.', '', 69),
  m('Strength', 'sand-crabs', 'Sand Crabs', 40, 40000, 0, 'AFK', 'AFK crabs in Zeah with a very reliable reset.', 'Zeah access', 79),
  m('Strength', 'nmz', 'Nightmare Zone (absorptions)', 60, 50000, -250000, 'Low', 'Fight bosses in NMZ with absorption potions.', 'Quest points for NMZ access', null, true),
  m('Strength', 'slayer', 'Slayer tasks', 50, 40000, 300000, 'Medium', 'Combat xp plus task loot that usually covers supplies.', 'Slayer Master access'),
  m('Defence', 'crabs', 'Rock / Ammonite Crabs', 1, 35000, 0, 'AFK', 'Fight low-defence crabs on a defensive combat style.', '', 69),
  m('Defence', 'sand-crabs', 'Sand Crabs', 40, 40000, 0, 'AFK', 'AFK crabs in Zeah on a defensive style.', 'Zeah access', 79),
  m('Defence', 'nmz', 'Nightmare Zone (absorptions)', 60, 50000, -250000, 'Low', 'Fight bosses in NMZ with absorption potions.', 'Quest points for NMZ access', null, true),
  m('Defence', 'slayer', 'Slayer tasks', 50, 40000, 300000, 'Medium', 'Combat xp plus task loot that usually covers supplies.', 'Slayer Master access'),
  m('Hitpoints', 'combat', 'Any combat training', 1, 40000, null, 'Medium', 'Hitpoints xp comes automatically from every combat style.'),
  m('Hitpoints', 'barrage', 'Barrage on Slayer tasks', 94, 150000, null, 'High', 'Ice Barrage multi-target tasks give heavy Hitpoints xp.', 'Ancient Magicks, 94 Magic', null, true),
  m('Ranged', 'crabs', 'Rock / Ammonite Crabs', 1, 35000, -50000, 'AFK', 'Shoot low-defence crabs with a ranged weapon.', '', 54),
  m('Ranged', 'red-chins', 'Red chinchompas (multi-target)', 55, 350000, -1000000, 'High', 'Throw red chins at multi-target spots like Ape Atoll.', 'Chinchompas (Hunter or Grand Exchange)', 79),
  m('Ranged', 'black-chins', 'Black chinchompas (multi-target)', 80, 500000, -2000000, 'High', 'Fastest ranged xp: black chins at multi-target spots.', 'Chinchompas, 80 Ranged', null, true),
  m('Ranged', 'blowpipe-slayer', 'Toxic blowpipe on Slayer', 60, 60000, 300000, 'Medium', 'Reliable ranged xp from Slayer tasks.', 'Toxic blowpipe'),
  m('Prayer', 'ectofuntus', 'Ectofuntus', 1, 120000, -300000, 'Medium', 'Grind bones and worship at the Ectofuntus.', 'Ghosts Ahoy for easiest access'),
  m('Prayer', 'chaos', 'Big bones at the Chaos Altar', 43, 200000, -500000, 'Low', 'Offer bought bones at the Wilderness Chaos Altar (2.5x xp).', 'Wilderness access', 69),
  m('Prayer', 'dragon', 'Dragon bones at a Gilded Altar', 70, 650000, -3000000, 'Low', 'Offer dragon bones at a player-owned-house Gilded Altar.', 'Player-owned house with a Gilded Altar', null, true),
  m('Magic', 'splash', 'Splashing', 1, 30000, -50000, 'AFK', 'Cast combat spells at a monster that cannot hurt you.'),
  m('Magic', 'alch', 'High Alchemy', 55, 65000, -50000, 'Low', 'Alch items while doing something else; thin margins.'),
  m('Magic', 'burst', 'Ice Burst on Slayer tasks', 70, 130000, null, 'High', 'Multi-target bursting on stacked Slayer monsters.', 'Ancient Magicks'),
  m('Magic', 'barrage', 'Ice Barrage on Slayer tasks', 94, 250000, null, 'High', 'Fastest magic xp from multi-target Barrage.', 'Ancient Magicks, 94 Magic', null, true),

  // --- Gathering ---
  m('Woodcutting', 'willow', 'Willow trees', 30, 35000, 30000, 'AFK', 'Chop and bank, or drop, willow logs.', '', 59),
  m('Woodcutting', 'maple', 'Maple trees', 45, 40000, 40000, 'AFK', 'Maple trees at Seers’ Village.', '', 59),
  m('Woodcutting', 'teak', 'Teak trees', 35, 55000, 150000, 'Low', 'Fossil Island or Ape Atoll teak, banked or dropped.', '', 59),
  m('Woodcutting', 'yew', 'Yew trees', 60, 45000, 150000, 'AFK', 'Chop yew trees and sell the logs.', '', 89),
  m('Woodcutting', 'redwood', 'Redwood trees', 90, 70000, 400000, 'AFK', 'Redwood trees at the Woodcutting Guild.', 'Woodcutting Guild access', null, true),
  m('Fishing', 'fly', 'Fly fishing (trout / salmon)', 20, 40000, 20000, 'AFK', 'Barbarian Village fly fishing, close to a bank.', '', 49),
  m('Fishing', 'tempoross', 'Tempoross', 35, 50000, 100000, 'Medium', 'Skilling boss minigame with useful rewards.'),
  m('Fishing', 'sharks', 'Sharks / Monkfish', 50, 35000, 150000, 'AFK', 'Fishing Guild harpoon fishing; sharks sell consistently.', 'Fishing Guild access'),
  m('Fishing', 'barbarian', 'Barbarian fishing', 48, 65000, 0, 'High', 'Active leaping fish in Otto’s Grotto — faster than sharks but demanding.', 'Barbarian Training (Otto’s Grotto)', null, true),
  m('Fishing', 'anglerfish', 'Anglerfish', 82, 40000, 300000, 'AFK', 'Piscarilius anglerfish, good xp plus sellable fish.', 'Piscarilius access'),
  m('Mining', 'iron', 'Power-mining iron', 15, 30000, 0, 'High', 'Mine iron ore and drop it for fast low-level xp.', '', 44),
  m('Mining', 'motherlode', 'Motherlode Mine', 30, 40000, 20000, 'Low', 'Pay-dirt mining with gold nuggets as a side income.', '', 54),
  m('Mining', 'blast', 'Blast Mine', 43, 70000, 0, 'Medium', 'Fast Mining xp and gear points.', '', 91),
  m('Mining', 'granite-3t', '3-tick granite', 45, 85000, 100000, 'High', 'Tick-manipulated granite mining — the fastest Mining method.', 'Guam leaf or swamp tar + a Desert Quarry visit', null, true),
  m('Mining', 'volcanic', 'Volcanic Mine', 50, 65000, 50000, 'Medium', 'Weekly-event minigame with strong xp and rewards.', 'Volcanic Mine access'),
  m('Mining', 'amethyst', 'Amethyst', 92, 55000, 700000, 'AFK', 'Very low-effort xp with strong sell value.', 'Mining Guild access'),
  m('Hunter', 'falconry', 'Falconry', 43, 40000, 0, 'Medium', 'Catch kebbits with a falcon.', 'Falconer’s Guild'),
  m('Hunter', 'red-chins', 'Red chinchompas', 63, 200000, 600000, 'Medium', 'Box-trap red chinchompas.', 'Hunter level 63', 79),
  m('Hunter', 'black-chins', 'Black chinchompas', 80, 250000, 1000000, 'Medium', 'Box-trap black chinchompas in the Wilderness.', 'Wilderness access', null, true),
  m('Hunter', 'herbiboar', 'Herbiboar', 80, 45000, 800000, 'Low', 'Track the herbiboar for xp plus herbs.', 'Bone Voyage quest'),
  m('Farming', 'herb-runs', 'Herb runs', 32, 10000, 400000, 'Low', 'A few minutes per run for a crop worth far more than the seed.', 'Herb patch access'),
  m('Farming', 'trees', 'Tree runs', 15, 12000, 0, 'Low', 'Plant and check trees and fruit trees for large lump-sum xp.', 'Tree patch access'),
  m('Farming', 'tithe', 'Tithe Farm', 34, 70000, -50000, 'High', 'Active minigame with strong Farming xp per hour.', 'Tithe Farm access', null, true),

  // --- Artisan ---
  m('Cooking', 'wines', 'Wines', 45, 400000, -300000, 'Low', 'Make wines in bulk for very fast, cheap xp.', '', 67),
  m('Cooking', 'karambwan', 'Karambwans / Sharks (Hosidius)', 68, 300000, -200000, 'Medium', 'Cook with gauntlets on the Hosidius range for a low burn rate.', 'Hosidius favour, cooking gauntlets', null, true),
  m('Fletching', 'bows', 'Bows (cut & string)', 40, 450000, -400000, 'Low', 'Fletch and string bows in bulk at a bank.', '', null, true),
  m('Fletching', 'arrows', 'Headless arrows / darts', 1, 100000, -50000, 'Low', 'Low-level bulk fletching.', '', 39),
  m('Firemaking', 'logs', 'Burning logs', 1, 40000, -100000, 'Low', 'Burn logs in bulk — a gp sink.', '', 49),
  m('Firemaking', 'wintertodt', 'Wintertodt', 50, 100000, 50000, 'Medium', 'Best Firemaking xp with useful rewards.', '', null, true),
  m('Crafting', 'gems', 'Cutting gems', 20, 150000, -200000, 'Low', 'Cut gems at a bank for quick low-level xp.', '', 62),
  m('Crafting', 'dhide', 'Green dragonhide bodies', 63, 250000, -300000, 'Low', 'Craft d’hide bodies at a bank.', '', 83),
  m('Crafting', 'black-dhide', 'Black dragonhide bodies', 84, 330000, -900000, 'Low', 'The fastest standard Crafting xp.', '', null, true),
  m('Crafting', 'amethyst', 'Amethyst tips', 83, 60000, 100000, 'Low', 'Cut amethyst into arrow / bolt tips.'),
  m('Smithing', 'giants-foundry', 'Giants’ Foundry', 15, 150000, 0, 'Medium', 'Minigame that smith xp scales strongly with level.', 'Giants’ Foundry access'),
  m('Smithing', 'cannonballs', 'Cannonballs', 35, 35000, 40000, 'Low', 'Smelt steel bars into cannonballs.', 'Dwarf Cannon quest'),
  m('Smithing', 'blast-furnace', 'Blast Furnace', 30, 250000, -100000, 'Medium', 'Smelt bars at the Blast Furnace.', 'Blast Furnace access', null, true),
  m('Herblore', 'unf-finish', 'Mid-level potions', 40, 100000, 0, 'Low', 'Make combat and restore potions.', '', 89),
  m('Herblore', 'ranging', 'Ranging potions', 72, 180000, -100000, 'Low', 'Fast, popular mid-level potion.', '', 89),
  m('Herblore', 'super-combat', 'Super combat potions', 90, 150000, 200000, 'Low', 'Make super combats in bulk.', '', null, true),
  m('Construction', 'oak-larders', 'Oak larders', 33, 180000, -1000000, 'Medium', 'Build & remove oak larders in a player-owned house.', '', 51),
  m('Construction', 'mahogany-tables', 'Mahogany tables', 52, 600000, -1900000, 'Medium', 'Build & remove mahogany tables with a butler.', '', 82),
  m('Construction', 'mahogany-homes', 'Mahogany Homes', 1, 50000, 100000, 'Medium', 'Contract minigame — slower but pays you.', 'Mahogany Homes access'),
  m('Construction', 'wardrobes', 'Magic wardrobes', 86, 800000, -2500000, 'Medium', 'Build & remove magic wardrobes.', '', null, true),
  m('Runecraft', 'gotr', 'Guardians of the Rift', 27, 45000, 350000, 'Medium', 'Minigame with good xp and rewards.'),
  m('Runecraft', 'lava', 'Lava runes', 23, 70000, 150000, 'High', 'Fast mid-level runecrafting.', 'Rune pouches, Fire altar access', 76),
  m('Runecraft', 'nature', 'Nature runes (Abyss)', 44, 25000, 600000, 'High', 'Run nature runes through the Abyss.', '', 76),
  m('Runecraft', 'blood', 'Blood runes (Abyss)', 77, 35000, 1000000, 'High', 'Run blood runes — a top Runecraft money maker.', 'Blood-rune requirements'),
  m('Runecraft', 'ourania', 'Ourania Altar (ZMI)', 1, 65000, 100000, 'Medium', 'Fastest runecraft xp with Ourania Altar and a good setup.', 'Runecrafting Guild / ZMI access', null, true),

  // --- Support ---
  m('Agility', 'gnome', 'Gnome Stronghold Course', 1, 8000, 0, 'Medium', 'Starter course.', '', 9),
  m('Agility', 'draynor', 'Draynor Village Rooftop', 10, 10000, 5000, 'Medium', 'First rooftop course.', '', 29),
  m('Agility', 'varrock', 'Varrock Rooftop', 30, 25000, 20000, 'Medium', 'Reliable early rooftop with marks of grace.', '', 39),
  m('Agility', 'canifis', 'Canifis Rooftop', 40, 40000, 30000, 'Medium', 'Better xp than Varrock.', '', 49),
  m('Agility', 'falador', 'Falador Rooftop', 50, 50000, 40000, 'Medium', 'Strong mid-level xp, no quest requirement.', '', 59),
  m('Agility', 'seers', 'Seers’ Village Rooftop', 60, 55000, 60000, 'Medium', 'Easy rooftop, no quest requirement.', '', 74),
  m('Agility', 'pollnivneach', 'Pollnivneach Rooftop', 70, 52000, 55000, 'Medium', 'Mid-level rooftop.', '', 79),
  m('Agility', 'rellekka', 'Rellekka Rooftop', 80, 55000, 60000, 'Medium', 'Rooftop with good xp rates.', '', 89),
  m('Agility', 'ardougne', 'Ardougne Rooftop', 90, 60000, 70000, 'Medium', 'Best no-quest course (889 xp per lap).', '', 99),
  m('Agility', 'sepulchre', 'Hallowed Sepulchre', 52, 62000, 150000, 'High', 'Active runs with loot and heavy xp.', 'Hallowed Sepulchre access'),
  m('Agility', 'prifddinas', 'Prifddinas Agility Course', 75, 90000, 100000, 'Medium', 'Best Agility xp/hr in the game.', 'Song of the Elves', null, true),
  m('Thieving', 'master-farmers', 'Master Farmers', 38, 25000, 150000, 'Low', 'Pickpocket Master Farmers for xp and seeds.'),
  m('Thieving', 'knights', 'Knights of Ardougne', 55, 80000, 100000, 'Medium', 'Pickpocket knights — no quest requirement.'),
  m('Thieving', 'vyres', 'Vyres in Darkmeyer', 82, 300000, 100000, 'Low', 'Fast, low-click pickpocketing.', 'Sins of the Father', null, true),
  m('Thieving', 'pyramid', 'Pyramid Plunder', 91, 60000, 200000, 'Medium', 'Strong late Thieving xp with loot.', 'Pyramid Plunder access'),
  m('Slayer', 'tasks', 'Slayer tasks', 1, 30000, 300000, 'Medium', 'Match task monsters to your combat level.', 'Slayer Master access'),
  // Starter methods for low levels, so a route can climb to the method you want.
  m('Woodcutting', 'early', 'Regular & oak trees', 1, 16000, 0, 'AFK', 'Chop normal then oak trees near a bank.', '', 29),
  m('Fishing', 'early', 'Shrimp & anchovies (net)', 1, 12000, 0, 'AFK', 'Net fishing at any low-level spot.', '', 19),
  m('Mining', 'early', 'Copper & tin', 1, 14000, 0, 'High', 'Power-mine copper and tin.', '', 14),
  m('Hunter', 'early', 'Birds, kebbits & early traps', 1, 20000, 0, 'Medium', 'Early Hunter via bird snares and low-level traps.', '', 42),
  m('Farming', 'early', 'Allotments & early patches', 1, 6000, 0, 'Low', 'Plant allotments and herbs while passing patches.', '', 14),
  m('Cooking', 'early', 'Shrimp, trout & salmon', 1, 50000, 0, 'Low', 'Cook low-level fish on a range.', '', 44),
  m('Crafting', 'early', 'Leather & early items', 1, 25000, -50000, 'Low', 'Craft leather gloves, boots and armour.', '', 19),
  m('Smithing', 'early', 'Bronze & iron items', 1, 20000, -20000, 'Low', 'Smith bars into daggers or similar.', '', 14),
  m('Herblore', 'early', 'Early potions', 3, 70000, -50000, 'Low', 'Attack, strength and energy potions.', 'Druidic Ritual quest', 39),
  m('Thieving', 'early', 'Men, women & early stalls', 1, 20000, 0, 'Medium', 'Pickpocket men or steal from the baker\u2019s stall.', '', 37),
  // Sailing is new — community rates are still settling, so treat these as rough.
  m('Sailing', 'courier', 'Courier / trade voyages', 1, 20000, 0, 'Low', 'Deliver cargo between nearby ports.'),
  m('Sailing', 'salvage', 'Shipwreck salvaging', 40, 70000, 50000, 'Low', 'Salvage wrecks for steady, low-effort xp.'),
  m('Sailing', 'trials', 'Barracuda / Gwenith Glide trials', 72, 180000, 0, 'High', 'Fastest Sailing xp currently known.', '', null, true),
  m('Slayer', 'konar', 'Konar tasks', 75, 55000, 400000, 'Medium', 'Higher-xp tasks with a location assignment.', 'Slayer Master Konar'),
]

export function methodsForSkill(skill) {
  return TRAINING_METHODS.filter((meth) => meth.skill === skill).sort((a, b) => a.minLevel - b.minLevel)
}

export function getMethod(id) {
  return TRAINING_METHODS.find((meth) => meth.id === id) || null
}

/** Methods for a skill with at least one catalog entry — others fall back to a custom xp/hr. */
export function skillsWithMethods() {
  return [...new Set(TRAINING_METHODS.map((meth) => meth.skill))]
}
