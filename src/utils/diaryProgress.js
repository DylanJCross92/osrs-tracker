// Diary progress read from the player's answers (the same store as quests: composables/useRequirements.js).
import { DIARY_REGIONS, DIARY_TIERS, DIARY_TOTAL, DIARY_CAPE_ID, ELITE_IDS, diaryAnswer, diaryId, higherTierIds, lowerTierIds } from '@/data/diaryIds'

export const tierDone = (id, confirmations = {}) => diaryAnswer(id, confirmations) === 'have'

/** Totals for the tracker: tiers done overall and per region, and whether the diary cape is within reach (every Elite tier done). */
export function diaryStats(confirmations = {}) {
  const byRegion = {}
  let done = 0
  for (const r of DIARY_REGIONS) {
    const n = DIARY_TIERS.filter((t) => tierDone(diaryId(r.slug, t.key), confirmations)).length
    byRegion[r.slug] = { done: n, total: DIARY_TIERS.length }
    done += n
  }
  return { done, total: DIARY_TOTAL, pct: DIARY_TOTAL ? done / DIARY_TOTAL : 0, byRegion, elites: ELITE_IDS.filter((e) => tierDone(e, confirmations)).length, cape: tierDone(DIARY_CAPE_ID, confirmations) }
}

/**
 * The answers to change when a tier is ticked or unticked. A tier needs the ones below it, so ticking Hard also ticks Easy and Medium, and
 * unticking Medium also unticks Hard and Elite. Returns { id: 'have' | null } (null goes back to "not sure").
 */
export function diaryPatch(id, done, confirmations = {}) {
  const patch = {}
  if (done) {
    patch[id] = 'have'
    for (const low of lowerTierIds(id)) if (confirmations[low] !== 'have') patch[low] = 'have'
  } else {
    patch[id] = null
    for (const high of higherTierIds(id)) if (confirmations[high] === 'have') patch[high] = null
  }
  return patch
}
