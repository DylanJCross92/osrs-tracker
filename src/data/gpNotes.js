// Plain-English reasons behind each method's net gp/hr, shown in the planner's
// tooltips. gpPerHour in trainingMethods.js is NET: income from items or loot
// minus what the method consumes. Specific methods get their own note; the
// rest fall back to a note based on the skill and whether the figure is a
// profit, a cost, or roughly break-even.

const SPECIFIC = {
  'attack-crabs': 'Crabs drop nothing worth selling and need no supplies, so it breaks even.',
  'attack-sand-crabs': 'Sand crabs drop nothing worth selling and need no supplies, so it breaks even.',
  'attack-nmz': 'Absorption and overload potions cost more than the reward points are worth.',
  'attack-slayer': 'Monster drops and task rewards usually sell for more than the food and potions you use.',
  'ranged-crabs': 'Arrows or bolts break and crabs drop nothing, so you pay for ammo only.',
  'ranged-red-chins': 'Chinchompas are used up with every throw, and they are expensive.',
  'ranged-black-chins': 'Black chinchompas are used up with every throw and cost a lot each.',
  'ranged-blowpipe-slayer': 'Darts and scales are cheap, and Slayer drops more than cover them.',
  'ranged-cannon': 'Cannonballs are used up, and only part of the cost comes back in drops.',
  'prayer-ectofuntus': 'You buy bones and slime buckets and they are all consumed.',
  'prayer-chaos': 'Bought big bones are burnt (the Chaos Altar saves about half), so you pay for the rest.',
  'prayer-dragon': 'Dragon bones are expensive and every one is consumed.',
  'prayer-wildy-altar': 'Dragon bones are expensive and every one is consumed.',
  'magic-splash': 'Runes for each cast are consumed and nothing comes back.',
  'magic-alch': 'Each cast uses a nature rune and the alched item sells for a little less than it cost.',
  'magic-plank-make': 'Each cast costs runes plus coins, on top of the logs you buy.',
  'magic-superglass': 'Seaweed, sand and runes cost more than the molten glass is worth.',
  'magic-burst': 'Every cast uses death, chaos and water runes, which cost far more than Slayer drops bring in, so this is very expensive.',
  'magic-barrage': 'Every cast uses blood, death and water runes, roughly 1,500 gp a cast and over a thousand casts an hour. Slayer drops only cover a fraction, so this is very expensive.',
  'hitpoints-barrage': 'Same runes as Ice Barrage (blood, death and water on every cast), so this is very expensive. Hitpoints xp comes along with the Magic xp.',
  'magic-enchant-bolts': 'Runes and bolts are consumed and enchanted bolts sell for only a little more.',
  'mining-iron': 'Ore is dropped as you go, so nothing is sold and nothing is spent.',
  'mining-motherlode': 'Gold nuggets and ore sell for a small profit.',
  'mining-blast': 'Dynamite costs about as much as the ore and gems you get back.',
  'mining-granite-3t': 'The granite is dropped as you mine to keep the 3-tick rhythm, so nothing is sold. The small cost of herbs and swamp tar is ignored, so it is treated as break-even.',
  'mining-amethyst': 'Amethyst sells for a high price and needs no supplies.',
  'fishing-barbarian': 'Leaping fish are usually dropped and bait is cheap, so it breaks even.',
  'fishing-tempoross': 'Raw fish and rewards sell for a modest profit.',
  'farming-herb-runs': 'The herbs you grow sell for far more than the seeds and compost cost.',
  'farming-tithe': 'Seeds and water cost more than the minigame hands back.',
  'farming-trees': 'Saplings are expensive and the logs or fruit roughly just cover them.',
  'hunter-herbiboar': 'Herbs and the rare drops from the herbiboar sell for a profit.',
  'hunter-red-chins': 'Chinchompas you trap sell for more than the traps cost to run.',
  'hunter-black-chins': 'Black chinchompas sell for a high price and traps are cheap.',
  'cooking-wines': 'Grapes and jugs of water cost more than wines sell for.',
  'cooking-karambwan': 'Raw fish cost a little more than the cooked fish sell for.',
  'fletching-bows': 'Logs and bowstrings cost more than the finished bows sell for.',
  'firemaking-logs': 'Logs are burned and gone, so every log is a cost.',
  'firemaking-wintertodt': 'Supply crates give seeds, herbs and other rewards worth a small profit.',
  'crafting-amethyst': 'Cut amethyst tips sell for more than the raw amethyst.',
  'smithing-giants-foundry': 'Bars are used up and the reward points roughly pay for them.',
  'smithing-cannonballs': 'Cannonballs sell for slightly more than the steel bars used.',
  'smithing-blast-furnace': 'Coal and the entry fee cost a bit more than the bars sell for.',
  'construction-oak-larders': 'Planks and nails are consumed, because you build then remove each piece.',
  'construction-mahogany-tables': 'Mahogany planks are consumed, because you build then remove each table.',
  'construction-wardrobes': 'Magic wardrobes use expensive planks, which are consumed when you remove them.',
  'construction-mahogany-homes': 'The minigame pays you coins and points for each contract.',
  'runecraft-gotr': 'Runes and rewards from the minigame sell for a solid profit.',
  'runecraft-nature': 'Nature runes crafted from bought essence sell for more than the essence cost.',
  'runecraft-blood': 'Blood runes are worth a lot, even after paying for essence.',
  'runecraft-soul': 'Soul runes sell for a good price after paying for essence.',
  'slayer-tasks': 'Monster drops and task rewards usually sell for more than the supplies you use.',
  'slayer-konar': 'Konar tasks send you to better-paying monsters, so drops outweigh supplies.',
  'agility-sepulchre': 'Coffins and rare loot from each lap add up to a good profit.',
  'agility-pyramid': 'Coin pouches from each run sell for a profit.',
  'thieving-master-farmers': 'The seeds you steal sell for a good price.',
  'thieving-vyres': 'Coin pouches add a small profit, and food is cheap.',
  'thieving-blackjack': 'Coin pouches pay a little, and you spend little on food.',
  'thieving-knights': 'Coin pouches from knights pay a steady profit.',
  'thieving-elves': 'Coin pouches and crystal shards pay well.',
  'thieving-pyramid': 'Pyramid loot and urns sell for a profit.',
}

const GATHERING = new Set(['Woodcutting', 'Fishing', 'Mining', 'Hunter', 'Farming', 'Thieving', 'Runecraft', 'Agility', 'Slayer'])
const COMBAT = new Set(['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged'])

/** Why this method makes (or costs) gp. Always returns a sentence. */
export function gpExplain(method) {
  if (!method) return ''
  if (method.gpPerHour == null) return 'No reliable gp figure for this method (it depends on how you play), so it is left out of GP totals. The total is incomplete.'
  const specific = SPECIFIC[method.id]
  if (specific) return specific
  const gp = method.gpPerHour
  if (GATHERING.has(method.skill)) {
    if (gp > 0) return 'You sell what you gather or loot, and it needs few or no supplies, so it profits.'
    if (gp < 0) return 'Supplies and tools used cost more than what you collect.'
    return 'Nothing worth selling comes back and no supplies are used, so it breaks even.'
  }
  if (COMBAT.has(method.skill)) {
    if (gp > 0) return 'Drops from what you kill sell for more than your food, potions and ammo.'
    if (gp < 0) return 'Food, potions and ammo cost more than the drops are worth.'
    return 'Drops roughly cover the supplies you use, so it breaks even.'
  }
  // Artisan skills: buy materials, turn them into something.
  if (gp > 0) return 'What you make sells for more than the materials cost.'
  if (gp < 0) return 'You buy the materials and the finished items sell for less, or are destroyed, so it costs gp.'
  return 'Materials cost about the same as the finished items are worth, so it breaks even.'
}
