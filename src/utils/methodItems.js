import { MATERIALS } from '@/data/methodMaterials'
import { ECONOMY } from '@/data/methodEconomy'

// Whether the planner knows what items a method uses up, so the materials list never says "nothing to buy" about a method it simply has no
// data for.
//   tracked   its items are listed (data/methodMaterials.js, or the inputs of its recipe in data/methodEconomy.js)
//   none      it uses no items you have to bring (chopping, mining, climbing rooftops, Guardians of the Rift)
//   supplies  combat training: food, potions and ammo vary too much to list
//   untracked it does use items, and they are not listed yet
const NO_ITEM_SKILLS = new Set(['Agility', 'Woodcutting', 'Mining', 'Thieving'])
// Methods that use nothing you have to bring: the game supplies the essence in Guardians of the Rift, Wintertodt gives its own kindling, and
// harpoon or cage fishing uses reusable tools.
const NO_ITEM_METHODS = new Set(['runecraft-gotr', 'firemaking-wintertodt', 'fishing-early', 'fishing-lobster', 'fishing-tempoross', 'fishing-harpoon-2t'])
const SUPPLY_SKILLS = new Set(['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Slayer'])

export function itemsStatus(method) {
  if (!method?.id) return 'none'
  const e = ECONOMY[method.id]
  if (MATERIALS[method.id] || e?.inputs?.length) return 'tracked'
  // A method that only sells what it gathers needs nothing bought first.
  if (e) return 'none'
  if (NO_ITEM_METHODS.has(method.id) || NO_ITEM_SKILLS.has(method.skill)) return 'none'
  if (SUPPLY_SKILLS.has(method.skill)) return 'supplies'
  return 'untracked'
}
