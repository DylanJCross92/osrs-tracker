// A static, level-bracketed guide to the fastest way to train each skill,
// plus the best money-making method at that level where one exists (several
// skills are pure gp sinks — chasing speed costs money, it doesn't make
// any). Brackets are the common level-gated method unlocks the OSRS
// community generally agrees on; exact xp/gp rates shift with game updates,
// so these stay qualitative rather than quoting numbers that would go stale.
//
// Shape: SKILL -> [{ min, fastest, money }, ...] sorted ascending by `min`.
// `money` is null when there's no real profit angle at that level.
export const TRAINING_GUIDE = {
  Attack: [
    { min: 1, fastest: 'Melee low-level monsters (chickens, cows, goblins) with the best scimitar you can wield.', money: null },
    { min: 40, fastest: 'Rock Crabs (Rellekka) or Ammonite Crabs (Fossil Island) — low-defence monsters you can AFK for long stretches.', money: null },
    { min: 70, fastest: 'Nightmare Zone with absorption potions, or Slayer tasks for combat xp plus loot.', money: 'Slayer task drops (herbs, raw materials, occasional uniques) usually cover your supplies and then some.' },
  ],
  Strength: [
    { min: 1, fastest: 'Melee low-level monsters (chickens, cows, goblins) with the best weapon you can wield.', money: null },
    { min: 40, fastest: 'Rock Crabs or Ammonite Crabs for AFK strength training.', money: null },
    { min: 70, fastest: 'Nightmare Zone with absorption potions, or Slayer tasks.', money: 'Slayer task drops usually cover supplies and net a profit.' },
  ],
  Defence: [
    { min: 1, fastest: 'Melee low-level monsters with the best armour you can wear — Defence trains fastest alongside Attack/Strength, not alone.', money: null },
    { min: 40, fastest: 'Rock Crabs or Ammonite Crabs for AFK defensive training.', money: null },
    { min: 70, fastest: 'Nightmare Zone with absorption potions, or Slayer tasks.', money: 'Slayer task drops usually cover supplies and net a profit.' },
  ],
  Hitpoints: [
    { min: 1, fastest: 'Hitpoints trains automatically from any combat — just fight whatever your other combat stats are ready for.', money: null },
    { min: 40, fastest: 'Rock Crabs or Ammonite Crabs give steady AFK combat (and Hitpoints) xp.', money: null },
    { min: 70, fastest: 'Nightmare Zone or Slayer tasks for fast, sustained combat xp.', money: 'Slayer task drops usually cover supplies and net a profit.' },
  ],
  Ranged: [
    { min: 1, fastest: 'Shoot low-level monsters with a shortbow and bronze/iron arrows.', money: null },
    { min: 40, fastest: 'Rock Crabs or Ammonite Crabs with ranged weapons for AFK xp.', money: null },
    { min: 55, fastest: 'Chinning (Red, then Black at 80) at a multi-target spot like the Ape Atoll dungeon — the fastest ranged xp in the game.', money: 'Chinchompas you catch yourself via Hunter are heavily in demand for exactly this method — see Hunter.' },
  ],
  Prayer: [
    { min: 1, fastest: 'Bury or offer bones as you get them; not worth detouring for until you can afford bulk bones.', money: null },
    { min: 43, fastest: 'Buy bones in bulk and use the Chaos Altar in the Wilderness (free, 2.5x xp) or a Gilded Altar in a player-owned house.', money: null },
    { min: 70, fastest: 'Dragon bones (or Superior dragon bones once unlocked) at the Chaos Altar or a Gilded Altar for the best xp/hr.', money: null },
  ],
  Magic: [
    { min: 1, fastest: 'Cast combat spells (Strike/Bolt spells) on low-level monsters, or Splash safely on something that can’t hurt you for free unlimited AFK casts.', money: null },
    { min: 55, fastest: 'Keep Splashing for AFK xp, or cast higher-tier combat spells on Slayer tasks.', money: null },
    { min: 80, fastest: 'High Alchemy on a safe spot while doing something else, or Fire Surge Splashing for the best AFK xp/hr.', money: 'High Alch items bought just below their alch price for a small per-cast profit — thin margins, but it offsets the nature rune cost.' },
  ],
  Cooking: [
    { min: 1, fastest: 'Cook shrimp and trout on a range.', money: null },
    { min: 30, fastest: 'Cook higher-tier fish (salmon, tuna, lobster) on a range in bulk.', money: null },
    { min: 68, fastest: 'Cook at the Hosidius kitchen (10% lower burn chance) with cooking gauntlets for sharks or karambwans — very fast, very low burn rate.', money: 'Karambwans often sell for more cooked than raw — a rare case where fast Cooking xp is also profitable, due to steady PvM demand.' },
  ],
  Woodcutting: [
    { min: 1, fastest: 'Chop regular then oak trees near a bank.', money: null },
    { min: 30, fastest: 'Willow trees — great AFK xp, drop logs or bank them.', money: null },
    { min: 60, fastest: 'Yew trees, or Teak/Mahogany trees on Fossil Island once you can reach them.', money: 'Yew and Magic logs sell reliably on the Grand Exchange — one of the more dependable profitable skilling methods.' },
  ],
  Fletching: [
    { min: 1, fastest: 'Cut arrow shafts from logs, or fletch unstrung bows from the logs you chop.', money: null },
    { min: 40, fastest: 'Fletch and string bows in bulk at a bank — very fast per-click xp.', money: null },
    { min: 70, fastest: 'String Magic longbows (or whatever bow matches your Woodcutting logs) for the best xp/hr.', money: 'Usually a net cost — Fletching is typically trained as a byproduct of logs you already chopped yourself, not bought fresh.' },
  ],
  Fishing: [
    { min: 1, fastest: 'Net shrimp and anchovies at any fishing spot.', money: null },
    { min: 20, fastest: 'Fly fish for trout and salmon at Barbarian Village — fast and close to a bank.', money: null },
    { min: 50, fastest: 'Fish at the Fishing Guild (monkfish, then sharks at 76), or play Tempoross for xp and useful rewards.', money: 'Sharks and Anglerfish sell consistently — high-level Fishing is one of the most reliable low-effort money makers in the game.' },
  ],
  Firemaking: [
    { min: 1, fastest: 'Burn logs in bulk — regular, then oak, then willow as you level.', money: null },
    { min: 50, fastest: 'Play Wintertodt — the best Firemaking xp/hr by far, plus supply crates and burnt bones for Prayer.', money: 'Wintertodt supply crates have some resale/use value, but Firemaking is mostly a gold sink — don’t expect real profit.' },
  ],
  Crafting: [
    { min: 1, fastest: 'Cut gems or craft leather gloves/boots.', money: null },
    { min: 30, fastest: 'Craft leather armour pieces (studded/green d’hide) or glassblow molten glass into items.', money: null },
    { min: 82, fastest: 'Cut amethyst into bolt tips, arrowtips, or javelin heads — fast, simple, click-light xp.', money: 'Amethyst products and green d’hide armour both have steady sell margins over their raw material cost.' },
  ],
  Smithing: [
    { min: 1, fastest: 'Smith bars into daggers or other cheap items at an anvil.', money: null },
    { min: 35, fastest: 'Smith steel bars into cannonballs — fast, simple, and bar cost is largely recovered.', money: 'Cannonballs are a classic reliable Smithing money maker: buy steel bars, smith, sell for a steady margin.' },
  ],
  Mining: [
    { min: 1, fastest: 'Power-mine copper/tin, then iron, dropping ore instead of banking it.', money: null },
    { min: 30, fastest: 'Motherlode Mine for pay-dirt — good xp plus gold nuggets.', money: 'Motherlode Mine’s gold nuggets provide a steady, if modest, side income while you train.' },
    { min: 55, fastest: 'Blast Mine for fast xp and Mining gear points, or Amethyst at 92 for great AFK xp.', money: 'Amethyst (92+) sells well for very low effort — one of the best low-attention Mining money makers.' },
  ],
  Herblore: [
    { min: 1, fastest: 'Make unfinished potions (herb + water vial), then finish them in a second pass — splitting the two steps gives more total xp.', money: null },
    { min: 40, fastest: 'Make whatever mid-tier potion you have the level and ingredients for — combat and restore potions are reliably in demand.', money: 'Finished potions (Super strength, Prayer potions, etc.) often sell for more than their ingredients cost — Herblore is one of the few skills that reliably profits while training.' },
    { min: 90, fastest: 'Make Super combat potions or Saradomin brews in bulk.', money: 'Super combat potions in particular have a strong, consistent profit margin at this level.' },
  ],
  Agility: [
    { min: 1, fastest: 'Gnome Stronghold Agility Course.', money: null },
    { min: 30, fastest: 'Varrock, then Canifis and Falador rooftop courses as you level.', money: null },
    { min: 52, fastest: 'Hallowed Sepulchre — great xp and it drops useful loot, though it needs more active play than a rooftop lap.', money: 'Hallowed Sepulchre loot (marks of grace, hallowed items) gives Agility training a real, if modest, profit angle.' },
    { min: 60, fastest: 'Ardougne rooftop course, moving to the Prifddinas course at 75 for the best xp/hr in the game.', money: null },
  ],
  Thieving: [
    { min: 1, fastest: 'Pickpocket Men/Women, or steal from the baker’s stall.', money: null },
    { min: 38, fastest: 'Pickpocket Master Farmers.', money: 'Master Farmer pockets often contain valuable seeds (ranarr, snapdragon, etc.) worth well more than the time spent.' },
    { min: 55, fastest: 'Pickpocket vampyres in Darkmeyer (post-quest) for excellent AFK-ish xp.', money: 'Vampyre pockets are consistently valuable — strong xp and profit together.' },
    { min: 91, fastest: 'Pyramid Plunder for some of the best Thieving xp/hr in the game.', money: null },
  ],
  Slayer: [
    { min: 1, fastest: 'Take tasks from the Slayer Master matching your combat level, and use points to skip or extend tasks rather than grinding bad ones out.', money: 'Slayer is widely considered one of the best all-round money makers — task loot (herbs, bars, uniques) routinely covers supplies and turns a solid profit, especially from tier-appropriate masters like Nieve or Konar.' },
  ],
  Farming: [
    { min: 1, fastest: 'Plant whatever herb/allotment patches you can reach on your way past them — Farming rewards consistency over grinding.', money: null },
    { min: 32, fastest: 'Run a full herb circuit (ranarr, then better herbs as you level) every chance you get.', money: 'Herb farming is one of the best low-effort money makers in the game — a few minutes per run for a crop worth far more than the seed and compost cost.' },
    { min: 60, fastest: 'Add tree and fruit tree runs for large lump-sum xp alongside your herb patches.', money: 'Higher-tier herbs (snapdragon, torstol) scale the same low-effort profit up further.' },
  ],
  Runecraft: [
    { min: 1, fastest: 'Craft whichever elemental rune (air, water, earth, fire) matches your level at the nearest altar.', money: null },
    { min: 44, fastest: 'Nature or Astral runes via the Abyss with pouches for faster trips.', money: 'Nature running (via the Abyss) is a classic, very consistent Runecraft money maker.' },
    { min: 77, fastest: 'Blood runes via the Abyss, or Guardians of the Rift for a good mix of xp and rewards.', money: 'Blood running is one of the most profitable gp/hr methods in Runecraft at this level.' },
  ],
  Hunter: [
    { min: 1, fastest: 'Catch birds with bird snares.', money: null },
    { min: 63, fastest: 'Box-trap Red Chinchompas.', money: 'Chinchompas sell briskly — they’re in constant demand for Ranged training, so this method pays for itself and then some.' },
    { min: 80, fastest: 'Box-trap Black Chinchompas — the best Hunter xp/hr in the game.', money: 'Black chinchompas have an even higher sell value, making this the best combined xp-and-profit Hunter method.' },
  ],
  Construction: [
    { min: 1, fastest: 'Build then immediately remove cheap furniture (e.g. Oak Larders) in your player-owned house — repeat for fast, simple xp.', money: null },
    { min: 50, fastest: 'Build and remove Mahogany tables for a strong xp-per-gp ratio.', money: null },
    { min: 85, fastest: 'Build and remove Magic wardrobes for the best Construction xp/hr.', money: null },
  ],
}

/**
 * The guide entry whose bracket the given level falls into — the richest
 * bracket with `min <= level`, or the first bracket if the level is below
 * all of them. Null for skills with no guide (currently just Overall).
 */
export function getTrainingAdvice(skill, level) {
  const brackets = TRAINING_GUIDE[skill]
  if (!brackets || !brackets.length) return null
  let match = brackets[0]
  for (const bracket of brackets) {
    if (level >= bracket.min) match = bracket
  }
  return match
}
