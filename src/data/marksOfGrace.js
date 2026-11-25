// Marks of grace an hour for each Agility course that drops them, and what they are worth. From the OSRS Wiki's Marks of grace page (the
// "Marks of grace per hour" table and "Spending marks of grace", page edited 15 November 2026), for a player whose Agility is not 20 or more
// levels above the course's. The Wiki gives a range because spawns are random; [low, high] is that range for a player with no diary bonus.
// Higher diary tiers raise it (for example Seers' Village up to 16.6 an hour, Ardougne up to 22), which is left out so the plan does not
// promise more than everyone gets.
//
// What a mark is worth here: Grace at the Rogues' Den sells an amylase pack, 100 amylase crystals, for 10 marks, so a mark buys 10 crystals,
// and crystals sell on the Grand Exchange (the planner prices them live, after tax). The Wiki values a mark at about 2,660 coins this way.
export const CRYSTALS_PER_MARK = 10

// Keyed by method id (data/trainingMethods.js).
export const MARKS = {
  'agility-gnome': { low: 10, high: 12 },
  'agility-draynor': { low: 10, high: 13.8 },
  'agility-al-kharid': { low: 8, high: 11.5 },
  // Brimhaven and the Colossal Wyrm course pay in amylase packs, which the Wiki turns into marks at a fixed rate; the figure is that rate.
  'agility-brimhaven': { low: 8, high: 8 },
  'agility-varrock': { low: 8, high: 11.3 },
  'agility-canifis': { low: 16, high: 18 },
  // "About 10" on the page.
  'agility-shayzien': { low: 10, high: 10 },
  'agility-ape-atoll': { low: 5, high: 6 },
  'agility-falador': { low: 10, high: 12.1 },
  'agility-colossal-wyrm': { low: 11, high: 13 },
  'agility-werewolf': { low: 10, high: 15 },
  'agility-seers': { low: 11, high: 13.8 },
  'agility-colossal-wyrm-adv': { low: 17, high: 18 },
  'agility-pollnivneach': { low: 13, high: 14 },
  'agility-rellekka': { low: 13, high: 15.5 },
  'agility-ardougne': { low: 16, high: 18.1 },
  // From Jagex's own post (25 November 2026), not the Wiki table yet: about 12 to 14 an hour on the slower route this course is counted at,
  // and 30 or more on the fast high-intensity route.
  'agility-prison-of-raun': { low: 12, high: 14 },
}

/** The middle of the range, the figure plans use. 0 for a course that drops no marks. */
export const marksPerHour = (id) => {
  const m = MARKS[id]
  return m ? (m.low + m.high) / 2 : 0
}
