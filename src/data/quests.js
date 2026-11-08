// Quests that hand out a big flat chunk of XP, handy shortcuts at low levels
// and a favourite for ironmen (no gp, no grind). Figures are the fixed XP
// rewards listed on the OSRS Wiki, rounded to the exact reward. The planner
// only checks the skill-level requirement for the rewarded skill; everything
// else is shown as plain text so players can verify it themselves.
//
// Shape: { id, name, rewards: { Skill: xp }, reqs: { Skill: level }, needs }

const q = (id, name, rewards, needs = '', reqs = {}) => ({ id, name, rewards, reqs, needs })

export const QUESTS = [
  q('tree-gnome-village', 'Tree Gnome Village', { Attack: 11450 }),
  q('waterfall-quest', 'Waterfall Quest', { Attack: 13750, Strength: 13750 }),
  q('fight-arena', 'Fight Arena', { Attack: 12175, Thieving: 2175 }),
  q('death-plateau', 'Death Plateau', { Attack: 3000 }),
  q('vampyre-slayer', 'Vampyre Slayer', { Attack: 4825 }),
  q('the-grand-tree', 'The Grand Tree', { Agility: 7900, Attack: 18400, Magic: 2150 }, '25 Agility', { Agility: 25 }),
  q('witchs-house', "Witch's House", { Hitpoints: 6325 }),
  q('monkey-madness-i', 'Monkey Madness I', { Attack: 35000, Defence: 35000, Hitpoints: 35000 }, 'Tree Gnome Village and The Grand Tree'),
  q('dragon-slayer-i', 'Dragon Slayer I', { Strength: 18650, Defence: 18650 }, '32 quest points'),
  q('troll-stronghold', 'Troll Stronghold', { Strength: 15000 }, 'Death Plateau'),
  q('sea-slug', 'Sea Slug', { Fishing: 7175 }, '30 Firemaking', {}),
  q('fishing-contest', 'Fishing Contest', { Fishing: 2437 }, '10 Fishing', { Fishing: 10 }),
  q('eadgars-ruse', "Eadgar's Ruse", { Herblore: 11000 }, '31 Herblore, Druidic Ritual, Troll Stronghold', { Herblore: 31 }),
  q('mage-arena-i', 'Mage Arena I', { Magic: 15000 }, '60 Magic', { Magic: 60 }),
  q('knights-sword', "The Knight's Sword", { Smithing: 12725 }, '10 Mining and 29 Smithing (boostable)', { Smithing: 29 }),
  q('the-restless-ghost', 'The Restless Ghost', { Prayer: 1125 }),
  q('priest-in-peril', 'Priest in Peril', { Prayer: 1406 }),
]

export function getQuest(id) {
  return QUESTS.find((x) => x.id === id) || null
}

/** Quests that reward XP in this skill, biggest first. */
export function questsForSkill(skill) {
  return QUESTS.filter((x) => x.rewards[skill]).sort((a, b) => b.rewards[skill] - a.rewards[skill])
}

export function questXpFor(ids, skill) {
  let total = 0
  for (const id of ids || []) total += getQuest(id)?.rewards[skill] || 0
  return total
}
