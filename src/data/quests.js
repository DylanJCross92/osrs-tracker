// Quests that hand out a big flat chunk of XP, handy shortcuts at low levels
// and a favourite for ironmen (no gp, no grind). Figures are the fixed XP
// rewards listed on the OSRS Wiki, rounded to the exact reward. The planner
// only checks the skill-level requirement for the rewarded skill; everything
// else is shown as plain text so players can verify it themselves.
//
// Shape: { id, name, rewards: { Skill: xp }, reqs: { Skill: level }, needs, requires, minutes, suggest }
//   requires  ids of quests in this list that have to be done first (their rewards count too)
//   minutes   a rough time to finish it, so a shortcut is only worth it when it saves more than it costs
//   suggest   short and cheap enough that the planner turns it on by itself when it pays off

import { questId } from '@/utils/questSlug'

const q = (id, name, rewards, needs = '', reqs = {}, extra = {}) => ({ id, name, rewards, reqs, needs, requires: [], minutes: 0, suggest: false, ...extra })

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
  // The Runecraft opening: three short quests that together reach about level 27 (the level Guardians of the Rift opens at) in
  // roughly 20 minutes, instead of paying for talisman tiaras and lava runes. Temple of the Eye's 9,210 is its 5,000 reward
  // plus the 4,210 earned in the quest itself.
  q('rune-mysteries', 'Rune Mysteries', { Runecraft: 500 }, '', {}, { minutes: 5, suggest: true }),
  q('enter-the-abyss', 'Enter the Abyss', { Runecraft: 1000 }, 'Rune Mysteries', {}, { requires: ['rune-mysteries'], minutes: 5, suggest: true }),
  q('temple-of-the-eye', 'Temple of the Eye', { Runecraft: 9210 }, 'Enter the Abyss and 10 Runecraft (not boostable). Unlocks Guardians of the Rift', { Runecraft: 10 }, { requires: ['enter-the-abyss'], minutes: 10, suggest: true }),
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

/** The quests to do first for a quest: everything it needs, in order, ending with the quest itself. */
export function questChain(id, seen = new Set()) {
  const quest = getQuest(id)
  if (!quest || seen.has(id)) return []
  seen.add(id)
  return [...quest.requires.flatMap((r) => questChain(r, seen)), id]
}

/** A list of quest ids with whatever they need added in front, each once, in the order they can be done. */
export function withPrerequisites(ids) {
  const seen = new Set()
  return (ids || []).flatMap((id) => questChain(id, seen))
}

/** A list of quest ids without `removed` and without any quest that needs it, so nothing is left that cannot be done. */
export function withoutQuest(ids, removed) {
  const gone = new Set([removed])
  for (let grew = true; grew; ) {
    grew = false
    for (const x of QUESTS) if (!gone.has(x.id) && x.requires.some((r) => gone.has(r))) gone.add(x.id), (grew = true)
  }
  return (ids || []).filter((id) => !gone.has(id))
}

/** The requirement ids ("quest:temple-of-the-eye") a plan's chosen quests will satisfy, so a method that needs one counts as covered. */
export function plannedQuestReqIds(goals) {
  const out = new Set()
  for (const g of goals || []) for (const id of withPrerequisites(g.quests)) if (getQuest(id)) out.add(questId(getQuest(id).name))
  return [...out]
}

/** Total minutes the not-yet-done quests in this list take. */
export function questMinutes(ids, done = null) {
  return withPrerequisites(ids).reduce((sum, id) => sum + (done?.has?.(id) ? 0 : getQuest(id)?.minutes || 0), 0)
}
