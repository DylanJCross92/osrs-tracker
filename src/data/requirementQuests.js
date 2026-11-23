// The quests behind an item or unlock that a method needs ("Goldsmith gauntlets" come from Family Crest). Keyed by the requirement id
// that src/data/methodRequirements.js makes, so the planner can say which quest to do and let the player tick it off.
//
//   covers  true when finishing the quests is the whole unlock (a spellbook, an area), so a player who has done them has it.
//           false for an item you also have to pick up or make: the quest only opens the way, so the player still confirms the item.
//   partial a quest where starting it (or reaching a point in it) is enough.
//
// Each line was checked against the OSRS Wiki page for the item or unlock (page named in the comment).
const q = (name, partial = false) => ({ name, partial })

export const REQUIREMENT_QUESTS = {
  // Goldsmith gauntlets, Cooking gauntlets: "available after completing the quest Family Crest".
  'equipment:goldsmith-gauntlets': { covers: false, quests: [q('Family Crest')] },
  'equipment:cooking-gauntlets': { covers: false, quests: [q('Family Crest')] },
  // Ninja monkey greegree: given in Monkey Madness I; the Ape Atoll page asks for "partial completion of Monkey Madness I".
  'equipment:ninja-monkey-greegree': { covers: false, quests: [q('Monkey Madness I', true)] },
  // Digsite pendant: "requires completion of The Dig Site quest".
  'equipment:digsite-pendant': { covers: false, quests: [q('The Dig Site')] },
  // Blast Furnace: Keldagrim opens once "The Giant Dwarf" is started.
  'unlock:blast-furnace-access': { covers: true, quests: [q('The Giant Dwarf', true)] },
  // Ancient Magicks: "unlocked upon completion of the quest Desert Treasure I".
  'unlock:ancient-magicks': { covers: true, quests: [q('Desert Treasure I')] },
  // Lunar spellbook and Ourania Teleport: "the quest Lunar Diplomacy must be completed".
  'unlock:lunar-spellbook': { covers: true, quests: [q('Lunar Diplomacy')] },
  'unlock:ourania-teleport': { covers: true, quests: [q('Lunar Diplomacy')] },
  // Fossil Island: "players must have completed the Bone Voyage quest".
  'unlock:fossil-island-teaks': { covers: true, quests: [q('Bone Voyage')] },
  // Varlamore: "can only be accessed upon completion of Children of the Sun".
  'unlock:varlamore-access': { covers: true, quests: [q('Children of the Sun')] },
  // Hallowed Sepulchre: "level 52 Agility and completion of Sins of the Father".
  'unlock:hallowed-sepulchre-access': { covers: true, quests: [q('Sins of the Father')] },
  // Pyramid Plunder: "players must have started Icthlarin's Little Helper for access to Sophanem".
  'unlock:pyramid-plunder-access': { covers: true, quests: [q("Icthlarin's Little Helper", true)] },
  // Neitiznot: "requires the completion of The Fremennik Trials as well as starting The Fremennik Isles".
  'unlock:neitiznot-access': { covers: true, quests: [q('The Fremennik Trials'), q('The Fremennik Isles', true)] },
}
