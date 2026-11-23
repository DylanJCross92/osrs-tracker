// Quests that hand out experience, and the quests that have to be done first. The facts come from the OSRS Wiki through
// scripts/build-quest-data.mjs (see src/data/questData.generated.js: rewards, requirements, difficulty, length, the combat level the Wiki
// recommends, the strongest enemy). This file turns that into what the planner uses and holds the few corrections the script cannot read.
//
// Shape: { id, name, rewards: { Skill: xp }, reqs: { Skill: level }, needs, requires, minutes, combat, suggest, ... }
//   rewards   the set experience (a lamp or other choice of skills is in `lamps`, shown but not counted)
//   reqs      skill levels needed (also those of the quests that come first, which the planner adds up)
//   needs     the same, as a sentence
//   requires  ids of the quests that have to be finished first (their rewards and time count too)
//   minutes   a first run, not a speedrun: the Wiki's length class for a player who is not expert, see LENGTH_MINUTES
//   combat    the combat level to take its fights safely: the Wiki's recommendation, else worked out from the strongest enemy it lists
//             (`combatGuess`), else 0 (nothing to fight). The Smart Planner leaves a quest out until the account has it.
//   qp        quest points it gives, and `qpReq` the quest points it needs before it can be started
//   suggest   short and cheap enough that the planner turns it on by itself when it pays off

import { questId, questSlug } from '@/utils/questSlug'
import { QUEST_DATA } from '@/data/questData.generated'

/**
 * Minutes for a first run by the Wiki's length class. The Wiki's classes describe an average player who knows the quest; someone doing it
 * for the first time with low stats takes about twice as long, so these are roughly double.
 */
export const LENGTH_MINUTES = { 'Very Short': 15, Short: 40, Medium: 90, Long: 180, 'Very Long': 300 }
const DEFAULT_LENGTH = 'Medium'

// Plans saved before this list was generated name three quests by a shorter id.
const LEGACY_IDS = { "eadgar's-ruse": 'eadgars-ruse', "witch's-house": 'witchs-house', "the-knight's-sword": 'knights-sword' }
const idOf = (name) => LEGACY_IDS[questSlug(name)] || questSlug(name)

// What the Wiki says on the quest's page but a table cannot give the script (checked against that page).
const OVERRIDES = {
  // Speaking to Daero afterwards: 35,000 in two of Attack/Defence/Strength/Hitpoints and 20,000 in the other two, as you choose. Taken as the usual melee choice.
  'monkey-madness-i': { rewards: { Attack: 35000, Defence: 35000, Strength: 20000, Hitpoints: 20000 }, minutes: 240, note: 'You choose which two skills get 35,000 XP; the other two get 20,000.' },
  // The 5,000 reward plus 4,210 Runecraft XP earned during the quest ("for a total of 9,210 XP" on its page).
  'temple-of-the-eye': { rewards: { Runecraft: 9210 }, suggest: true },
  // The Runecraft opening: short quests that together open Guardians of the Rift early.
  'rune-mysteries': { suggest: true },
  'enter-the-abyss': { suggest: true },
}

const skillsText = (reqs) => Object.entries(reqs).map(([skill, level]) => `${level} ${skill}`)

const combatFor = (d) => {
  if (d.recommendedCombat != null) return { combat: d.recommendedCombat, combatGuess: false }
  if (d.enemyMax != null) return { combat: Math.min(75, Math.round(10 + d.enemyMax * 0.35)), combatGuess: true }
  return { combat: 0, combatGuess: false }
}

const BY_NAME = new Map(QUEST_DATA.map((d) => [d.name, d]))

function build(d) {
  const id = idOf(d.name)
  const o = OVERRIDES[id] || {}
  const prereq = d.prereq.filter((n) => BY_NAME.has(n))
  const needs = [...skillsText(d.reqs), ...(d.qpReq ? [`${d.qpReq} quest points`] : []), ...prereq]
  return {
    id,
    name: d.name,
    rewards: o.rewards || d.rewards,
    reqs: d.reqs,
    needs: needs.join(', '),
    requires: prereq.map(idOf),
    minutes: o.minutes ?? LENGTH_MINUTES[d.length || DEFAULT_LENGTH],
    ...combatFor(d),
    suggest: !!o.suggest,
    members: d.members,
    miniquest: d.miniquest,
    difficulty: d.difficulty,
    length: d.length,
    qpReq: d.qpReq,
    qp: d.qp || 0,
    lamps: d.lamps || [],
    support: !!d.support,
    // The Wiki gave no details box (length, difficulty, requirements): not recommended, since what it needs is unknown.
    incomplete: !d.length,
    note: o.note || '',
    url: d.url,
  }
}

/** Every quest we know, including the ones that only have to be done first. */
export const ALL_QUESTS = QUEST_DATA.map(build)
const BY_ID = new Map(ALL_QUESTS.map((q) => [q.id, q]))
// The same quest answers to the id from its name too ("eadgar's-ruse"), for anything that built an id from the name.
for (const q of ALL_QUESTS) BY_ID.set(questSlug(q.name), q)

/** The quests that give set experience, which the planner can use as shortcuts. */
export const QUESTS = ALL_QUESTS.filter((q) => !q.support && !q.incomplete && Object.keys(q.rewards).length > 0)

export function getQuest(id) {
  return BY_ID.get(id) || null
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
  if (!quest || seen.has(quest.id)) return []
  seen.add(quest.id)
  return [...quest.requires.flatMap((r) => questChain(r, seen)), quest.id]
}

/** A list of quest ids with whatever they need added in front, each once, in the order they can be done. */
export function withPrerequisites(ids) {
  const seen = new Set()
  return (ids || []).flatMap((id) => questChain(id, seen))
}

/** A list of quest ids without `removed` and without any quest that needs it, so nothing is left that cannot be done. */
export function withoutQuest(ids, removed) {
  const gone = new Set([getQuest(removed)?.id || removed])
  for (let grew = true; grew; ) {
    grew = false
    for (const x of ALL_QUESTS) if (!gone.has(x.id) && x.requires.some((r) => gone.has(r))) gone.add(x.id), (grew = true)
  }
  return (ids || []).filter((id) => !gone.has(getQuest(id)?.id || id))
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
