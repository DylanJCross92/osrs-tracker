// Quests the player has finished, read from their answers about requirements (one store for everything: the quest tracker
// on the account page, "I have this" on a method's requirements, and "already done" on a quest shortcut).
import { QUEST_LIST } from '@/data/questList'
import { QUESTS } from '@/data/quests'
import { questSlug } from '@/utils/questSlug'

/** Slugs of quests answered "have". A partial-progress answer is not a finished quest. */
export function completedQuestSlugs(confirmations = {}) {
  const out = new Set()
  for (const [id, v] of Object.entries(confirmations)) {
    if (v === 'have' && id.startsWith('quest:') && !id.endsWith(':partial')) out.add(id.slice('quest:'.length))
  }
  return out
}

/** Ids of the XP-shortcut quests (see data/quests.js) that are already finished, so their rewards are not counted twice. */
export function doneShortcutIds(confirmations = {}) {
  const done = completedQuestSlugs(confirmations)
  return QUESTS.filter((q) => done.has(questSlug(q.name))).map((q) => q.id)
}

/** Totals for the tracker: how many of the known quests are marked done, overall and by type. */
export function questStats(confirmations = {}) {
  const done = completedQuestSlugs(confirmations)
  const by = { F: { done: 0, total: 0 }, M: { done: 0, total: 0 }, MQ: { done: 0, total: 0 } }
  for (const q of QUEST_LIST) {
    by[q.type].total++
    if (done.has(q.slug)) by[q.type].done++
  }
  const total = QUEST_LIST.length
  const count = by.F.done + by.M.done + by.MQ.done
  return { done: count, total, pct: total ? count / total : 0, by }
}
