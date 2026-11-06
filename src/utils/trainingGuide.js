import { xpForLevel } from './osrsSkills'

// A static, level-bracketed guide to the fastest way to train each skill,
// plus the best money-making method at that level where one exists (several
// skills are pure gp sinks — chasing speed costs money, it doesn't make
// any). Brackets are the common level-gated method unlocks the OSRS
// community generally agrees on.
//
// xpPerAction is an approximate, rounded xp value for one unit of the
// `fastest` method (one log chopped, one potion made, one kill, ...) —
// exact for most gathering/production skills (those xp values are fixed
// game constants), approximate for anything damage- or drop-based (melee
// training, Slayer). xpPerHour is a rough, widely-cited xp/hr rate for that
// same method, used only to turn xp-to-next-level into a ballpark time
// estimate — both are meant as a quick ballpark, not a precision xp tracker.
//
// Shape: SKILL -> [{ min, fastest, xpPerAction, xpPerHour, actionLabel, money }, ...]
// sorted ascending by `min`. `money` is null when there's no real profit
// angle at that level.
export const TRAINING_GUIDE = {
  Attack: [
    { min: 1, fastest: 'Melee low-level monsters (chickens, cows, goblins) with the best scimitar you can wield.', xpPerAction: 20, xpPerHour: 15000, actionLabel: 'low-level monsters killed', money: null },
    { min: 40, fastest: 'Rock Crabs (Rellekka) or Ammonite Crabs (Fossil Island) — low-defence monsters you can AFK for long stretches.', xpPerAction: 45, xpPerHour: 35000, actionLabel: 'crabs killed', money: null },
    { min: 70, fastest: 'Nightmare Zone with absorption potions, or Slayer tasks for combat xp plus loot.', xpPerAction: 90, xpPerHour: 40000, actionLabel: 'monsters killed', money: 'Slayer task drops (herbs, raw materials, occasional uniques) usually cover your supplies and then some.' },
  ],
  Strength: [
    { min: 1, fastest: 'Melee low-level monsters (chickens, cows, goblins) with the best weapon you can wield.', xpPerAction: 20, xpPerHour: 15000, actionLabel: 'low-level monsters killed', money: null },
    { min: 40, fastest: 'Rock Crabs or Ammonite Crabs for AFK strength training.', xpPerAction: 45, xpPerHour: 35000, actionLabel: 'crabs killed', money: null },
    { min: 70, fastest: 'Nightmare Zone with absorption potions, or Slayer tasks.', xpPerAction: 90, xpPerHour: 40000, actionLabel: 'monsters killed', money: 'Slayer task drops usually cover supplies and net a profit.' },
  ],
  Defence: [
    { min: 1, fastest: 'Melee low-level monsters with the best armour you can wear — Defence trains fastest alongside Attack/Strength, not alone.', xpPerAction: 20, xpPerHour: 15000, actionLabel: 'low-level monsters killed', money: null },
    { min: 40, fastest: 'Rock Crabs or Ammonite Crabs for AFK defensive training.', xpPerAction: 45, xpPerHour: 35000, actionLabel: 'crabs killed', money: null },
    { min: 70, fastest: 'Nightmare Zone with absorption potions, or Slayer tasks.', xpPerAction: 90, xpPerHour: 40000, actionLabel: 'monsters killed', money: 'Slayer task drops usually cover supplies and net a profit.' },
  ],
  Hitpoints: [
    { min: 1, fastest: 'Hitpoints trains automatically from any combat — just fight whatever your other combat stats are ready for.', xpPerAction: 27, xpPerHour: 20000, actionLabel: 'low-level monsters killed', money: null },
    { min: 40, fastest: 'Rock Crabs or Ammonite Crabs give steady AFK combat (and Hitpoints) xp.', xpPerAction: 60, xpPerHour: 40000, actionLabel: 'crabs killed', money: null },
    { min: 70, fastest: 'Nightmare Zone or Slayer tasks for fast, sustained combat xp.', xpPerAction: 120, xpPerHour: 45000, actionLabel: 'monsters killed', money: 'Slayer task drops usually cover supplies and net a profit.' },
  ],
  Ranged: [
    { min: 1, fastest: 'Shoot low-level monsters with a shortbow and bronze/iron arrows.', xpPerAction: 20, xpPerHour: 15000, actionLabel: 'monsters shot', money: null },
    { min: 40, fastest: 'Rock Crabs or Ammonite Crabs with ranged weapons for AFK xp.', xpPerAction: 45, xpPerHour: 35000, actionLabel: 'crabs shot', money: null },
    { min: 55, fastest: 'Chinning (Red, then Black at 80) at a multi-target spot like the Ape Atoll dungeon — the fastest ranged xp in the game.', xpPerAction: 170, xpPerHour: 350000, actionLabel: 'chinchompas thrown', money: 'Chinchompas you catch yourself via Hunter are heavily in demand for exactly this method — see Hunter.' },
  ],
  Prayer: [
    { min: 1, fastest: 'Bury or offer bones as you get them; not worth detouring for until you can afford bulk bones.', xpPerAction: 5, xpPerHour: 10000, actionLabel: 'bones offered', money: null },
    { min: 43, fastest: 'Buy bones in bulk and use the Chaos Altar in the Wilderness (free, 2.5x xp) or a Gilded Altar in a player-owned house.', xpPerAction: 38, xpPerHour: 200000, actionLabel: 'big bones offered', money: null },
    { min: 70, fastest: 'Dragon bones (or Superior dragon bones once unlocked) at the Chaos Altar or a Gilded Altar for the best xp/hr.', xpPerAction: 180, xpPerHour: 600000, actionLabel: 'dragon bones offered', money: null },
  ],
  Magic: [
    { min: 1, fastest: 'Cast combat spells (Strike/Bolt spells) on low-level monsters, or Splash safely on something that can’t hurt you for free unlimited AFK casts.', xpPerAction: 8, xpPerHour: 15000, actionLabel: 'spells cast', money: null },
    { min: 55, fastest: 'Keep Splashing for AFK xp, or cast higher-tier combat spells on Slayer tasks.', xpPerAction: 30, xpPerHour: 30000, actionLabel: 'spells cast', money: null },
    { min: 80, fastest: 'High Alchemy on a safe spot while doing something else, or Fire Surge Splashing for the best AFK xp/hr.', xpPerAction: 65, xpPerHour: 80000, actionLabel: 'items High Alched', money: 'High Alch items bought just below their alch price for a small per-cast profit — thin margins, but it offsets the nature rune cost.' },
  ],
  Cooking: [
    { min: 1, fastest: 'Cook shrimp and trout on a range.', xpPerAction: 40, xpPerHour: 40000, actionLabel: 'fish cooked', money: null },
    { min: 30, fastest: 'Cook higher-tier fish (salmon, tuna, lobster) on a range in bulk.', xpPerAction: 95, xpPerHour: 70000, actionLabel: 'fish cooked', money: null },
    { min: 68, fastest: 'Cook at the Hosidius kitchen (10% lower burn chance) with cooking gauntlets for sharks or karambwans — very fast, very low burn rate.', xpPerAction: 190, xpPerHour: 300000, actionLabel: 'karambwans cooked', money: 'Karambwans often sell for more cooked than raw — a rare case where fast Cooking xp is also profitable, due to steady PvM demand.' },
  ],
  Woodcutting: [
    { min: 1, fastest: 'Chop regular then oak trees near a bank.', xpPerAction: 30, xpPerHour: 15000, actionLabel: 'logs chopped', money: null },
    { min: 30, fastest: 'Willow trees — great AFK xp, drop logs or bank them.', xpPerAction: 68, xpPerHour: 35000, actionLabel: 'willow logs chopped', money: null },
    { min: 60, fastest: 'Yew trees, or Teak/Mahogany trees on Fossil Island once you can reach them.', xpPerAction: 175, xpPerHour: 45000, actionLabel: 'yew logs chopped', money: 'Yew and Magic logs sell reliably on the Grand Exchange — one of the more dependable profitable skilling methods.' },
  ],
  Fletching: [
    { min: 1, fastest: 'Cut arrow shafts from logs, or fletch unstrung bows from the logs you chop.', xpPerAction: 5, xpPerHour: 15000, actionLabel: 'arrow shafts cut', money: null },
    { min: 40, fastest: 'Fletch and string bows in bulk at a bank — very fast per-click xp.', xpPerAction: 50, xpPerHour: 450000, actionLabel: 'bows fletched/strung', money: null },
    { min: 70, fastest: 'String Magic longbows (or whatever bow matches your Woodcutting logs) for the best xp/hr.', xpPerAction: 83, xpPerHour: 400000, actionLabel: 'longbows strung', money: 'Usually a net cost — Fletching is typically trained as a byproduct of logs you already chopped yourself, not bought fresh.' },
  ],
  Fishing: [
    { min: 1, fastest: 'Net shrimp and anchovies at any fishing spot.', xpPerAction: 25, xpPerHour: 20000, actionLabel: 'fish caught', money: null },
    { min: 20, fastest: 'Fly fish for trout and salmon at Barbarian Village — fast and close to a bank.', xpPerAction: 60, xpPerHour: 40000, actionLabel: 'fish caught', money: null },
    { min: 50, fastest: 'Fish at the Fishing Guild (monkfish, then sharks at 76), or play Tempoross for xp and useful rewards.', xpPerAction: 115, xpPerHour: 35000, actionLabel: 'fish caught', money: 'Sharks and Anglerfish sell consistently — high-level Fishing is one of the most reliable low-effort money makers in the game.' },
  ],
  Firemaking: [
    { min: 1, fastest: 'Burn logs in bulk — regular, then oak, then willow as you level.', xpPerAction: 45, xpPerHour: 40000, actionLabel: 'logs burned', money: null },
    { min: 50, fastest: 'Play Wintertodt — the best Firemaking xp/hr by far, plus supply crates and burnt bones for Prayer.', xpPerAction: 350, xpPerHour: 50000, actionLabel: 'braziers lit (Wintertodt)', money: 'Wintertodt supply crates have some resale/use value, but Firemaking is mostly a gold sink — don’t expect real profit.' },
  ],
  Crafting: [
    { min: 1, fastest: 'Cut gems or craft leather gloves/boots.', xpPerAction: 15, xpPerHour: 20000, actionLabel: 'items crafted', money: null },
    { min: 30, fastest: 'Craft leather armour pieces (studded/green d’hide) or glassblow molten glass into items.', xpPerAction: 55, xpPerHour: 35000, actionLabel: 'items crafted', money: null },
    { min: 82, fastest: 'Cut amethyst into bolt tips, arrowtips, or javelin heads — fast, simple, click-light xp.', xpPerAction: 4, xpPerHour: 60000, actionLabel: 'amethyst tips/heads cut', money: 'Amethyst products and green d’hide armour both have steady sell margins over their raw material cost.' },
  ],
  Smithing: [
    { min: 1, fastest: 'Smith bars into daggers or other cheap items at an anvil.', xpPerAction: 12, xpPerHour: 30000, actionLabel: 'items smithed', money: null },
    { min: 35, fastest: 'Smith steel bars into cannonballs — fast, simple, and bar cost is largely recovered.', xpPerAction: 1, xpPerHour: 35000, actionLabel: 'cannonballs smithed', money: 'Cannonballs are a classic reliable Smithing money maker: buy steel bars, smith, sell for a steady margin.' },
  ],
  Mining: [
    { min: 1, fastest: 'Power-mine copper/tin, then iron, dropping ore instead of banking it.', xpPerAction: 25, xpPerHour: 30000, actionLabel: 'ore mined', money: null },
    { min: 30, fastest: 'Motherlode Mine for pay-dirt — good xp plus gold nuggets.', xpPerAction: 60, xpPerHour: 40000, actionLabel: 'pay-dirt mined', money: 'Motherlode Mine’s gold nuggets provide a steady, if modest, side income while you train.' },
    { min: 55, fastest: 'Blast Mine for fast xp and Mining gear points, or Amethyst at 92 for great AFK xp.', xpPerAction: 100, xpPerHour: 70000, actionLabel: 'ore mined (Blast Mine)', money: 'Amethyst (92+) sells well for very low effort — one of the best low-attention Mining money makers.' },
  ],
  Herblore: [
    { min: 1, fastest: 'Make unfinished potions (herb + water vial), then finish them in a second pass — splitting the two steps gives more total xp.', xpPerAction: 15, xpPerHour: 90000, actionLabel: 'potions made', money: null },
    { min: 40, fastest: 'Make whatever mid-tier potion you have the level and ingredients for — combat and restore potions are reliably in demand.', xpPerAction: 50, xpPerHour: 100000, actionLabel: 'potions made', money: 'Finished potions (Super strength, Prayer potions, etc.) often sell for more than their ingredients cost — Herblore is one of the few skills that reliably profits while training.' },
    { min: 90, fastest: 'Make Super combat potions or Saradomin brews in bulk.', xpPerAction: 150, xpPerHour: 150000, actionLabel: 'potions made', money: 'Super combat potions in particular have a strong, consistent profit margin at this level.' },
  ],
  Agility: [
    { min: 1, fastest: 'Gnome Stronghold Agility Course.', xpPerAction: 60, xpPerHour: 30000, actionLabel: 'laps', money: null },
    { min: 30, fastest: 'Varrock, then Canifis and Falador rooftop courses as you level.', xpPerAction: 250, xpPerHour: 45000, actionLabel: 'laps', money: null },
    { min: 52, fastest: 'Hallowed Sepulchre — great xp and it drops useful loot, though it needs more active play than a rooftop lap.', xpPerAction: 500, xpPerHour: 60000, actionLabel: 'Sepulchre laps', money: 'Hallowed Sepulchre loot (marks of grace, hallowed items) gives Agility training a real, if modest, profit angle.' },
    { min: 60, fastest: 'Ardougne rooftop course, moving to the Prifddinas course at 75 for the best xp/hr in the game.', xpPerAction: 700, xpPerHour: 90000, actionLabel: 'laps', money: null },
  ],
  Thieving: [
    { min: 1, fastest: 'Pickpocket Men/Women, or steal from the baker’s stall.', xpPerAction: 8, xpPerHour: 20000, actionLabel: 'pickpockets', money: null },
    { min: 38, fastest: 'Pickpocket Master Farmers.', xpPerAction: 43, xpPerHour: 25000, actionLabel: 'pickpockets', money: 'Master Farmer pockets often contain valuable seeds (ranarr, snapdragon, etc.) worth well more than the time spent.' },
    { min: 55, fastest: 'Pickpocket vampyres in Darkmeyer (post-quest) for excellent AFK-ish xp.', xpPerAction: 130, xpPerHour: 300000, actionLabel: 'pickpockets', money: 'Vampyre pockets are consistently valuable — strong xp and profit together.' },
    { min: 91, fastest: 'Pyramid Plunder for some of the best Thieving xp/hr in the game.', xpPerAction: 300, xpPerHour: 60000, actionLabel: 'rooms looted', money: null },
  ],
  Slayer: [
    { min: 1, fastest: 'Take tasks from the Slayer Master matching your combat level, and use points to skip or extend tasks rather than grinding bad ones out.', xpPerAction: 80, xpPerHour: 30000, actionLabel: 'task monsters killed', money: 'Slayer is widely considered one of the best all-round money makers — task loot (herbs, bars, uniques) routinely covers supplies and turns a solid profit, especially from tier-appropriate masters like Nieve or Konar.' },
  ],
  Farming: [
    { min: 1, fastest: 'Plant whatever herb/allotment patches you can reach on your way past them — Farming rewards consistency over grinding.', xpPerAction: 50, xpPerHour: 5000, actionLabel: 'patches planted/harvested', money: null },
    { min: 32, fastest: 'Run a full herb circuit (ranarr, then better herbs as you level) every chance you get.', xpPerAction: 180, xpPerHour: 10000, actionLabel: 'herb patches harvested', money: 'Herb farming is one of the best low-effort money makers in the game — a few minutes per run for a crop worth far more than the seed and compost cost.' },
    { min: 60, fastest: 'Add tree and fruit tree runs for large lump-sum xp alongside your herb patches.', xpPerAction: 260, xpPerHour: 12000, actionLabel: 'herb patches harvested', money: 'Higher-tier herbs (snapdragon, torstol) scale the same low-effort profit up further.' },
  ],
  Runecraft: [
    { min: 1, fastest: 'Craft whichever elemental rune (air, water, earth, fire) matches your level at the nearest altar.', xpPerAction: 6, xpPerHour: 20000, actionLabel: 'runes crafted', money: null },
    { min: 44, fastest: 'Nature or Astral runes via the Abyss with pouches for faster trips.', xpPerAction: 9, xpPerHour: 25000, actionLabel: 'runes crafted', money: 'Nature running (via the Abyss) is a classic, very consistent Runecraft money maker.' },
    { min: 77, fastest: 'Blood runes via the Abyss, or Guardians of the Rift for a good mix of xp and rewards.', xpPerAction: 10, xpPerHour: 35000, actionLabel: 'blood runes crafted', money: 'Blood running is one of the most profitable gp/hr methods in Runecraft at this level.' },
  ],
  Hunter: [
    { min: 1, fastest: 'Catch birds with bird snares.', xpPerAction: 35, xpPerHour: 20000, actionLabel: 'birds caught', money: null },
    { min: 63, fastest: 'Box-trap Red Chinchompas.', xpPerAction: 200, xpPerHour: 200000, actionLabel: 'red chinchompas caught', money: 'Chinchompas sell briskly — they’re in constant demand for Ranged training, so this method pays for itself and then some.' },
    { min: 80, fastest: 'Box-trap Black Chinchompas — the best Hunter xp/hr in the game.', xpPerAction: 265, xpPerHour: 250000, actionLabel: 'black chinchompas caught', money: 'Black chinchompas have an even higher sell value, making this the best combined xp-and-profit Hunter method.' },
  ],
  Construction: [
    { min: 1, fastest: 'Build then immediately remove cheap furniture (e.g. Oak Larders) in your player-owned house — repeat for fast, simple xp.', xpPerAction: 60, xpPerHour: 180000, actionLabel: 'pieces built & removed', money: null },
    { min: 50, fastest: 'Build and remove Mahogany tables for a strong xp-per-gp ratio.', xpPerAction: 840, xpPerHour: 600000, actionLabel: 'tables built & removed', money: null },
    { min: 85, fastest: 'Build and remove Magic wardrobes for the best Construction xp/hr.', xpPerAction: 1800, xpPerHour: 800000, actionLabel: 'wardrobes built & removed', money: null },
  ],
}

/** 90 -> "90 min", 125 -> "2h 5m", 48 -> "48 min". Input is whole minutes. */
function formatDuration(totalMinutes) {
  if (totalMinutes < 60) return `${totalMinutes} min`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}

/**
 * Full advice for a skill at a given level/xp: the matching bracket's
 * fastest method, an exact xp-to-next-level figure with an approximate
 * action count and time estimate for that method, and a money
 * recommendation that looks ahead to the next bracket that has one if the
 * current bracket doesn't. Null for skills with no guide (currently just
 * Overall).
 */
export function getTrainingAdvice(skill, level, currentXp) {
  const brackets = TRAINING_GUIDE[skill]
  if (!brackets || !brackets.length) return null

  let bracket = brackets[0]
  for (const b of brackets) {
    if (level >= b.min) bracket = b
  }

  const atMaxLevel = level >= 99
  const xpToNext = atMaxLevel ? null : Math.max(xpForLevel(level + 1) - currentXp, 0)
  const actionsToNext = xpToNext != null ? Math.max(Math.ceil(xpToNext / bracket.xpPerAction), 1) : null
  const timeToNext = xpToNext != null ? formatDuration(Math.max(Math.round((xpToNext / bracket.xpPerHour) * 60), 1)) : null

  let money = bracket.money
  let moneyUnlocksAt = null
  if (!money) {
    const nextMoneyBracket = brackets.find((b) => b.min > level && b.money)
    if (nextMoneyBracket) moneyUnlocksAt = nextMoneyBracket.min
  }

  return {
    fastest: bracket.fastest,
    actionLabel: bracket.actionLabel,
    xpToNext,
    actionsToNext,
    timeToNext,
    nextLevel: atMaxLevel ? null : level + 1,
    money,
    moneyUnlocksAt,
  }
}
