// The twelve Achievement Diaries and their four tiers, by id only (no task text), so anything can work with a diary requirement without loading the
// full diary data (data/diaries.js). A tier's id is `diary:` + tier + region + `diary`, the same id a method's requirement text makes
// ("Medium Karamja Diary" -> diary:medium-karamja-diary), so the tracker, the planner and the method requirements all share one answer.

export const DIARY_REGIONS = [
  { name: 'Karamja', slug: 'karamja' },
  { name: 'Ardougne', slug: 'ardougne' },
  { name: 'Falador', slug: 'falador' },
  { name: 'Fremennik', slug: 'fremennik' },
  { name: 'Kandarin', slug: 'kandarin' },
  { name: 'Kourend & Kebos', slug: 'kourend-kebos' },
  { name: 'Lumbridge & Draynor', slug: 'lumbridge-draynor' },
  { name: 'Morytania', slug: 'morytania' },
  { name: 'Varrock', slug: 'varrock' },
  { name: 'Western Provinces', slug: 'western-provinces' },
  { name: 'Wilderness', slug: 'wilderness' },
  { name: 'Desert', slug: 'desert' },
]
export const DIARY_TIERS = [
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
  { key: 'elite', label: 'Elite' },
]
export const DIARY_TOTAL = DIARY_REGIONS.length * DIARY_TIERS.length

export const diaryId = (regionSlug, tierKey) => `diary:${tierKey}-${regionSlug}-diary`
/** The Achievement diary cape: every Elite diary. */
export const DIARY_CAPE_ID = 'diary:achievement-diary-cape'

const PARSED = new Map()
for (const r of DIARY_REGIONS) for (const t of DIARY_TIERS) PARSED.set(diaryId(r.slug, t.key), { region: r.slug, tier: t.key })
/** { region, tier } for a tier id, else null. */
export const parseDiaryId = (id) => PARSED.get(id) || null
const tierIndex = (key) => DIARY_TIERS.findIndex((t) => t.key === key)

/** Ids of the tiers of the same region below this one (the ones that have to be done first). */
export function lowerTierIds(id) {
  const p = parseDiaryId(id)
  return p ? DIARY_TIERS.slice(0, tierIndex(p.tier)).map((t) => diaryId(p.region, t.key)) : []
}
/** Ids of the tiers of the same region above this one. */
export function higherTierIds(id) {
  const p = parseDiaryId(id)
  return p ? DIARY_TIERS.slice(tierIndex(p.tier) + 1).map((t) => diaryId(p.region, t.key)) : []
}
export const ELITE_IDS = DIARY_REGIONS.map((r) => diaryId(r.slug, 'elite'))

/**
 * What the player's answers say about a diary id: 'have' (said so, or a higher tier of the same region is done, or for the cape every Elite
 * diary is), 'missing', or null. A tier the player ticked is theirs to untick; the rest is worked out.
 */
export function diaryAnswer(id, confirmations = {}) {
  const own = confirmations[id]
  if (own === 'have' || own === 'missing') return own
  if (id === DIARY_CAPE_ID) return ELITE_IDS.every((e) => confirmations[e] === 'have') ? 'have' : null
  return higherTierIds(id).some((h) => confirmations[h] === 'have') ? 'have' : null
}
