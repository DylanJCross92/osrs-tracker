// Version-controlled training-method catalog for the Account Planner.
//
// Figures were audited against the OSRS Wiki's skill training guides and the
// Money making guide, then rounded. Real rates swing with gear, boosts, tick
// manipulation, supplies and how well you play, so the planner always labels
// them "approximate". Where a wiki rate rises with level, a representative
// figure for the method's level range is used. gpPerHour is NET gp/hr
// (negative = a cost) from the wiki's profit figures or from GE prices, or
// null when there is no trustworthy figure, in which case the UI says "No GP
// data" rather than showing 0.
//
// Shape: { id, skill, name, description, minLevel, maxLevel|null,
//          xpPerHour, gpPerHour|null, intensity, requirements }
// intensity: 'AFK' | 'Low' | 'Medium' | 'High'
// A method only contributes xp between xpForLevel(minLevel) and
// xpForLevel(maxLevel + 1), see planner.js's planGoal().

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

// Melee methods train Attack, Strength or Defence depending on your combat style, so each is listed for all three.
const melee = (id, name, minLevel, xpPerHour, gpPerHour, intensity, description, requirements = '', maxLevel = null, fastest = false) =>
  ['Attack', 'Strength', 'Defence'].map((skill) => m(skill, id, name, minLevel, xpPerHour, gpPerHour, intensity, description, requirements, maxLevel, fastest))

export const TRAINING_METHODS = [
  // --- Melee (Attack / Strength / Defence) ---
  ...melee('crabs', 'Rock / Ammonite Crabs', 1, 35000, 0, 'AFK', 'Fight low-defence crabs for long, low-effort stretches.', '', 69),
  ...melee('sand-crabs', 'Sand Crabs', 40, 40000, 0, 'AFK', 'AFK crabs in Zeah with a very reliable reset.', 'Zeah access', 79),
  ...melee('gemstone-crab', 'Gemstone Crab', 30, 40000, 0, 'AFK', 'The premier idle method: a crab with huge HP that needs no food.', 'Children of the Sun'),
  ...melee('nmz', 'Nightmare Zone (absorptions)', 60, 50000, -250000, 'AFK', 'The most AFK combat method: fight bosses in NMZ with absorption potions.', 'Quest requirements for NMZ access'),
  ...melee('slayer', 'Slayer tasks', 50, 40000, 250000, 'Medium', 'Combat xp plus task loot that usually covers supplies.', 'Slayer Master access'),
  ...melee('sulphur-naguas', 'Sulphur Naguas', 55, 100000, 250000, 'Medium', 'Fast melee xp in Neypotzli with decent profit from noted ore and runes.', 'Partial Perilous Moons, 43 Prayer'),
  ...melee('scurrius', 'Scurrius (Varrock Sewers)', 55, 100000, -300000, 'High', 'Boss fight for 100K+ xp an hour. Drops do not cover supplies.', '40 Prayer, bone mace', 75),
  ...melee('maniacal-monkeys', 'Maniacal monkeys', 75, 200000, 0, 'Low', 'The highest melee xp. Auto-retaliate with a crystal halberd, 300K possible with a great setup.', 'Monkey Madness II (partial), 75 Attack', null, true),
  ...melee('gargoyles', 'Gargoyles (Slayer Tower)', 80, 40000, 700000, 'High', 'Slow xp but around 700K gp an hour in drops.', '75 Slayer, rock hammer'),

  // --- Hitpoints (a third of the xp of whatever you fight with) ---
  m('Hitpoints', 'combat', 'Any combat training', 1, 12000, null, 'Medium', 'Hitpoints xp comes automatically from every combat style, about a third of your melee xp.'),
  m('Hitpoints', 'crabs', 'Crabs', 1, 12000, 0, 'AFK', 'Hitpoints xp earned while training melee on crabs.', '', 69),
  m('Hitpoints', 'nmz', 'Nightmare Zone', 60, 17000, -250000, 'AFK', 'Hitpoints xp earned while training melee in NMZ.'),
  m('Hitpoints', 'maniacal-monkeys', 'Maniacal monkeys', 75, 67000, 0, 'Low', 'Hitpoints xp earned while meleeing maniacal monkeys.', 'Monkey Madness II (partial)'),
  m('Hitpoints', 'barrage', 'Barrage on Slayer tasks', 94, 120000, -1800000, 'High', 'Ice Barrage multi-target tasks give heavy Hitpoints xp.', 'Ancient Magicks, 94 Magic', null, true),

  // --- Ranged ---
  m('Ranged', 'cannon', 'Dwarf multicannon', 1, 40000, -300000, 'Low', 'The fastest Ranged xp up to level 45, but cannonballs are expensive.', 'Dwarf Cannon quest', 59),
  m('Ranged', 'crabs', 'Gemstone / sand crabs (idle)', 1, 30000, -20000, 'AFK', 'Idle ranged on crabs. Adamant darts are the best value ammo.', '', 69),
  m('Ranged', 'pest-control', 'Pest Control', 70, 95000, 0, 'Medium', 'Veteran boat games for Void commendation points. Xp rises with level.', 'Combat level 100 recommended'),
  m('Ranged', 'blowpipe-slayer', 'Toxic blowpipe on Slayer', 60, 55000, 250000, 'Medium', 'Reliable ranged xp from Slayer tasks. The wiki does not rate it as efficient.', 'Toxic blowpipe'),
  m('Ranged', 'nmz', 'Nightmare Zone (venator bow)', 70, 145000, -300000, 'AFK', 'AFK ranged with a venator bow and absorptions.', 'NMZ quests, venator bow'),
  m('Ranged', 'venator-monkeys', 'Venator bow on monkeys', 80, 190000, -800000, 'Medium', 'Venator bow with amethyst arrows on maniacal monkeys.', 'Monkey Madness II, venator bow'),
  m('Ranged', 'grey-chins', 'Grey chinchompas (chinning)', 45, 330000, -1400000, 'High', 'Chin maniacal monkeys. Costs money, rates assume a good setup.', 'Monkey Madness II (partial)', 54),
  m('Ranged', 'red-chins', 'Red chinchompas (chinning)', 55, 480000, -2200000, 'High', 'Faster chinning with red chinchompas.', 'Monkey Madness II (partial)', 64),
  m('Ranged', 'black-chins', 'Black chinchompas (chinning)', 65, 700000, -5000000, 'High', 'The fastest way to train Ranged. Very expensive chinchompas.', 'Monkey Madness II (partial)', null, true),

  // --- Prayer ---
  m('Prayer', 'urium', 'Cremating urium remains', 1, 35000, null, 'Low', 'Cremate remains for steady xp. The wiki says it is typically profitable.', '95 Firemaking for urium, zealot robes'),
  m('Prayer', 'ectofuntus', 'Ectofuntus', 1, 120000, -300000, 'Medium', 'Grind bones and worship at the Ectofuntus.', 'Ghosts Ahoy for easiest access'),
  m('Prayer', 'chaos', 'Big bones at the Chaos Altar', 43, 200000, -500000, 'Low', 'Offer bought bones at the Wilderness Chaos Altar (half are saved).', 'Wilderness access', 69),
  m('Prayer', 'libation', 'Libation bowl (blessed bone shards)', 30, 900000, null, 'Medium', 'Offer blessed bone shards with blessed wine at the Teomat libation bowl.', 'Prayer 30, bone shards'),
  m('Prayer', 'dragon', 'Dragon bones at a Gilded Altar', 70, 643000, -9900000, 'Low', 'Offer dragon bones at a player-owned-house Gilded Altar. Very expensive.', 'Player-owned house with a Gilded Altar'),
  m('Prayer', 'superior', 'Superior dragon bones at a Gilded Altar', 70, 1340000, -50800000, 'Low', 'The fastest Prayer xp by far, and the most expensive.', 'Gilded Altar, superior dragon bones', null, true),
  m('Prayer', 'chaos-dragon', 'Dragon bones at the Chaos Temple', 70, 860000, -8000000, 'Medium', 'Wilderness altar with noted bones. Player-killer risk.', 'Wilderness access'),
  m('Prayer', 'wildy-altar', 'Dragon bones at the Wilderness altar', 70, 400000, -5000000, 'Low', 'Offer dragon bones on a Wilderness altar with a lit pyre.', 'Wilderness access'),

  // --- Magic ---
  m('Magic', 'splash', 'Splashing', 1, 30000, -50000, 'AFK', 'Cast combat spells at a monster that cannot hurt you.'),
  m('Magic', 'enchant-jewellery-1', 'Enchant jewellery (level 1)', 7, 32000, null, 'Low', 'Enchant sapphire and opal jewellery at a bank.', '', 26),
  m('Magic', 'enchant-jewellery-2', 'Enchant jewellery (levels 2 and 3)', 27, 70000, null, 'Low', 'Enchant emerald, ruby and similar jewellery.', '', 56),
  m('Magic', 'enchant-bolts', 'Enchant crossbow bolts', 4, 150000, null, 'Low', 'The wiki calls this one of the fastest ways to train Magic up to 55. Gem and bolt costs add up fast.', 'Enchant Crossbow Bolt spell', 56),
  m('Magic', 'enchant-bolts-high', 'Enchant crossbow bolts (high tier)', 57, 400000, null, 'Low', 'Ruby, diamond, dragonstone and onyx bolts at a bank. Very expensive.', 'Enchant Crossbow Bolt spell', null, true),
  m('Magic', 'low-alch', 'Low Level Alchemy', 21, 60000, -60000, 'Low', 'Alch cheap items for a small loss.', '', 54),
  m('Magic', 'camelot-tele', 'Camelot Teleport', 45, 80000, -245000, 'Low', 'Spam Camelot Teleport. Costs a law rune per cast.', '', 54),
  m('Magic', 'alch', 'High Alchemy', 55, 65000, 0, 'Low', 'Alch items while doing something else. Profit depends on the items you pick.'),
  m('Magic', 'grand-library', 'Arceuus Grand Library books', 20, 140000, null, 'Medium', 'Collect books for Magic xp equal to 15 times your Magic level. The wiki calls it highly profitable.', 'Kourend Library access'),
  m('Magic', 'burst', 'Ice Burst on Slayer tasks', 70, 130000, -1000000, 'High', 'Multi-target bursting on stacked Slayer monsters.', 'Ancient Magicks'),
  m('Magic', 'monkeys-burst', 'Ice Burst on maniacal monkeys', 70, 280000, -1500000, 'Medium', 'Fast burst xp on monkeys in Kruk\'s Dungeon, best with two accounts.', 'Monkey Madness II, Ancient Magicks'),
  m('Magic', 'bandits', 'Bandits in the Wilderness (Ice Barrage)', 70, 220000, 750000, 'Medium', 'One of the fastest profitable methods, with Wilderness risk.', 'Ancient Magicks, Accursed sceptre'),
  m('Magic', 'plank-make', 'Plank Make (Lunar)', 86, 130000, 100000, 'AFK', 'Auto-cast Plank Make. The wiki reports a small profit.', 'Lunar spellbook, Dream Mentor'),
  m('Magic', 'superglass', 'Superglass Make (Lunar)', 77, 46800, 1000000, 'High', 'Make molten glass. It also trains Crafting, and sells well.', 'Lunar spellbook'),
  m('Magic', 'tan-leather', 'Tan Leather (Lunar)', 78, 132000, 2000000, 'Low', 'Cast Tan Leather on dragonhide for a strong profit.', 'Lunar spellbook'),
  m('Magic', 'bake-pie', 'Bake Pie (Lunar)', 65, 113000, -1500000, 'AFK', 'Passive Magic xp while baking pies. Costs a lot of ingredients.', 'Lunar spellbook'),
  m('Magic', 'string-jewellery', 'String Jewellery (Lunar)', 80, 150000, -265000, 'Low', 'Relatively low-effort Lunar spell.', 'Lunar spellbook'),
  m('Magic', 'cure-me', 'Cure Me (Lunar)', 71, 414000, -3720000, 'High', 'Very fast but click-heavy. Needs poison from Morytania spiders.', 'Lunar spellbook, protect from melee'),
  m('Magic', 'barrage', 'Ice Barrage on Slayer tasks', 94, 250000, -1800000, 'High', 'Fast magic xp from multi-target Barrage.', 'Ancient Magicks, 94 Magic'),
  m('Magic', 'monkeys-barrage', 'Ice Barrage on maniacal monkeys', 94, 360000, -2700000, 'Medium', 'The fastest viable way to train Magic in real time. Costs a fortune in runes.', 'Monkey Madness II, Ancient Magicks', null, true),

  // --- Woodcutting ---
  m('Woodcutting', 'early', 'Regular trees', 1, 15000, 9500, 'AFK', 'Chop normal trees near a bank.', '', 14),
  m('Woodcutting', 'oak', 'Oak trees', 15, 40000, 30000, 'AFK', 'Chop oaks and sell the logs.', '', 29),
  m('Woodcutting', 'achey', 'Achey trees', 1, 17000, 250000, 'AFK', 'Chop achey trees and sell the logs. Slow xp but good money.', '', 29),
  m('Woodcutting', 'willow', 'Willow trees', 30, 35000, 23000, 'AFK', 'Chop and bank, or drop, willow logs.', '', 59),
  m('Woodcutting', 'teak', 'Teak trees', 35, 55000, -14500, 'Low', 'Fossil Island or Ape Atoll teak with no tick manipulation. The wiki shows a small loss.', '', 64),
  m('Woodcutting', 'teak-2t', 'Teak trees (2-tick)', 35, 140000, -20000, 'High', 'Tick-manipulated teak on Ape Atoll or Prifddinas.', 'Tick manipulation, 2-tick weapon', null),
  m('Woodcutting', 'teak-15t', 'Teak trees (1.5-tick)', 35, 170000, -20000, 'High', 'The fastest Woodcutting in the game, with tick manipulation on Fossil Island.', 'Tick manipulation, Fossil Island teaks', null, true),
  m('Woodcutting', 'maple', 'Maple trees', 45, 45000, 3000, 'AFK', 'Maple trees at Seers\' Village.', '', 59),
  m('Woodcutting', 'arctic-pine', 'Arctic pine trees', 54, 20000, 359500, 'AFK', 'Slow xp, but the best-paying logs on the wiki.', 'Neitiznot access'),
  m('Woodcutting', 'mahogany', 'Mahogany trees', 50, 46500, 23000, 'Low', 'Fossil Island or Ape Atoll mahogany.', '', 89),
  m('Woodcutting', 'yew', 'Yew trees', 60, 45000, 24000, 'AFK', 'Chop yew trees and sell the logs.', '', 89),
  m('Woodcutting', 'blisterwood', 'Blisterwood tree', 62, 69000, null, 'Low', 'A low-effort tree in Darkmeyer that never depletes.', 'Partial Sins of the Father', 89),
  m('Woodcutting', 'sulliuscep', 'Sulliuscep (Fossil Island)', 65, 95000, null, 'Low', 'Low-effort mushrooms in the Tar Swamp.', 'Bone Voyage'),
  m('Woodcutting', 'camphor', 'Camphor trees', 66, 70000, 64000, 'AFK', 'Sailing-island camphor with a solid profit.', 'Sailing 45, partial Troubled Tortugans'),
  m('Woodcutting', 'magic', 'Magic trees', 75, 30000, 56000, 'AFK', 'Chop magic trees and sell the logs.', '', 89),
  m('Woodcutting', 'bloodwood', 'Bloodwood trees', 77, 170000, null, 'Medium', 'Fast Woodcutting without tick manipulation, yielding sap.', 'The Blood Moon Rises'),
  m('Woodcutting', 'ironwood', 'Ironwood trees', 80, 100000, 33000, 'Medium', 'Sunbleak Island ironwood.', '72 Sailing'),
  m('Woodcutting', 'redwood', 'Redwood trees', 90, 60000, 124000, 'AFK', 'Redwood trees at the Woodcutting Guild.', 'Woodcutting Guild access'),
  m('Woodcutting', 'rosewood', 'Rosewood trees', 92, 87000, 49000, 'Low', 'Drumstick Isle rosewood with very little effort.', '79 Sailing'),

  // --- Fishing ---
  m('Fishing', 'early', 'Shrimp & anchovies (net)', 1, 12000, 0, 'AFK', 'Net fishing at any low-level spot.', '', 19),
  m('Fishing', 'fly', 'Fly fishing (trout / salmon)', 20, 25000, 20000, 'AFK', 'Barbarian Village fly fishing, close to a bank.', '', 57),
  m('Fishing', 'fly-3t', 'Fly fishing (3-tick)', 20, 55000, 0, 'High', 'Tick-manipulated fly fishing using herb on swamp tar.', 'Tick manipulation'),
  m('Fishing', 'lobster', 'Lobster & swordfish (harpoon)', 40, 28000, 40000, 'AFK', 'Karamja or Piscatoris harpoon fishing.', '', 49),
  m('Fishing', 'barbarian', 'Barbarian fishing (AFK)', 48, 37000, 0, 'Low', 'Drop the fish at Otto\'s Grotto. Low effort and no profit.', 'Barbarian Training', 70),
  m('Fishing', 'sharks', 'Sharks (Fishing Guild)', 50, 35000, 150000, 'AFK', 'Fishing Guild harpoon fishing. Sharks sell consistently.', 'Fishing Guild access'),
  m('Fishing', 'tempoross', 'Tempoross', 35, 50000, 100000, 'Low', 'Skilling boss minigame with useful rewards. Rates rise with level.'),
  m('Fishing', 'monkfish', 'Monkfish (small net)', 62, 38000, 25000, 'Low', 'Piscatoris monkfish with a small net.', 'Swan Song'),
  m('Fishing', 'karambwan', 'Karambwans', 65, 36000, 130000, 'Low', 'Karambwan fishing, a profitable and low-effort method.', 'Tai Bwo Wannai Trio'),
  m('Fishing', 'barbarian-3t', 'Barbarian fishing (3-tick)', 58, 70000, 0, 'High', 'Tick-manipulated barbarian fishing. Fast and demanding.', 'Barbarian rod, tick manipulation', null),
  m('Fishing', 'harpoon-2t', '2-tick harpooning (swordfish / tuna)', 71, 100000, 0, 'High', 'Tick manipulation at Port Piscarilius. Up to 137K at 99.', 'Tick manipulation', null, true),
  m('Fishing', 'leechfin', 'Leechfin fishing', 78, 115000, null, 'High', 'Click every tick for very high xp.', 'The Blood Moon Rises'),
  m('Fishing', 'infernal-eel', 'Infernal eel', 80, 31000, 154000, 'Low', 'Infernal eel fishing with a Mor Ul Rek reward.', 'Fire cape, ice gloves, oily fishing rod'),
  m('Fishing', 'minnows', 'Minnows (Fishing Guild)', 82, 48000, 183000, 'Low', 'High-volume minnow fishing at the Guild.', 'Fishing Guild, Fishing Contest'),
  m('Fishing', 'anglerfish', 'Anglerfish', 82, 30000, 200000, 'AFK', 'Piscarilius anglerfish, good xp plus sellable fish.', 'Piscarilius access'),
  m('Fishing', 'dark-crabs', 'Dark crabs (Wilderness)', 85, 40000, 228000, 'Low', 'Deep Wilderness crabs. Player-killer risk.', 'Elite Wilderness Diary'),
  m('Fishing', 'sacred-eel', 'Sacred eels', 87, 21000, 94000, 'Low', 'Zul-Andra sacred eels, plus Cooking xp.', 'Regicide partial, 72 Cooking'),
  m('Fishing', 'drift-net', 'Drift net fishing', 47, 70000, null, 'Medium', 'Fossil Island underwater. Trains Fishing and Hunter together.', '44 Hunter, Bone Voyage'),

  // --- Mining ---
  m('Mining', 'early', 'Copper & tin', 1, 14000, 0, 'High', 'Power-mine copper and tin.', '', 14),
  m('Mining', 'iron', 'Power-mining iron', 15, 45000, 0, 'High', 'Mine iron ore and drop it for fast low-level xp.', '', 59),
  m('Mining', 'motherlode', 'Motherlode Mine', 30, 55000, 20000, 'Low', 'Pay-dirt mining with gold nuggets as a side income.'),
  m('Mining', 'gems', 'Gem rocks', 40, 55000, 220000, 'High', 'Mine gem rocks and sell the gems.', 'Medium Karamja Diary'),
  m('Mining', 'calcified', 'Calcified rocks', 41, 35000, null, 'Low', 'Cam Torum rocks that give blessed bone shards for Prayer.', 'Started Perilous Moons'),
  m('Mining', 'blast', 'Blast Mine', 43, 80000, 0, 'Medium', 'Fast Mining xp that scales with level, plus gear points.'),
  m('Mining', 'granite-3t', '3-tick granite', 45, 105000, 0, 'High', 'Tick-manipulated granite mining, the fastest Mining method.', 'Swamp tar and clean herb, a Desert Quarry visit', null, true),
  m('Mining', 'rubium', 'Rubium rocks', 48, 50000, null, 'Low', 'Charred Island rubium, profitable and low effort.', 'Sailing 60'),
  m('Mining', 'volcanic', 'Volcanic Mine', 50, 70000, 0, 'Medium', 'Weekly-event minigame with strong xp but no real profit.', 'Volcanic Mine access'),
  m('Mining', 'guild-iron', 'Mining Guild iron', 60, 75000, 0, 'High', 'Power-mine iron in the Mining Guild.', 'Mining Guild access'),
  m('Mining', 'lead', 'Lead rocks (Deepfin Mine)', 60, 85000, null, 'High', 'Power-mine lead with Mining enhancers.', 'Sailing 67'),
  m('Mining', 'crashed-star', 'Crashed stars', 10, 28000, 0, 'AFK', 'Very low-effort mining when a star lands.'),
  m('Mining', 'zalcano', 'Zalcano', 70, 70000, null, 'High', 'Boss that trains Mining, Smithing and Runecraft.', 'Song of the Elves'),
  m('Mining', 'shale', 'Infernal shale (tick manipulation)', 78, 70000, null, 'High', 'Tick-manipulated shale mining.', 'A Kingdom Divided'),
  m('Mining', 'amethyst', 'Amethyst', 92, 22500, 228000, 'AFK', 'Very low-effort xp with a strong sell value.', 'Mining Guild access'),
  m('Mining', 'gems-3t', 'Gem rocks (3-tick)', 40, 100000, 389000, 'High', 'Tick-manipulated gem rocks at maximum rates, also very profitable.', 'Medium Karamja Diary, tick manipulation', null, true),

  // --- Hunter ---
  m('Hunter', 'early', 'Birds, kebbits & early traps', 1, 20000, 0, 'Medium', 'Early Hunter via bird snares and low-level traps.', '', 8),
  m('Hunter', 'weasels', 'Feldip weasels', 9, 13000, null, 'Medium', 'Noose-wand weasels in the Feldip Hills.', '', 14),
  m('Hunter', 'ruby-harvest', 'Ruby harvest butterflies', 15, 20000, null, 'Medium', 'Catch butterflies and trap birds at Piscatoris.', '', 20),
  m('Hunter', 'red-crabs', 'Red crabs (Pandemonium)', 21, 31000, null, 'Medium', 'Two-trap crab hunting.', 'Partial Pandemonium, 10 Construction', 38),
  m('Hunter', 'jerboas', 'Embertailed jerboas', 39, 50000, null, 'Medium', 'Three-trap jerboas at Locus Oasis.', 'Partial Eagles\' Peak', 42),
  m('Hunter', 'falconry', 'Falconry (spotted / dark kebbits)', 43, 70000, 0, 'Medium', 'Catch kebbits with a falcon.', 'Falconer\'s Guild', 68),
  m('Hunter', 'birdhouses', 'Bird house trapping', 9, 60000, null, 'Low', 'Effective rate from bird house runs; the real run is short and needs timers.', 'Bone Voyage, digsite pendant'),
  m('Hunter', 'salamanders', 'Orange salamanders', 47, 52000, 0, 'Medium', 'Net-trap orange salamanders.', '', 59),
  m('Hunter', 'razorbacks', 'Razor-backed kebbits', 49, 100000, null, 'Medium', 'Noose-wand kebbits at Piscatoris.', 'Ring of pursuit', 72),
  m('Hunter', 'rumours', 'Hunters\' Rumours', 72, 190000, null, 'Low', 'Guild contracts at 72+. Xp rises from 160K at 72 to 250K at 99.', 'Hunter Guild access'),
  m('Hunter', 'red-salamanders', 'Red salamanders', 60, 85000, 0, 'Medium', 'Net-trap red salamanders.', '', 66),
  m('Hunter', 'black-salamanders', 'Black salamanders', 67, 105000, 0, 'Medium', 'Faster net-trapping in the Wilderness.', 'Wilderness access', 79),
  m('Hunter', 'red-chins', 'Red chinchompas', 63, 125000, 600000, 'Medium', 'Box-trap red chinchompas.', 'Hunter level 63', 72),
  m('Hunter', 'carnivorous-chins', 'Carnivorous chinchompas', 63, 110000, 650000, 'Medium', 'Varlamore chinchompas. Tick manipulation raises xp considerably.', 'Partial Eagles\' Peak, Varlamore access'),
  m('Hunter', 'black-chins', 'Black chinchompas', 73, 190000, 1200000, 'Medium', 'Box-trap black chinchompas in the Wilderness.', 'Wilderness access', null, true),
  m('Hunter', 'maniacal-monkeys', 'Maniacal monkeys', 60, 80000, null, 'Low', 'Low-effort hunting of monkeys.', 'Monkey Madness II'),
  m('Hunter', 'rainbow-crabs', 'Rainbow crabs', 77, 140000, 415000, 'Medium', 'Crab traps with good xp and good profit.', '64 Sailing'),
  m('Hunter', 'herbiboar', 'Herbiboar', 80, 150000, null, 'Low', 'Track the herbiboar for xp plus herbs.', 'Bone Voyage, 31 Herblore'),
  m('Hunter', 'drift-nets', 'Drift net fishing', 44, 85000, -206000, 'Medium', 'Fossil Island underwater drift nets. Net cost only, fish sales not included.', 'Bone Voyage, 47 Fishing'),

  // --- Farming (rates are per hour of active farming) ---
  m('Farming', 'early', 'Allotments & early patches', 1, 6000, 0, 'Low', 'Plant allotments and herbs while passing patches.', '', 14),
  m('Farming', 'trees', 'Tree runs', 15, 2400000, -14800000, 'Low', 'Xp per active hour of tree runs, which take minutes but need hours of growth time between runs. Saplings are the main cost.', 'Tree patch access'),
  m('Farming', 'herb-runs', 'Herb runs', 32, 10000, 400000, 'Low', 'Rough rates per hour including the wait between runs (herbs take about 80 minutes to grow). The crop is worth far more than the seed.', 'Herb patch access'),
  m('Farming', 'tithe', 'Tithe Farm', 34, 85000, -50000, 'High', 'Active minigame with strong Farming xp per hour.', 'Tithe Farm access', null, true),

  // --- Fletching (rates assume about 3,000 actions an hour) ---
  m('Fletching', 'arrows', 'Bronze arrows', 1, 58500, -45000, 'Low', 'Attach arrowtips to headless arrows at a bank.', '', 14),
  m('Fletching', 'iron-arrows', 'Iron arrows', 15, 112500, -60000, 'Low', 'Attach iron arrowtips to headless arrows.', '', 29),
  m('Fletching', 'steel-arrows', 'Steel arrows', 30, 225000, -100000, 'Low', 'Attach steel arrowtips to headless arrows.', '', 44),
  m('Fletching', 'mithril-arrows', 'Mithril arrows', 45, 337500, -200000, 'Low', 'Attach mithril arrowtips to headless arrows.', '', 59),
  m('Fletching', 'bows', 'Bows (cut & string)', 40, 150000, null, 'Low', 'Fletch and string bows in bulk at a bank. Slower than arrows.', ''),
  m('Fletching', 'adamant-arrows', 'Adamant arrows', 60, 450000, -300000, 'Low', 'Attach adamant arrowtips to headless arrows.', '', 74),
  m('Fletching', 'rune-arrows', 'Rune arrows', 75, 562500, -696000, 'Low', 'Attach rune arrowtips to headless arrows.', '', 89),
  m('Fletching', 'vale-totems', 'Vale Totems', 20, 220000, -120000, 'Medium', 'Auburn Valley totem loops. Xp rises with log tier.', 'Vale Totems miniquest'),
  m('Fletching', 'ascension-bolts', 'Ascension bolts', 86, 365000, 481000, 'Low', 'Profitable bolt fletching with ascension shards.', 'Ascension shards'),
  m('Fletching', 'redwood-shields', 'Redwood shields', 92, 168000, -605000, 'Low', 'Fletch redwood shields at a bank.', ''),
  m('Fletching', 'dragon-arrows', 'Dragon arrows', 90, 675000, -570000, 'Low', 'The fastest Fletching xp.', '', null, true),

  // --- Slayer ---
  m('Slayer', 'tasks', 'Slayer tasks', 1, 30000, 300000, 'Medium', 'Match task monsters to your combat level. No exact wiki rate, so approximate.', 'Slayer Master access'),
  m('Slayer', 'konar', 'Konar tasks', 75, 55000, 400000, 'Medium', 'Higher-xp tasks with a location assignment. Approximate.', 'Slayer Master Konar'),

  // --- Cooking ---
  m('Cooking', 'early', 'Shrimp, trout & salmon', 1, 50000, 0, 'Low', 'Cook low-level fish on a range.', '', 29),
  m('Cooking', 'bake-pie', 'Bake Pie (Lunar)', 10, 147000, -1500000, 'Low', 'Lunar spell that also trains Magic. Every pie loses money.', 'Lunar Diplomacy'),
  m('Cooking', 'karambwan', 'Karambwans (Hosidius, AFK)', 30, 190000, 110000, 'Low', 'Cook raw karambwan at the Hosidius kitchen for steady xp and profit.', 'Tai Bwo Wannai Trio, Hosidius kitchen'),
  m('Cooking', 'swordfish', 'Swordfish & lobsters (Hosidius)', 40, 100000, -30000, 'Low', 'Cook mid-level fish on the Hosidius range.', 'Cooking gauntlets', 79),
  m('Cooking', 'monkfish', 'Monkfish (Hosidius)', 62, 140000, 20000, 'Low', 'Cook monkfish on the Hosidius range.', 'Cooking gauntlets'),
  m('Cooking', 'wines', 'Jugs of wine', 68, 470000, -191000, 'Medium', 'Make wines in bulk for very fast, cheap xp.', '', null, true),
  m('Cooking', 'sharks', 'Sharks (Hosidius)', 80, 140000, 148000, 'Low', 'Cook sharks for profit and steady xp.', 'Cooking gauntlets'),
  m('Cooking', 'anglerfish', 'Anglerfish (Hosidius)', 84, 140000, 165000, 'Low', 'Cook anglerfish for a strong profit.', 'Cooking gauntlets'),
  m('Cooking', 'manta', 'Manta rays (Hosidius)', 91, 140000, 96000, 'Low', 'Cook manta rays on the Hosidius range.', 'Cooking gauntlets'),
  m('Cooking', 'karambwan-1t', 'Karambwans (1-tick)', 30, 700000, 364000, 'High', 'The fastest Cooking: tick-manipulated karambwan at Rogues\' Den.', 'Tick manipulation, Tai Bwo Wannai Trio', null, true),

  // --- Firemaking ---
  m('Firemaking', 'campfire', 'Forester\'s campfire', 1, 33000, -50000, 'Low', 'Burn logs at a forester\'s campfire next to a bank.', '', null),
  m('Firemaking', 'logs', 'Burning logs (coloured)', 1, 74000, -83000, 'High', 'Tick-timed burning of logs at a bank.', '', 29),
  m('Firemaking', 'burn-30', 'Burning oak / willow logs', 30, 140000, -170000, 'High', 'Tick-timed burning of mid logs.', '', 44),
  m('Firemaking', 'burn-45', 'Burning maple / yew logs', 45, 250000, -300000, 'High', 'Tick-timed burning of maple and yew logs.', '', 74),
  m('Firemaking', 'wintertodt', 'Wintertodt', 50, 220000, 50000, 'Low', 'Best low-effort Firemaking xp with useful rewards. Rates rise from 161K to 320K.', ''),
  m('Firemaking', 'burn-75', 'Burning magic / yew logs', 75, 451000, -720000, 'High', 'Tick-timed burning of high logs.', '', 89),
  m('Firemaking', 'burn-90', 'Burning redwood logs', 90, 520000, -1000000, 'High', 'Tick-timed burning of redwood logs, the fastest standard Firemaking.', '', null, true),

  // --- Crafting ---
  m('Crafting', 'early', 'Leather & early items', 1, 25000, -50000, 'Low', 'Craft leather gloves, boots and armour.', '', 19),
  m('Crafting', 'opal-jewellery', 'Opal jewellery', 1, 45000, 420000, 'Low', 'Craft opal jewellery at a furnace for a good profit.', '', 26),
  m('Crafting', 'jade-jewellery', 'Jade jewellery', 13, 70000, 520000, 'Low', 'Craft jade jewellery at a furnace.', '', 33),
  m('Crafting', 'topaz-jewellery', 'Topaz jewellery', 16, 80000, 615000, 'Low', 'Craft topaz jewellery at a furnace.', '', 44),
  m('Crafting', 'flax-weaving', 'Spinning & weaving flax', 12, 28000, 423000, 'Low', 'Spin and weave flax on Fossil Island.', '', 38),
  m('Crafting', 'gems', 'Cutting sapphires', 20, 139000, -42000, 'Low', 'Cut sapphires at a bank for quick low-level xp.', '', 26),
  m('Crafting', 'drift-nets', 'Drift nets', 26, 60000, 358000, 'Low', 'Weave drift nets on Fossil Island.', '', 46),
  m('Crafting', 'emerald-cut', 'Cutting emeralds', 27, 188000, -206000, 'Low', 'Cut emeralds at a bank.', '', 33),
  m('Crafting', 'ruby-cut', 'Cutting rubies', 34, 236000, -322000, 'Low', 'Cut rubies at a bank.', '', 42),
  m('Crafting', 'diamond-cut', 'Cutting diamonds', 43, 299000, -1730000, 'Low', 'Cut diamonds at a bank.', '', 54),
  m('Crafting', 'dragonstone-cut', 'Cutting dragonstones', 55, 382000, -9680000, 'Low', 'The fastest Crafting up to 77 and a heavy gp cost.', '', 62, false),
  m('Crafting', 'glassblowing', 'Glassblowing', 46, 95000, -60000, 'Low', 'Blow molten glass into orbs and lantern lenses.', '', 86),
  m('Crafting', 'battlestaves', 'Battlestaves', 54, 290000, -700000, 'Low', 'Attach orbs to battlestaves at a bank.', '', 82),
  m('Crafting', 'dhide', 'Green dragonhide bodies', 63, 313000, -1990000, 'Low', 'Craft d\'hide bodies at a bank.', '', 70),
  m('Crafting', 'blue-dhide', 'Blue dragonhide bodies', 71, 354000, -3900000, 'Low', 'Craft d\'hide bodies at a bank.', '', 76),
  m('Crafting', 'red-dhide', 'Red dragonhide bodies', 77, 394000, -5400000, 'Low', 'Craft d\'hide bodies at a bank.', '', 83),
  m('Crafting', 'amethyst', 'Amethyst tips', 83, 165000, 115000, 'Low', 'Cut amethyst into dart tips.'),
  m('Crafting', 'black-dhide', 'Black dragonhide bodies', 84, 460000, -7500000, 'Low', 'The fastest standard Crafting xp, with tick manipulation.', '', null, true),
  m('Crafting', 'light-orbs', 'Light orbs (glassblowing)', 87, 122500, -143000, 'Low', 'Blow molten glass into empty light orbs.'),

  // --- Smithing ---
  m('Smithing', 'early', 'Bronze & iron items (anvil)', 1, 60000, -360000, 'Low', 'Smith bars into daggers, warhammers and platebodies at an anvil.', '', 39),
  m('Smithing', 'giants-foundry', 'Giants\' Foundry (bronze / iron)', 15, 98000, 140000, 'Medium', 'Minigame; rates and profit change with the bar tier.', 'Sleeping Giants', 29),
  m('Smithing', 'blast-iron', 'Blast Furnace (iron)', 15, 75000, 567000, 'Medium', 'Smelt iron bars at the Blast Furnace.', 'Blast Furnace access', 29),
  m('Smithing', 'cannonballs', 'Cannonballs', 35, 14000, 250000, 'Low', 'Smelt steel bars into cannonballs with an ammo mould.', 'Dwarf Cannon quest'),
  m('Smithing', 'giants-foundry-2', 'Giants\' Foundry (iron / steel)', 30, 134000, 119000, 'Medium', 'Minigame with decent rates and profit.', 'Sleeping Giants', 49),
  m('Smithing', 'blast-furnace', 'Blast Furnace (steel)', 30, 95000, 1660000, 'Medium', 'Smelt steel and mithril bars at the Blast Furnace for a strong profit.', 'Blast Furnace access', 69),
  m('Smithing', 'blast-gold', 'Blast Furnace (gold, gauntlets)', 40, 380000, -400000, 'High', 'The fastest Smithing xp. Cannot be done without goldsmith gauntlets.', 'Goldsmith gauntlets', null, true),
  m('Smithing', 'platebodies', 'Steel platebodies at the anvil', 48, 144000, -1437000, 'Low', 'Smith steel platebodies.', '', 67),
  m('Smithing', 'giants-foundry-3', 'Giants\' Foundry (steel / mithril)', 50, 165000, 60000, 'Medium', 'Minigame with strong xp.', 'Sleeping Giants', 69),
  m('Smithing', 'mithril-platebodies', 'Mithril platebodies at the anvil', 68, 200000, -1566000, 'Low', 'Smith mithril platebodies.', '', 87),
  m('Smithing', 'blast-adamant', 'Blast Furnace (adamantite)', 70, 101000, 2129000, 'Medium', 'Smelt adamantite bars for a strong profit.', 'Blast Furnace access', 84),
  m('Smithing', 'giants-foundry-4', 'Giants\' Foundry (mithril / adamantite)', 70, 198000, -42000, 'Medium', 'Minigame; roughly break-even.', 'Sleeping Giants', 84),
  m('Smithing', 'blast-runite', 'Blast Furnace (runite)', 85, 108000, 2458000, 'Medium', 'The best Blast Furnace profit at 85+.', 'Blast Furnace access'),
  m('Smithing', 'giants-foundry-5', 'Giants\' Foundry (adamantite / runite)', 85, 253000, -1615000, 'Medium', 'Minigame with high xp and high bar cost.', 'Sleeping Giants'),
  m('Smithing', 'adamant-platebodies', 'Adamant platebodies at the anvil', 88, 240000, 312000, 'Low', 'The only profitable anvil armour.'),

  // --- Herblore (rates assume about 2,500 potions an hour) ---
  m('Herblore', 'early', 'Early potions', 1, 150000, -1100000, 'Low', 'Attack, strength, restore and energy potions.', 'Druidic Ritual quest (gives your first level)', 37),
  m('Herblore', 'tar', 'Making tar', 19, 100000, -30000, 'Low', 'Swamp tar and herbs. By far the cheapest Herblore xp.', 'Swamp tar', 54),
  m('Herblore', 'prayer-pots', 'Prayer potions', 38, 218000, -358000, 'Low', 'Make prayer potions in bulk.', '', 44),
  m('Herblore', 'unf-finish', 'Super attack / energy / strength', 45, 290000, -900000, 'Low', 'Finish super potions at a bank.', '', 62),
  m('Herblore', 'irit-tar', 'Irit tar', 55, 170000, -136000, 'Low', 'Swamp tar and irit leaves, a cheap and steady method.'),
  m('Herblore', 'super-restore', 'Super restores', 63, 356000, -1420000, 'Low', 'Popular mid-level potion.', '', 71),
  m('Herblore', 'antifire', 'Antifire potions', 69, 394000, -2320000, 'Low', 'Fast mid-level potions.', '', 71),
  m('Herblore', 'ranging', 'Ranging potions', 72, 406000, -2490000, 'Low', 'Fast, popular mid-level potion.', '', 80),
  m('Herblore', 'magic-pots', 'Magic potions', 76, 431000, -3330000, 'Low', 'Fast late-game potion.', '', 80),
  m('Herblore', 'sara-brew', 'Saradomin brews', 81, 450000, -2910000, 'Low', 'Fast late-game herblore.', 'Saradomin brew ingredients', 87),
  m('Herblore', 'menaphite', 'Menaphite remedies', 88, 500000, -5200000, 'Low', 'Fast late-game potion.', '', 88),
  m('Herblore', 'armadyl-brew', 'Armadyl brews', 89, 563000, -6950000, 'Low', 'The fastest Herblore xp, and a big gp cost.', '', null, true),
  m('Herblore', 'super-combat', 'Super combat potions', 90, 375000, null, 'Low', 'Make super combats in bulk. No wiki rate, so approximate.'),

  // --- Construction ---
  m('Construction', 'mahogany-beginner', 'Mahogany Homes (Beginner contracts)', 1, 32000, -45000, 'Medium', 'Repair houses for Construction xp and carpenter points. You buy the planks.', 'Player-owned house', 19),
  m('Construction', 'oak-larders', 'Oak larders', 33, 400000, -3800000, 'Medium', 'Build and remove oak larders. Wiki: 480K to 500K with perfect clicks.', '', 51),
  m('Construction', 'mahogany-novice', 'Mahogany Homes (Novice contracts)', 20, 70000, -216000, 'Medium', 'Oak plank contracts. You buy the planks and steel bars.', 'Player-owned house', 49),
  m('Construction', 'mahogany-adept', 'Mahogany Homes (Adept contracts)', 50, 140000, -335000, 'Medium', 'Teak plank contracts. You buy the planks and steel bars.', 'Player-owned house', 69),
  m('Construction', 'mythical-capes', 'Mounted mythical capes', 50, 360000, -2200000, 'Medium', 'Build and remove mounted capes.', 'Dragon Slayer II', null),
  m('Construction', 'mahogany-tables', 'Mahogany tables', 52, 750000, -10000000, 'Medium', 'Build and remove mahogany tables with a demon butler. Wiki: up to 900K at the top.', '', 76),
  m('Construction', 'teak-benches', 'Teak garden benches', 66, 550000, -4600000, 'Medium', 'Build and remove teak garden benches.', '', 73),
  m('Construction', 'mahogany-homes', 'Mahogany Homes (Expert contracts)', 70, 177000, -872000, 'Medium', 'Mahogany plank contracts, the fastest contract tier. You buy the planks and steel bars.', 'Player-owned house'),
  m('Construction', 'oak-doors', 'Oak dungeon doors', 74, 520000, -4400000, 'Medium', 'Build and remove oak dungeon doors.', '', 76),
  m('Construction', 'gnome-benches', 'Gnome benches (superior garden)', 77, 1100000, -14600000, 'Medium', 'The fastest Construction in the game and one of the most expensive.', 'Superior garden, demon butler', null, true),

  // --- Runecraft ---
  m('Runecraft', 'early', 'Early altars (air / water / earth / fire)', 1, 20000, 0, 'Medium', 'Craft low-level runes at the nearest altar.', '', 22),
  m('Runecraft', 'ourania', 'Ourania Altar (ZMI)', 1, 55000, 375000, 'Medium', 'Lower-effort, high-profit runecrafting with a good setup.', 'Ourania Teleport, Magic 71'),
  m('Runecraft', 'tiaras', 'Talisman tiaras', 1, 45000, -1350000, 'High', 'Make tiaras for xp at low levels.', '', 50),
  m('Runecraft', 'lava', 'Lava runes', 23, 70000, 100000, 'High', 'Fast mid-level runecrafting.', 'Rune pouches, Fire altar access, Hat of the Eye recommended'),
  m('Runecraft', 'gotr', 'Guardians of the Rift', 27, 50000, 1077000, 'Medium', 'Minigame with good xp and the best low-level Runecraft profit.', 'Temple of the Eye'),
  m('Runecraft', 'nature', 'Nature runes (Abyss)', 44, 28000, 600000, 'High', 'Run nature runes through the Abyss.', '', 90),
  m('Runecraft', 'cosmic-double', 'Double cosmic runes', 59, 26000, 800000, 'High', 'Slow xp but good profit.', 'Lost City, colossal pouch'),
  m('Runecraft', 'blood', 'Blood runes (Arceuus)', 77, 36000, 900000, 'Low', 'Dense essence at Arceuus, profitable and low effort.', '38 Mining and 38 Crafting'),
  m('Runecraft', 'astral-double', 'Double astral runes', 82, 50000, 2000000, 'Medium', 'Double astral runes with the Lunar spellbook.', 'Lunar Diplomacy'),
  m('Runecraft', 'soul', 'Soul runes (Zeah)', 90, 44000, 705000, 'High', 'Run soul runes at the Soul Altar.', 'Soul Altar access'),
  m('Runecraft', 'aether', 'Aether runes (no runners)', 90, 99000, 1844000, 'Medium', 'Aether runes with a POH fairy ring, with the Raiments of the Eye.', 'Aether catalyst, 82 Magic'),
  m('Runecraft', 'nature-cape', 'Double nature runes (diary cape)', 91, 69000, 3875000, 'High', 'Twice as fast with the Achievement diary cape teleport.', 'Achievement diary cape, 79 Agility'),
  m('Runecraft', 'law-double', 'Double law runes', 95, 44000, 800000, 'Low', 'Low-effort double law runes.', 'Troll Stronghold'),
  m('Runecraft', 'wrath', 'Wrath runes', 95, 42000, 1650000, 'Medium', 'Wrath runes, one of the best late-game profits.', 'Dragon Slayer II, dragonfire protection'),

  // --- Agility ---
  m('Agility', 'gnome', 'Gnome Stronghold Course', 1, 8000, 0, 'Medium', 'Starter course.', '', 9),
  m('Agility', 'draynor', 'Draynor Village Rooftop', 10, 9500, 0, 'Medium', 'First rooftop course.', '', 19),
  m('Agility', 'al-kharid', 'Al Kharid Rooftop', 20, 11500, 0, 'Medium', 'Low-level rooftop.', '', 29),
  m('Agility', 'brimhaven', 'Brimhaven Agility Arena', 20, 36000, 0, 'Low', 'Very low-intensity spikes. Costs a 200 gp entry fee.', '200 coins entry', 46),
  m('Agility', 'varrock', 'Varrock Rooftop', 30, 12500, 0, 'Medium', 'Reliable early rooftop with marks of grace.', '', 39),
  m('Agility', 'pyramid', 'Agility Pyramid', 30, 30000, 130000, 'Medium', 'Active pyramid runs that pay out in coin pouches.', 'Desert access', 69),
  m('Agility', 'canifis', 'Canifis Rooftop', 40, 15500, 0, 'Medium', 'Better xp than Varrock.', '', 49),
  m('Agility', 'shayzien', 'Shayzien Advanced Course', 45, 30000, 0, 'Medium', 'Crossbow and mith grapple course.', '', 59),
  m('Agility', 'ape-atoll', 'Ape Atoll Agility Course', 48, 40000, 0, 'Medium', 'Course with solid xp for the level.', 'Monkey Madness I, ninja monkey greegree', 59),
  m('Agility', 'falador', 'Falador Rooftop', 50, 31500, 0, 'Medium', 'Strong mid-level xp, no quest requirement.', '', 59),
  m('Agility', 'colossal-wyrm', 'Colossal Wyrm Agility Course', 50, 31000, null, 'Medium', 'Varlamore course with amylase pack rewards.', '', 61),
  m('Agility', 'sepulchre', 'Hallowed Sepulchre (floors 1 and 2)', 52, 50000, null, 'High', 'Active runs with coffin loot and rising xp per floor.', 'Hallowed Sepulchre access', 71),
  m('Agility', 'wilderness', 'Wilderness Agility Course', 52, 55000, 1991000, 'Medium', 'Course with strong xp and a big profit from Wilderness loot.', 'Wilderness access', 71),
  m('Agility', 'seers', 'Seers\' Village Rooftop', 60, 53000, 0, 'Medium', 'Easy rooftop, no quest requirement.', '', 69),
  m('Agility', 'werewolf', 'Werewolf Agility Course', 60, 58000, 0, 'Medium', 'Strong mid-level xp.', 'Creature of Fenkenstrain', 79),
  m('Agility', 'colossal-wyrm-adv', 'Colossal Wyrm Agility (advanced)', 62, 42000, null, 'Medium', 'Advanced Varlamore course.', '', 79),
  m('Agility', 'pollnivneach', 'Pollnivneach Rooftop', 70, 55000, 0, 'Medium', 'Mid-level rooftop.', '', 79),
  m('Agility', 'pyramid-high', 'Agility Pyramid (high level)', 70, 44000, 260000, 'Medium', 'Faster pyramid runs with better coin pouches.', 'Desert access', 89),
  m('Agility', 'prifddinas', 'Prifddinas Agility Course', 75, 62000, 0, 'Medium', 'Reliable, low-click course. Crystal shards are a bonus but are not counted as profit.', 'Song of the Elves', 89),
  m('Agility', 'sepulchre-4', 'Hallowed Sepulchre (floor 4)', 77, 80000, 891000, 'High', 'Strong xp and a good profit from coffins.', 'Hallowed Sepulchre access', 86),
  m('Agility', 'rellekka', 'Rellekka Rooftop', 80, 61000, 0, 'Medium', 'Rooftop with good xp rates.', '', 89),
  m('Agility', 'sepulchre-5', 'Hallowed Sepulchre (floor 5)', 87, 98500, 1551000, 'High', 'The fastest Agility from 87, and very profitable.', 'Hallowed Sepulchre access', null, true),
  m('Agility', 'ardougne', 'Ardougne Rooftop', 90, 68000, 0, 'Medium', 'Best no-quest rooftop course.', ''),

  // --- Thieving ---
  m('Thieving', 'early', 'Men, women & early stalls', 1, 20000, 0, 'Medium', 'Pickpocket men or steal from the baker\u2019s stall.', '', 4),
  m('Thieving', 'bakery', 'Bakery stalls (Ardougne)', 5, 19200, 0, 'Medium', 'Steal from the Ardougne bakery stall.', '', 24),
  m('Thieving', 'hosidius-stalls', 'Hosidius fruit stalls', 25, 42750, 0, 'Medium', 'Two fruit stalls in Hosidius.', '', 49),
  m('Thieving', 'master-farmers', 'Master Farmers', 38, 30000, 150000, 'Low', 'Pickpocket Master Farmers for xp and seeds.', '', 93),
  m('Thieving', 'blackjack', 'Blackjacking (Menaphite thugs)', 45, 180000, 77000, 'High', 'Active blackjacking in Pollnivneach.', 'Desert access'),
  m('Thieving', 'artefacts', 'Stealing artefacts (Port Piscarilius)', 49, 200000, 45000, 'High', 'Heist runs with strong xp and a little loot.', 'Port Piscarilius access'),
  m('Thieving', 'varlamore-valuables', 'Varlamore valuables', 50, 90000, 110000, 'Low', 'Low-effort valuables in Varlamore.', 'Children of the Sun'),
  m('Thieving', 'knights', 'Knights of Ardougne', 55, 130000, 100000, 'Medium', 'Pickpocket knights, no quest requirement.'),
  m('Thieving', 'sorceress-garden', 'Sorceress\u2019s Garden', 65, 140000, null, 'Low', 'Pick fruit in the Summer garden.', '65 Thieving, 45 Herblore'),
  m('Thieving', 'pyramid', 'Pyramid Plunder', 71, 125000, 200000, 'Medium', 'Strong Thieving xp with loot, rates rise with level.', 'Pyramid Plunder access', 80),
  m('Thieving', 'dorgesh-chests', 'Dorgesh-Kaan rich chests', 78, 220000, 300000, 'Medium', 'Fast chest looting.', 'Death to the Dorgeshuun'),
  m('Thieving', 'vyres', 'Vyres in Darkmeyer', 82, 150000, 2866000, 'Low', 'Fast, low-click pickpocketing with strong profit.', 'Sins of the Father', 83),
  m('Thieving', 'rogues-castle', 'Rogues\' Castle chests (Wilderness)', 84, 275000, 2450000, 'High', 'The fastest Thieving from 84. Wilderness risk.', 'Wilderness access', null, true),
  m('Thieving', 'elves', 'Elves in Prifddinas', 85, 150000, 3961000, 'Medium', 'Pickpocket elves for strong xp and top-tier pay.', 'Song of the Elves'),
  m('Thieving', 'master-farmers-high', 'Master Farmers (high level)', 94, 117500, 869000, 'Low', 'Master Farmers at 94 for strong xp and seed profit.'),

  // --- Sailing (new skill, the wiki page is flagged out of date, so these are rough) ---
  m('Sailing', 'courier', 'Courier tasks (starter routes)', 1, 12000, null, 'Low', 'Deliver cargo between nearby ports.', '', 44),
  m('Sailing', 'salvage-small', 'Small shipwrecks', 15, 2400, null, 'Low', 'Salvage small wrecks.', '', 25),
  m('Sailing', 'salvage-fisherman', 'Fisherman\u2019s shipwrecks', 26, 5200, null, 'Low', 'Salvage fisherman wrecks.', '', 34),
  m('Sailing', 'trials-tempor', 'Barracuda Trial: Tempor Tantrum', 30, 22000, null, 'High', 'First Barracuda Trial.', '', 54),
  m('Sailing', 'salvage-barracuda', 'Barracuda shipwrecks', 35, 13000, null, 'Low', 'Salvage barracuda wrecks.', '', 52),
  m('Sailing', 'courier-summer-shore', 'Courier route: Summer Shore', 45, 20000, null, 'Low', 'Summer Shore delivery route.', 'Troubled Tortugans', 61),
  m('Sailing', 'salvage-large', 'Large shipwrecks', 53, 24000, null, 'Low', 'Salvage large wrecks.', '', 63),
  m('Sailing', 'trials-jubbly', 'Barracuda Trial: Jubbly Jive', 55, 80000, null, 'High', 'Mid-level Barracuda Trial.', '', 71),
  m('Sailing', 'courier-rellekka', 'Courier route: Rellekka', 62, 66000, null, 'Low', 'Rellekka delivery route.', '', 69),
  m('Sailing', 'salvage-pirate', 'Pirate shipwrecks', 64, 41000, null, 'Low', 'Salvage pirate wrecks.', '', 72),
  m('Sailing', 'courier-prifddinas', 'Courier route: Prifddinas', 70, 74000, null, 'Low', 'Prifddinas delivery route.', 'Song of the Elves', 75),
  m('Sailing', 'trials', 'Barracuda Trial: Gwenith Glide', 72, 150000, null, 'High', 'Fastest Sailing xp currently known.', 'Rosewood hull for best rates', null, true),
  m('Sailing', 'salvage-mercenary', 'Mercenary shipwrecks', 73, 62000, null, 'Low', 'Salvage mercenary wrecks.', '', 79),
  m('Sailing', 'courier-lunar', 'Courier route: Lunar Isle', 76, 145000, null, 'Low', 'Lunar Isle delivery route with many tasks.', '', null),
  m('Sailing', 'salvage-fremennik', 'Fremennik shipwrecks', 80, 75000, null, 'Low', 'Salvage Fremennik wrecks.', '', 86),
  m('Sailing', 'salvage-merchant', 'Merchant shipwrecks', 87, 82000, null, 'Low', 'Salvage merchant wrecks.'),
]

export function methodsForSkill(skill) {
  return TRAINING_METHODS.filter((meth) => meth.skill === skill).sort((a, b) => a.minLevel - b.minLevel)
}

export function getMethod(id) {
  return TRAINING_METHODS.find((meth) => meth.id === id) || null
}

/** Methods for a skill with at least one catalog entry, others fall back to a custom xp/hr. */
export function skillsWithMethods() {
  return [...new Set(TRAINING_METHODS.map((meth) => meth.skill))]
}
