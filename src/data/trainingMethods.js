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

const m = (skill, id, name, minLevel, xpPerHour, gpPerHour, intensity, description, requirements = '', maxLevel = null) => ({
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
})

export const TRAINING_METHODS = [
  // --- Combat ---
  m('Attack', 'crabs', 'Rock / Ammonite Crabs', 1, 35000, 0, 'AFK', 'Fight low-defence crabs for long, low-effort stretches.', '', 69),
  m('Attack', 'nmz', 'Nightmare Zone (absorptions)', 60, 40000, -250000, 'Low', 'Fight bosses in NMZ with absorption potions.', 'Quest Points for NMZ access'),
  m('Attack', 'slayer', 'Slayer tasks', 50, 40000, 300000, 'Medium', 'Combat xp plus task loot that usually covers supplies.', 'Slayer Master access'),
  m('Strength', 'crabs', 'Rock / Ammonite Crabs', 1, 35000, 0, 'AFK', 'Fight low-defence crabs for long, low-effort stretches.', '', 69),
  m('Strength', 'nmz', 'Nightmare Zone (absorptions)', 60, 40000, -250000, 'Low', 'Fight bosses in NMZ with absorption potions.', 'Quest Points for NMZ access'),
  m('Strength', 'slayer', 'Slayer tasks', 50, 40000, 300000, 'Medium', 'Combat xp plus task loot that usually covers supplies.', 'Slayer Master access'),
  m('Defence', 'crabs', 'Rock / Ammonite Crabs', 1, 35000, 0, 'AFK', 'Fight low-defence crabs on a defensive combat style.', '', 69),
  m('Defence', 'nmz', 'Nightmare Zone (absorptions)', 60, 40000, -250000, 'Low', 'Fight bosses in NMZ with absorption potions.', 'Quest Points for NMZ access'),
  m('Hitpoints', 'combat', 'Any combat training', 1, 40000, null, 'Medium', 'Hitpoints xp comes automatically from every combat style.'),
  m('Ranged', 'crabs', 'Rock / Ammonite Crabs', 1, 35000, -50000, 'AFK', 'Shoot low-defence crabs with a ranged weapon.', '', 54),
  m('Ranged', 'chinning', 'Chinchompas (Ape Atoll / Slayer)', 55, 350000, -1000000, 'High', 'Fastest ranged xp: throw chinchompas at multi-target spots.', 'Chinchompas (Hunter or Grand Exchange)'),
  m('Prayer', 'chaos', 'Big bones at the Chaos Altar', 43, 200000, -500000, 'Low', 'Offer bought bones at the Wilderness Chaos Altar (2.5x xp).', 'Wilderness access', 69),
  m('Prayer', 'dragon', 'Dragon bones at a Gilded Altar', 70, 600000, -3000000, 'Low', 'Offer dragon bones at a player-owned-house Gilded Altar.', 'Player-owned house with a Gilded Altar'),
  m('Magic', 'splash', 'Splashing', 1, 30000, -50000, 'AFK', 'Cast combat spells at a monster that cannot hurt you.'),
  m('Magic', 'alch', 'High Alchemy', 55, 65000, -50000, 'Low', 'Alch items while doing something else; thin margins.'),

  // --- Gathering ---
  m('Woodcutting', 'willow', 'Willow trees', 30, 35000, 30000, 'AFK', 'Chop and bank, or drop, willow logs.', '', 59),
  m('Woodcutting', 'yew', 'Yew trees', 60, 45000, 150000, 'AFK', 'Chop yew trees and sell the logs.'),
  m('Fishing', 'fly', 'Fly fishing (trout / salmon)', 20, 40000, 20000, 'AFK', 'Barbarian Village fly fishing, close to a bank.', '', 49),
  m('Fishing', 'tempoross', 'Tempoross', 35, 50000, 100000, 'Medium', 'Skilling boss minigame with useful rewards.', 'Fishing level 35'),
  m('Fishing', 'sharks', 'Sharks / Monkfish', 50, 35000, 150000, 'AFK', 'Fishing Guild harpoon fishing; sharks sell consistently.', 'Fishing Guild access'),
  m('Mining', 'motherlode', 'Motherlode Mine', 30, 40000, 20000, 'Low', 'Pay-dirt mining with gold nuggets as a side income.', '', 54),
  m('Mining', 'blast', 'Blast Mine', 43, 70000, 0, 'Medium', 'Fast Mining xp and gear points.', '', 91),
  m('Mining', 'amethyst', 'Amethyst', 92, 55000, 700000, 'AFK', 'Very low-effort xp with strong sell value.', 'Mining Guild access'),
  m('Hunter', 'red-chins', 'Red chinchompas', 63, 200000, 600000, 'Medium', 'Box-trap red chinchompas.', 'Hunter level 63', 79),
  m('Hunter', 'black-chins', 'Black chinchompas', 80, 250000, 1000000, 'Medium', 'Box-trap black chinchompas in the Wilderness.', 'Wilderness access'),
  m('Farming', 'herb-runs', 'Herb runs', 32, 10000, 400000, 'Low', 'A few minutes per run for a crop worth far more than the seed.', 'Herb patch access'),

  // --- Artisan ---
  m('Cooking', 'sharks', 'Cooking at Hosidius range', 68, 300000, -200000, 'Medium', 'Cook karambwans or sharks with gauntlets for a low burn rate.', 'Hosidius favour, cooking gauntlets'),
  m('Cooking', 'wines', 'Wines', 45, 400000, -300000, 'Low', 'Make wines in bulk for very fast, cheap xp.', '', 67),
  m('Fletching', 'bows', 'Bows (cut & string)', 40, 450000, -400000, 'Low', 'Fletch and string bows in bulk at a bank.'),
  m('Firemaking', 'wintertodt', 'Wintertodt', 50, 50000, 50000, 'Medium', 'Best Firemaking xp with useful rewards.'),
  m('Firemaking', 'logs', 'Burning logs', 1, 40000, -100000, 'Low', 'Burn logs in bulk — a gp sink.', '', 49),
  m('Crafting', 'dhide', 'Green dragonhide bodies', 63, 250000, -300000, 'Low', 'Craft d’hide bodies at a bank.'),
  m('Crafting', 'amethyst', 'Amethyst tips', 83, 60000, 100000, 'Low', 'Cut amethyst into arrow / bolt tips.'),
  m('Smithing', 'cannonballs', 'Cannonballs', 35, 35000, 40000, 'Low', 'Smelt steel bars into cannonballs.', 'Dwarf Cannon quest'),
  m('Smithing', 'blast-furnace', 'Blast Furnace', 30, 250000, -100000, 'Medium', 'Smelt bars at the Blast Furnace.', 'Blast Furnace access'),
  m('Herblore', 'unf-finish', 'Mid-level potions', 40, 100000, 0, 'Low', 'Make combat and restore potions.', '', 89),
  m('Herblore', 'super-combat', 'Super combat potions', 90, 150000, 200000, 'Low', 'Make super combats in bulk.'),
  m('Construction', 'oak-larders', 'Oak larders', 33, 180000, -1000000, 'Medium', 'Build & remove oak larders in a player-owned house.', '', 51),
  m('Construction', 'mahogany-tables', 'Mahogany tables', 52, 600000, -1900000, 'Medium', 'Build & remove mahogany tables with a butler.', '', 82),
  m('Construction', 'wardrobes', 'Magic wardrobes', 86, 800000, -2500000, 'Medium', 'Build & remove magic wardrobes.'),
  m('Runecraft', 'nature', 'Nature runes (Abyss)', 44, 25000, 600000, 'High', 'Run nature runes through the Abyss.', '', 76),
  m('Runecraft', 'blood', 'Blood runes (Abyss)', 77, 35000, 1000000, 'High', 'Run blood runes — a top Runecraft money maker.', 'Blood-rune requirements'),
  m('Runecraft', 'gotr', 'Guardians of the Rift', 27, 45000, 350000, 'Medium', 'Minigame with good xp and rewards.'),

  // --- Support ---
  m('Agility', 'gnome', 'Gnome Stronghold Course', 1, 8000, 0, 'Medium', 'Starter course.', '', 9),
  m('Agility', 'seers', 'Seers’ Village Rooftop', 60, 55000, 60000, 'Medium', 'Easy rooftop, no quest requirement.', '', 74),
  m('Agility', 'pollnivneach', 'Pollnivneach Rooftop', 70, 52000, 55000, 'Medium', 'Mid-level rooftop.', '', 79),
  m('Agility', 'rellekka', 'Rellekka Rooftop', 80, 55000, 60000, 'Medium', 'Rooftop with good xp rates.', '', 89),
  m('Agility', 'ardougne', 'Ardougne Rooftop', 90, 60000, 70000, 'Medium', 'Best no-quest course (889 xp per lap).', '', 99),
  m('Agility', 'prifddinas', 'Prifddinas Agility Course', 75, 90000, 100000, 'Medium', 'Best Agility xp/hr in the game.', 'Song of the Elves'),
  m('Thieving', 'knights', 'Knights of Ardougne', 55, 80000, 100000, 'Medium', 'Pickpocket knights — no quest requirement.'),
  m('Thieving', 'vyres', 'Vyres in Darkmeyer', 82, 300000, 100000, 'Low', 'Fast, low-click pickpocketing.', 'Sins of the Father'),
  m('Slayer', 'tasks', 'Slayer tasks', 1, 30000, 300000, 'Medium', 'Match task monsters to your combat level.', 'Slayer Master access'),
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
