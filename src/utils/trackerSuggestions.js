// "Do this next" for the quest and diary tracker: what is left, ranked by how much it opens up in the planner, with a plain sentence for why.
// Works with or without a player. With levels it only offers what the player can start now (or is a few levels short of, and says so); without
// them it offers what has its own prerequisites done and says it cannot check levels.
import { QUEST_LIST } from '@/data/questList'
import { LENGTH_MINUTES, getQuest, questChain } from '@/data/quests'
import { DIARIES } from '@/data/diaries'
import { questSlug } from '@/utils/questSlug'
import { unlocksFor } from '@/utils/trackerUnlocks'
import { requirementsFor } from '@/data/methodRequirements'
import { formatHours, planGoal } from '@/utils/planner'
import { resolveGoal } from '@/utils/plannerTools'
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
      slug: q.slug,
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
export function suggestNext(confirmations = {}, levels = null, { limit = 5, maxDiaries = 2, members = true } = {}) {
  // A free-to-play account is only offered free quests, and no diaries (they are members-only).
  const free = new Set(QUEST_LIST.filter((q) => q.type === 'F').map((q) => q.slug))
  const quests = questCandidates(confirmations, levels)
    .filter((q) => members || free.has(q.slug))
    .sort((a, b) => b.score - a.score)
  const diaries = members ? diaryCandidates(confirmations, levels).sort((a, b) => b.score - a.score) : []
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


/** A quest the plan's route needs counts as "next" when at most this many quests (itself included) are left to do on the way to it. */
const MAX_ON_THE_WAY = 3

/**
 * The quest that does the most for the plan being worked on, or null when none does: one that can be started now (or is a few levels short) and
 * either gives XP the plan would otherwise train for, or opens a method the plan's route already runs through. `goals` are the plan's goals with
 * their XP as of now; the hours come from the planner itself (the plan's hours with and without the quest's XP), so "saves about 3 h" is what the
 * plan would show. Returns the suggestion with { source: 'plan', saved, need, why }.
 */
export function nextForPlan(confirmations = {}, levels = null, { goals = [], strategy, gpValue, blockedMethodIds = [], planName = '', members = true } = {}) {
  const live = goals.filter((g) => g.targetXp > g.currentXp)
  if (!live.length) return null
  const prep = (g) => planGoal({ ...resolveGoal(g, strategy, gpValue), blockedMethodIds })
  const base = live.map(prep)
  const hoursOf = (plan) => (Number.isFinite(plan.hours) ? plan.hours : 0)
  // The quests the plan's route leans on (not done yet): slug -> { hours, method, skill } for the one it spends the most time with.
  const doneSlugs = completedQuestSlugs(confirmations)
  const leans = new Map()
  base.forEach((plan, i) => {
    for (const seg of plan.segments || []) {
      if (!seg.method || !(seg.hours > 0)) continue
      for (const req of requirementsFor(seg.method)) {
        for (const id of [req.kind === 'quest' ? req.id : null, ...(req.quests || []).map((q) => q.id)].filter(Boolean)) {
          const slug = id.replace(/^quest:/, '').replace(/:partial$/, '')
          if (doneSlugs.has(slug)) continue
          const have = leans.get(slug)
          const hours = (have?.hours || 0) + seg.hours
          if (!have || seg.hours > have.top) leans.set(slug, { hours, top: seg.hours, method: seg.method.name, skill: live[i].skill })
          else have.hours = hours
        }
      }
    }
  })
  const picks = []
  const freeSlugs = new Set(QUEST_LIST.filter((q) => q.type === 'F').map((q) => q.slug))
  for (const c of questCandidates(confirmations, levels)) {
    const info = getQuest(c.slug)
    if (!info) continue
    // A free-to-play account is only pointed at free quests.
    if (!members && !freeSlugs.has(c.slug)) continue
    // 1. XP the plan would otherwise train for.
    let saved = 0
    const counted = []
    live.forEach((g, i) => {
      const reward = info.rewards[g.skill]
      if (!reward) return
      const credit = Math.min(reward, g.targetXp - g.currentXp)
      const after = hoursOf(prep({ ...g, currentXp: g.currentXp + credit }))
      const gain = hoursOf(base[i]) - after
      if (gain > 0) {
        saved += gain
        counted.push(g.skill)
      }
    })
    // 2. A quest the route leans on: a method it trains with needs this quest, or this one is on the way to it (a quest it needs first).
    let need = 0
    let lean = null
    for (const [slug, use] of leans) {
      // What is still to do on the way to it, in order. A quest several others away is too far off to be what to do next.
      const chain = questChain(getQuest(slug)?.id ?? slug).map((id) => questSlug(getQuest(id)?.name || id)).filter((x) => !doneSlugs.has(x))
      if (!chain.includes(c.slug) || chain.length > MAX_ON_THE_WAY) continue
      need += use.hours / chain.length
      if (!lean || use.hours / chain.length > lean.share) lean = { share: use.hours / chain.length, ...use, target: slug === c.slug ? '' : getQuest(slug)?.name || '' }
    }
    const value = saved + need * 0.5 - c.minutes / 60
    // Worth a mention only when it pays for its own time: a quarter of an hour saved, or a route that leans on it.
    if ((saved < 0.25 && need < 0.5) || value <= 0) continue
    const xpText = counted.length ? `${counted.join(' and ')} XP` : ''
    const why = need >= saved && lean
      ? `Your plan trains ${lean.skill} with ${lean.method} for about ${formatHours(lean.hours)}, which needs ${lean.target ? `${lean.target}. This quest comes first on the way.` : 'this quest.'}`
      : `Its ${xpText} counts toward your plan and saves about ${formatHours(saved)} of training${c.minutes ? ` for about ${c.minutes >= 60 ? formatHours(c.minutes / 60) : `${c.minutes} min`}` : ''}.`
    picks.push({ ...c, source: 'plan', planName, saved, need, value, why })
  }
  if (!picks.length) return null
  const ready = (p) => Number(p.status === 'ready' || p.status === 'unknown')
  picks.sort((a, b) => ready(b) - ready(a) || b.value - a.value)
  return picks[0]
}
