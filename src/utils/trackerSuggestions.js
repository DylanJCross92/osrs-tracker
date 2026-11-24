// "Do this next" for the quest and diary tracker: what is left, ranked by how much it opens up in the planner, with a plain sentence for why.
// Works with or without a player. With levels it only offers what the player can start now (or is a few levels short of, and says so); without
// them it offers what has its own prerequisites done and says it cannot check levels.
import { QUEST_LIST } from '@/data/questList'
import { LENGTH_MINUTES, getQuest } from '@/data/quests'
import { DIARIES } from '@/data/diaries'
import { questSlug } from '@/utils/questSlug'
import { unlocksFor } from '@/utils/trackerUnlocks'
import { completedQuestSlugs, questPoints } from '@/utils/questProgress'
import { tierDone } from '@/utils/diaryProgress'
import { combatLevel } from '@/utils/smartReasons'
import { formatXp } from '@/utils/osrsSkills'

/** Levels the player is short of for a { Skill: level } requirement: [{ skill, need, have }]. Empty when met, or when levels are not known. */
export function shortfalls(reqs = {}, levels = null) {
  if (!levels) return []
  return Object.entries(reqs)
    .filter(([skill, need]) => (levels[skill] ?? 1) < need)
    .map(([skill, need]) => ({ skill, need, have: levels[skill] ?? 1 }))
}
const gapText = (list) => list.map((s) => `${s.need} ${s.skill} (you are ${s.have})`).join(', ')
const maxGap = (list) => list.reduce((m, s) => Math.max(m, s.need - s.have), 0)
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function methodsText(unlocks) {
  const names = [...new Set(unlocks.map((u) => u.name))]
  if (!names.length) return ''
  if (names.length === 1) return `Opens ${names[0]} in the planner`
  return `Opens ${names[0]} and ${plural(names.length - 1, 'other method')} in the planner`
}

function questCandidates(confirmations, levels) {
  const done = completedQuestSlugs(confirmations)
  const qpHave = questPoints(confirmations).have
  const combat = levels ? combatLevel(levels) : null
  const out = []
  for (const q of QUEST_LIST) {
    if (done.has(q.slug)) continue
    const info = getQuest(q.slug)
    // A quest the Wiki gave no details for cannot be judged (what it needs is unknown).
    if (!info || info.incomplete) continue
    const unlocks = unlocksFor(q.id)
    const xp = Object.values(info.rewards).reduce((s, n) => s + n, 0)
    const missingQuests = info.requires.map((id) => getQuest(id)).filter((r) => r && !done.has(questSlug(r.name)))
    if (missingQuests.length) continue
    if (info.qpReq && qpHave < info.qpReq) continue
    const gaps = shortfalls(info.reqs, levels)
    // Too far off to suggest: a lot of levels short, or a fight the account is too weak for.
    if (gaps.length && maxGap(gaps) > 5) continue
    if (combat != null && info.combat && info.combat > combat + 5) continue
    const minutes = info.length ? LENGTH_MINUTES[info.length] : 90
    const score = unlocks.length * 3 + Math.min(xp / 10000, 10) + (info.lamps?.length ? 1 : 0) + (info.qp || 0) * 0.2 - minutes / 120 - gaps.length * 2
    if (score <= 0 && !unlocks.length) continue
    const reasons = []
    const open = methodsText(unlocks)
    if (open) reasons.push(open)
    if (xp) reasons.push(`gives ${formatXp(xp)} XP`)
    if (!reasons.length && info.qp) reasons.push(`worth ${plural(info.qp, 'quest point')}`)
    out.push({
      kind: 'quest',
      key: q.id,
      id: q.id,
      name: q.name,
      score,
      ready: levels ? gaps.length === 0 : null,
      status: !levels ? 'unknown' : gaps.length ? 'almost' : 'ready',
      note: !levels ? 'Add your name to check levels' : gaps.length ? `Needs ${gapText(gaps)}` : 'You meet every requirement',
      why: `${reasons.length ? `${reasons[0][0].toUpperCase()}${reasons[0].slice(1)}${reasons.length > 1 ? `, ${reasons.slice(1).join(', ')}` : ''}.` : 'A good quest to get out of the way.'}${info.length && minutes <= 40 ? ` A quick one, about ${minutes} minutes.` : ''}`,
      unlocks,
      xp,
      minutes,
      qp: info.qp || 0,
      meta: [info.difficulty, info.length].filter(Boolean).join(' · '),
    })
  }
  return out
}

function diaryCandidates(confirmations, levels) {
  const done = completedQuestSlugs(confirmations)
  const out = []
  for (const region of DIARIES) {
    // Only the next tier of each region: the one before it has to be done first.
    const tier = region.tiers.find((t) => !tierDone(t.id, confirmations))
    if (!tier) continue
    const gaps = shortfalls(tier.skills, levels)
    if (gaps.length && maxGap(gaps) > 8) continue
    const missingQuests = tier.quests.filter((q) => q.id && !done.has(q.id.replace(/^quest:/, '')))
    if (tier.allQuests || missingQuests.length > 2) continue
    const unlocks = unlocksFor(tier.id)
    const earlier = tier.key === 'easy' ? 2.5 : tier.key === 'medium' ? 2 : tier.key === 'hard' ? 1 : 0.5
    const score = unlocks.length * 3 + earlier - gaps.length * 1.5 - missingQuests.length * 1.5
    if (score <= 0 && !unlocks.length) continue
    const lamp = tier.rewards.find((r) => /antique lamp/i.test(r.text))
    const reasons = []
    const open = methodsText(unlocks)
    if (open) reasons.push(open)
    if (lamp) reasons.push(`gives ${lamp.text.match(/worth ([\d,]+)/i)?.[1] || ''} XP lamp`.replace('gives  XP', 'gives an XP'))
    const ready = levels ? gaps.length === 0 && missingQuests.length === 0 : null
    out.push({
      kind: 'diary',
      key: tier.id,
      id: tier.id,
      name: tier.name,
      score,
      ready,
      status: !levels ? 'unknown' : ready ? 'ready' : 'almost',
      note: !levels ? 'Add your name to check levels' : ready ? 'You meet every requirement' : [gaps.length ? `Needs ${gapText(gaps)}` : '', missingQuests.length ? `Quests first: ${missingQuests.map((q) => q.name).join(', ')}` : ''].filter(Boolean).join('. '),
      why: reasons.length ? `${reasons[0][0].toUpperCase()}${reasons[0].slice(1)}${reasons.length > 1 ? `, ${reasons.slice(1).join(', ')}` : ''}.` : `${tier.rewards[0]?.text || 'Rewards for the region'}.`,
      unlocks,
      meta: `${tier.tasks.length} tasks`,
      xp: 0,
      minutes: 0,
      qp: 0,
    })
  }
  return out
}

/**
 * The best things to do next, [{ kind, key, name, why, note, status, ... }], best first: up to `limit`, at most `maxDiaries` of them diary tiers so
 * quests are not crowded out. status is 'ready', 'almost' (a few levels short) or 'unknown' (no levels to check).
 */
export function suggestNext(confirmations = {}, levels = null, { limit = 5, maxDiaries = 2 } = {}) {
  const quests = questCandidates(confirmations, levels).sort((a, b) => b.score - a.score)
  const diaries = diaryCandidates(confirmations, levels).sort((a, b) => b.score - a.score)
  const picked = []
  const all = [...quests, ...diaries].sort((a, b) => b.score - a.score)
  let d = 0
  for (const s of all) {
    if (picked.length >= limit) break
    if (s.kind === 'diary' && d >= maxDiaries) continue
    if (s.kind === 'diary') d++
    picked.push(s)
  }
  // Ready ones come before the ones a few levels short, each keeping its own order.
  return picked.sort((a, b) => Number(b.status === 'ready' || b.status === 'unknown') - Number(a.status === 'ready' || a.status === 'unknown') || b.score - a.score)
}

