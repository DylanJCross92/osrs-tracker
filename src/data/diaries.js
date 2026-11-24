// The Achievement Diaries for the tracker: every region and tier with what it needs, gives and asks you to do. The facts come from the OSRS Wiki
// through scripts/build-diary-data.mjs (src/data/diaryData.generated.js); this file adds the ids the rest of the site uses and links each quest a
// tier needs to the quest tracker's own entry.
import { DIARY_REGIONS, DIARY_TIERS, diaryId } from '@/data/diaryIds'
import { DIARY_DATA } from '@/data/diaryData.generated'
import { QUEST_LIST } from '@/data/questList'

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const QUEST_BY_NORM = new Map(QUEST_LIST.map((q) => [norm(q.name), q]))
// A name the Wiki shortens ("Between a Rock...") still finds its quest.
const findQuest = (name) => QUEST_BY_NORM.get(norm(name)) || [...QUEST_BY_NORM].find(([k]) => norm(name).length > 8 && k.startsWith(norm(name)))?.[1] || null
const asQuest = (name) => {
  const q = findQuest(name)
  return { name: q?.name || name, id: q?.id || null }
}

export const DIARIES = DIARY_REGIONS.map((region) => {
  const data = DIARY_DATA.find((d) => d.region === region.name)
  return {
    ...region,
    url: data?.url,
    tiers: DIARY_TIERS.map((tier) => {
      const t = data?.tiers?.[tier.key] || { skills: {}, quests: [], partial: [], other: [], rewards: [], tasks: [] }
      const { Combat: combat = null, ...skills } = t.skills
      return {
        key: tier.key,
        label: tier.label,
        id: diaryId(region.slug, tier.key),
        name: `${tier.label} ${region.name} Diary`,
        regionName: region.name,
        skills,
        combat,
        qp: t.qp || 0,
        allQuests: !!t.allQuests,
        quests: t.quests.map(asQuest),
        partial: t.partial.map(asQuest),
        other: t.other || [],
        rewards: t.rewards,
        tasks: t.tasks,
      }
    }),
  }
})

export const ALL_DIARY_TIERS = DIARIES.flatMap((d) => d.tiers)
const BY_ID = new Map(ALL_DIARY_TIERS.map((t) => [t.id, t]))
export const getDiaryTier = (id) => BY_ID.get(id) || null
