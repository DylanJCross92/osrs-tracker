// Calculator pages: one entry per skill. Pure data with no imports, because the build also reads this
// file to give the server its per-page titles, descriptions and crawler-visible text (see vite.config.js).
//
//   slug      URL segment: /calculators/<slug>
//   category  Combat | Gathering | Artisan | Support
//   short     one line for the directory card
//   focus     what the title promises beyond XP and time (only things the page really calculates)
//   lead      one sentence under the page heading
//   guide     two short paragraphs of skill-specific notes, shown on the page and to crawlers
//   resources label for the "materials needed" block when the skill has item-based methods

const s = (name, category, short, focus, lead, guide, resources = 'Materials needed') => ({
  name,
  slug: name.toLowerCase(),
  category,
  short,
  focus,
  lead,
  guide,
  resources,
})

export const CALCULATOR_CATEGORIES = ['Combat', 'Gathering', 'Artisan', 'Support']

export const SKILL_INFO = [
  // --- Combat ---
  s('Attack', 'Combat', 'XP, kills and hours to your Attack goal.', 'Time & GP', 'Work out the XP and hours left to your next Attack level, from crabs to maniacal monkeys.',
    [
      'Attack is trained by choosing the Accurate or Aggressive style while you fight. The methods here run from idle options such as crabs and the Gemstone Crab to faster ones like Sulphur Naguas and maniacal monkeys, plus the Nightmare Zone for fully AFK xp. Quest rewards such as Tree Gnome Village and Waterfall Quest give a big early chunk and are offered as shortcuts.',
      'Combat xp rates depend heavily on your gear, prayers and potions, so the xp per hour shown is a typical figure for each method, not a promise. Gp per hour is net of food, potions and the value of drops, which is why idle crab methods read as break-even.',
    ]),
  s('Strength', 'Combat', 'XP and hours to your Strength goal, by method.', 'Time & GP', 'See how long it takes to reach your Strength target with crabs, Slayer, Nightmare Zone or maniacal monkeys.',
    [
      'Strength shares its training methods with Attack and Defence: you pick the Aggressive style and fight the same monsters. Early on, crabs and quests such as Waterfall Quest and Dragon Slayer I do most of the work, and later the faster methods, like Sulphur Naguas and maniacal monkeys, take over.',
      'Rates assume a standard melee setup and are meant for comparison between methods. Higher strength bonus and prayer shave hours off every route, so treat the time estimate as an average player rather than a best case.',
    ]),
  s('Defence', 'Combat', 'XP and hours to your Defence goal, by method.', 'Time & GP', 'Estimate the hours to reach your Defence target, using the same melee methods as Attack and Strength.',
    [
      'Defence is trained with the Defensive style (or Controlled, which splits xp). The methods mirror Attack and Strength, so crabs, the Nightmare Zone and maniacal monkeys all apply, while Dragon Slayer I and Monkey Madness I give quest xp toward the skill.',
      'Because Defence xp only comes from damage dealt on a defensive style, any route here assumes you stay on that style the whole way. Ancient Magicks on monkeys give faster Defence xp but are not modelled as a separate method.',
    ]),
  s('Hitpoints', 'Combat', 'XP and hours to your Hitpoints goal.', 'Time & GP', 'Hitpoints xp arrives alongside your other combat training. Estimate how long your goal takes.',
    [
      'Hitpoints is never trained on its own: it earns about a third of the xp you gain in melee, and a share of ranged and magic xp as well. The methods listed use that ratio, so a fast Attack method is also a fast Hitpoints method, with the rate scaled down accordingly.',
      'If you are also training Attack, Strength or Defence, Hitpoints will usually catch up on its own, which makes a dedicated plan for it rarely necessary. Use the Account Planner to see all of them together.',
    ]),
  s('Ranged', 'Combat', 'XP and hours to your Ranged goal, with ammo costs.', 'Time & GP', 'Calculate Ranged XP, hours and ammo cost, from the dwarf multicannon to chinchompas.',
    [
      'Ranged methods cover cannoning to level 45, idle crabs with darts, Pest Control, the Nightmare Zone with a venator bow, and chinning maniacal monkeys. Chinchompas are the fastest but cost the most, which is clear in the gp column.',
      'Ammo, runes and chinchompas are consumed, so gp per hour is mostly negative for the fast methods. The cheapest route usually leans on slow, idle options, while the fastest route spends heavily from the mid levels.',
    ]),
  s('Prayer', 'Combat', 'Bones needed and cost for your Prayer goal.', 'Bones & GP', 'Calculate how many bones, how many hours and how much gp it takes to reach your Prayer goal.',
    [
      'Prayer xp comes from burying bones or offering them at an altar. The multiplier matters most: a Gilded Altar with both burners lit gives 3.5 times the xp of burying, and the Chaos Altar saves half your bones. The bone counts below already include that multiplier.',
      'Bones are the cost, so the fastest methods are also the most expensive, for example superior dragon bones. The libation bowl and urium remains are listed without a gp figure because their cost depends on how you gather the materials.',
    ], 'Bones and items needed'),
  s('Magic', 'Combat', 'XP, runes and cost to your Magic goal.', 'Time & GP', 'Estimate the hours and gp to reach your Magic goal, from splashing to Ice Barrage.',
    [
      'Magic training ranges from splashing and enchanting jewellery to alchemy, Lunar spells and Ice Burst or Barrage on maniacal monkeys. Barrage is the fastest option and the most expensive, since every cast uses blood, death and water runes.',
      'Rune prices move constantly, so the gp estimates here are rough averages. Profitable options such as Tan Leather and Superglass Make are flagged, and routes that rely on enchanting bolts are marked unpriced because their cost depends on the bolt type.',
    ]),

  // --- Gathering ---
  s('Woodcutting', 'Gathering', 'XP, hours and log profit for Woodcutting.', 'Time & GP', 'Find the fastest and most profitable way to your Woodcutting goal, from oaks to teak and redwoods.',
    [
      'Woodcutting methods include normal trees, oaks, willows, teak and mahogany, magic trees and redwoods, plus tick-manipulated teak, which is the fastest training in the game. Higher-level options such as blisterwood and ironwood are also listed with their requirements.',
      'Gp per hour is what the logs sell for after any costs, so a slow tree can still be the most profitable choice. Tick methods need a certain weapon and careful clicking, which is why they are marked as high intensity.',
    ]),
  s('Fishing', 'Gathering', 'XP, hours and catch profit for Fishing.', 'Time & GP', 'Plan your Fishing goal with fly fishing, barbarian fishing, Tempoross, karambwans and more.',
    [
      'Fishing covers casual spots like fly fishing and the Fishing Guild, active methods such as barbarian fishing and 2-tick harpooning, and money makers like karambwans, infernal eels and minnows. Tempoross sits in between, with moderate xp and useful rewards.',
      'Where a fish is eaten or dropped, the gp column is zero; where it can be sold, the figure is net of bait and tools. Cooking the fish you catch trains a second skill, which the Cooking calculator covers.',
    ]),
  s('Mining', 'Gathering', 'XP, hours and ore profit for Mining.', 'Time & GP', 'Calculate Mining XP and hours to your target, with 3-tick granite, Motherlode Mine, Blast Mine and amethyst.',
    [
      'Mining methods run from power-mining copper and tin and Motherlode Mine to Blast Mine, gem rocks, Volcanic Mine and amethyst. Three-tick granite is the fastest xp, while gem rocks and amethyst are the better earners.',
      'Power-mining methods drop the ore, so their gp is zero. Tick manipulation needs specific items and constant clicking, so it is rated high intensity. Mining does not use up materials, so no resource list is shown.',
    ]),
  s('Hunter', 'Gathering', 'XP, hours and profit for Hunter.', 'Time & GP', 'Estimate the hours to your Hunter goal, from early traps to black chinchompas and rainbow crabs.',
    [
      'Hunter covers early traps, falconry, bird houses, salamanders and razor-backed kebbits, then the chinchompa methods and carnivorous chinchompas, rainbow crabs and herbiboar for late levels. Rumours from the Hunter Guild are included at level 72 and above.',
      'Several routes involve the Wilderness or tick manipulation, noted in each method\'s requirements. Where the wiki gives no hourly gp for a method, it is shown as unpriced rather than guessed.',
    ]),
  s('Farming', 'Gathering', 'XP, hours and cost for Farming runs.', 'Time & GP', 'Plan a Farming goal with herb runs, tree runs and Tithe Farm.',
    [
      'Farming is built around timers: crops take hours to grow, so xp per hour depends on how you count time. Tree runs are rated per hour of active farming, because the actual run takes minutes but needs days of waiting in total, while herb runs use an average over the wait.',
      'Because of that, the day count on this page understates real elapsed time for Farming. Tithe Farm is the exception, an active minigame with steady xp. Use the hours as effort rather than as a calendar.',
    ]),

  // --- Artisan ---
  s('Cooking', 'Artisan', 'Fish to cook, hours and cost for Cooking.', 'Food, Time & GP', 'Calculate how much food you need to cook, how long it takes and what it costs to reach your Cooking goal.',
    [
      'Cooking methods include early fish, the Hosidius kitchen, karambwans, one-tick karambwans for the fastest xp, and jugs of wine. Cooking sharks, anglerfish and manta rays is profitable, while wines and pies cost gp.',
      'The food counts assume no burns, which is accurate with cooking gauntlets or the Hosidius range at high levels but understates early fish. Gp per hour compares the cooked food\'s value with the raw cost.',
    ], 'Food and items needed'),
  s('Fletching', 'Artisan', 'Items, hours and cost for Fletching.', 'Items, Time & GP', 'Work out the arrows and items needed, hours and gp to reach your Fletching goal.',
    [
      'Fletching is fastest when you attach arrowtips to headless arrows, which gives hundreds of thousands of xp per hour, with fast, expensive tiers up to dragon arrows. Vale Totems, ascension bolts and redwood shields are listed alongside bows.',
      'Quantities count each arrowtip and headless arrow separately, since both are consumed. Prices swing with the market, so the profitable ascension bolts and the costly arrows can change places over time.',
    ], 'Items needed'),
  s('Firemaking', 'Artisan', 'Logs needed, hours and cost for Firemaking.', 'Logs, Time & GP', 'See how many logs you need and how long it takes to reach your Firemaking goal.',
    [
      'The fastest Firemaking burns logs in tick-timed lines at a bank, while Wintertodt trains at a lower but still strong rate and pays out useful supplies. A forester\'s campfire is a lower-effort alternative.',
      'The log counts use the highest-xp log available at each level, which is the usual way to burn them. Logs are consumed, so burning methods read as costs, while Wintertodt is roughly break-even.',
    ], 'Logs needed'),
  s('Crafting', 'Artisan', 'Items crafted, hours and cost for Crafting.', 'Items, Time & GP', 'Calculate the materials, time and gp to reach your Crafting goal, from jewellery to dragonhide.',
    [
      'Crafting options include jewellery, which is often profitable, gem cutting, dragonhide bodies, battlestaves and glassblowing. Cutting dragonstones and crafting black dragonhide are the fastest but expensive.',
      'Item counts show the gems, hides, glass or orbs consumed. Jewellery lines list profit but not an item count, since the combination of bars and gems varies. Spinning and weaving flax is a cheap option on Fossil Island.',
    ], 'Materials needed'),
  s('Smithing', 'Artisan', 'Bars, hours and profit for Smithing.', 'Bars, Time & GP', 'Estimate the ore and bars you need and the profit on the way to your Smithing goal.',
    [
      'Smithing is best at the Blast Furnace, where smelting steel, mithril, adamantite and runite bars earns xp and a profit, while smelting gold bars with goldsmith gauntlets is the fastest xp. Giants\' Foundry and anvil armour are the main alternatives.',
      'Ore and coal counts follow the Blast Furnace\'s halved coal rule. Anvil armour mostly loses money except adamant platebodies, which is why the cheapest route favours the furnace.',
    ], 'Ore and bars needed'),
  s('Herblore', 'Artisan', 'Potions, ingredients and cost for Herblore.', 'Potions, Time & GP', 'Find the potions to make, the ingredients and the cost to reach your Herblore goal.',
    [
      'Herblore xp comes from combining an unfinished potion with a secondary ingredient. The methods run through each potion tier, from attack potions to Armadyl brews, and swamp tar offers a cheap alternative at low levels.',
      'Rates assume a steady stream of potions with no tick manipulation, and almost every potion loses gp, which makes tar the cheapest way up. The ingredient lists show the unfinished potion and secondary used at each level.',
    ], 'Ingredients needed'),
  s('Construction', 'Artisan', 'Planks, hours and cost for Construction.', 'Planks, Time & GP', 'Calculate how many planks, hours and gp it takes to reach your Construction goal.',
    [
      'Construction is trained by building and removing furniture in your house. The fastest options use mahogany planks, with gnome benches and mahogany tables, while Mahogany Homes contracts are slower but need less clicking. Oak larders and teak benches cover the middle.',
      'Plank counts use the planks per piece for each build. Prices make this one of the most expensive skills, and a servant, such as a demon butler, is assumed for the fast methods.',
    ], 'Planks needed'),
  s('Runecraft', 'Artisan', 'Essence, runes and profit for Runecraft.', 'Runes, Time & GP', 'Calculate the essence, hours and profit to your Runecraft goal.',
    [
      'Runecraft methods include early altars, Ourania, Guardians of the Rift, lava runes, Arceuus blood and soul runes, and the late-game astral, nature, law and wrath runes. Some of the best profits come from the highest levels.',
      'Essence counts are listed where each run is a simple crafting of essence. Combination runes and runner setups depend on pouches and other players, so those lines show xp and gp only.',
    ], 'Essence needed'),

  // --- Support ---
  s('Agility', 'Support', 'Laps, marks of grace and hours for Agility.', 'Laps & Time', 'Calculate how many laps, hours and marks of grace you need to reach your next Agility goal.',
    [
      'Agility has no resource cost, only time. Rooftop courses are the standard route, from Draynor to Ardougne, with the Wilderness course and Hallowed Sepulchre as faster, riskier options and the Agility Pyramid as a coin-based alternative. Brimhaven is a low-effort option at mid levels.',
      'Lap counts use each rooftop\'s xp per lap, and marks of grace use the rooftop averages from the wiki. Rates depend on your diaries, so a range is shown. Hallowed Sepulchre, Wilderness and Pyramid profits come from loot, not marks.',
    ], 'Laps and marks'),
  s('Thieving', 'Support', 'XP, hours and profit for Thieving.', 'Time & GP', 'Plan your Thieving goal with stalls, pickpocketing, blackjacking and Rogues\' Castle.',
    [
      'Thieving runs from men and bakery stalls through knights and Pyramid Plunder to elves, vyres and the Wilderness chests of Rogues\' Castle. The late-game options are both fast and profitable.',
      'Pickpocket gp is the coin pouches and drops, net of food. Wilderness chests carry the risk of dying, which the figures do not price in.',
    ]),
  s('Slayer', 'Support', 'XP and hours to your Slayer goal.', 'Time & GP', 'Estimate the hours to reach your Slayer goal from regular tasks and Konar.',
    [
      'Slayer xp comes from killing the monster you are assigned, so the figures here are averages across typical tasks, not exact kill counts. Konar tasks give more xp but assign a location.',
      'Task lengths and monster hit points vary enough that a per-kill estimate would be unreliable, so this calculator gives xp and time only. Combat gear and the Slayer helmet make a large difference.',
    ]),
  s('Sailing', 'Support', 'XP and hours for Sailing, the newest skill.', 'Time & Routes', 'Estimate the hours to your Sailing goal using courier routes, shipwreck salvaging and Barracuda trials.',
    [
      'Sailing is the newest skill, and the wiki\'s own training page is still marked out of date. The routes here cover courier tasks, salvaging shipwrecks of each size and the Barracuda Trials, with the Gwenith Glide as the fastest known xp.',
      'Rates are rough and are likely to change as players find better setups, which is why none of them show a gp figure. Treat the hours as a ballpark and check back as the skill settles.',
    ]),
]

export const SKILL_BY_SLUG = Object.fromEntries(SKILL_INFO.map((x) => [x.slug, x]))

export const calculatorTitle = (info) => `OSRS ${info.name} Calculator: XP, ${info.focus} | TickGains`
export const calculatorDescription = (info) =>
  `Calculate OSRS ${info.name} XP, training hours and gp to level 99. ${info.short} Free Old School RuneScape calculator.`
