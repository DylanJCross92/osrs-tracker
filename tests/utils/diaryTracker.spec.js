import { describe, expect, it } from 'vitest'
import { DIARIES, ALL_DIARY_TIERS } from '@/data/diaries'
import { DIARY_CAPE_ID, DIARY_REGIONS, ELITE_IDS, diaryAnswer, diaryId, parseDiaryId } from '@/data/diaryIds'
import { TRAINING_METHODS } from '@/data/trainingMethods'
import { requirementsFor } from '@/data/methodRequirements'
import { SKILL_NAMES } from '@/utils/osrsSkills'
import { diaryPatch, diaryStats, tierDone } from '@/utils/diaryProgress'
import { MET, UNKNOWN, methodAvailability, requirementStatus } from '@/utils/requirements'
import { unlocksFor } from '@/utils/trackerUnlocks'
import { questPoints } from '@/utils/questProgress'

describe('diary data', () => {
  it('has twelve regions of four tiers with unique ids', () => {
    expect(DIARIES).toHaveLength(12)
    expect(ALL_DIARY_TIERS).toHaveLength(48)
    expect(new Set(ALL_DIARY_TIERS.map((t) => t.id)).size).toBe(48)
    for (const t of ALL_DIARY_TIERS) expect(parseDiaryId(t.id), t.id).toBeTruthy()
  })

  it('has real skills, some tasks and rewards for every tier, and levels that do not drop as the tiers go up', () => {
    for (const d of DIARIES) {
      let previous = {}
      for (const t of d.tiers) {
        expect(t.tasks.length, `${t.name} tasks`).toBeGreaterThan(0)
        expect(t.rewards.length, `${t.name} rewards`).toBeGreaterThan(0)
        for (const [skill, level] of Object.entries(t.skills)) {
          expect(SKILL_NAMES, `${t.name}: ${skill}`).toContain(skill)
          expect(level).toBeGreaterThan(0)
          expect(level).toBeLessThanOrEqual(99)
        }
        previous = t.skills
      }
      void previous
    }
    // The Wiki's own counts: Karamja has 10, 19, 10 and 5 tasks; Ardougne 10, 12, 12 and 8.
    expect(DIARIES.find((d) => d.slug === 'karamja').tiers.map((t) => t.tasks.length)).toEqual([10, 19, 10, 5])
    expect(DIARIES.find((d) => d.slug === 'ardougne').tiers.map((t) => t.tasks.length)).toEqual([10, 12, 12, 8])
  })

  it('links the quests a tier needs to the quest list', () => {
    const named = ALL_DIARY_TIERS.flatMap((t) => [...t.quests, ...t.partial])
    expect(named.length).toBeGreaterThan(100)
    const unmatched = named.filter((q) => !q.id)
    // Only a handful of Wiki names may fail to match (a shortened title); anything more means the quest list and the Wiki drifted.
    expect(unmatched.map((q) => q.name), 'quests not on the tracker list').toEqual([])
  })

  it('knows every diary a method asks for', () => {
    const ids = new Set(ALL_DIARY_TIERS.map((t) => t.id).concat(DIARY_CAPE_ID))
    for (const m of TRAINING_METHODS) for (const r of requirementsFor(m)) if (r.kind === 'diary') expect(ids.has(r.id), `${m.id}: ${r.id}`).toBe(true)
  })
})

describe('diary answers', () => {
  const med = diaryId('karamja', 'medium')
  it('count a lower tier as done when a higher one is', () => {
    expect(diaryAnswer(med, {})).toBeNull()
    expect(diaryAnswer(med, { [diaryId('karamja', 'hard')]: 'have' })).toBe('have')
    expect(diaryAnswer(med, { [diaryId('ardougne', 'hard')]: 'have' })).toBeNull()
    expect(diaryAnswer(med, { [med]: 'missing', [diaryId('karamja', 'hard')]: 'have' })).toBe('missing')
  })

  it('treat the cape as done only with every Elite diary', () => {
    const all = Object.fromEntries(ELITE_IDS.map((e) => [e, 'have']))
    expect(diaryAnswer(DIARY_CAPE_ID, all)).toBe('have')
    expect(diaryAnswer(DIARY_CAPE_ID, { ...all, [ELITE_IDS[0]]: undefined })).toBeNull()
    expect(ELITE_IDS).toHaveLength(DIARY_REGIONS.length)
  })

  it('tick the tiers below, and untick the tiers above', () => {
    expect(diaryPatch(diaryId('falador', 'hard'), true, {})).toEqual({ [diaryId('falador', 'hard')]: 'have', [diaryId('falador', 'easy')]: 'have', [diaryId('falador', 'medium')]: 'have' })
    const done = { [diaryId('falador', 'easy')]: 'have', [diaryId('falador', 'medium')]: 'have', [diaryId('falador', 'hard')]: 'have' }
    expect(diaryPatch(diaryId('falador', 'medium'), false, done)).toEqual({ [diaryId('falador', 'medium')]: null, [diaryId('falador', 'hard')]: null })
  })

  it('add up per region and overall', () => {
    const c = { [diaryId('varrock', 'medium')]: 'have' }
    const s = diaryStats(c)
    expect(s.done).toBe(2)
    expect(s.byRegion.varrock.done).toBe(2)
    expect(tierDone(diaryId('varrock', 'easy'), c)).toBe(true)
    expect(s.cape).toBe(false)
  })
})

describe('diaries in the planner', () => {
  it('cover a method that needs a tier once the tier is ticked', () => {
    const gems = TRAINING_METHODS.find((m) => m.id === 'mining-gems')
    const req = requirementsFor(gems).find((r) => r.kind === 'diary')
    expect(req.id).toBe('diary:medium-karamja-diary')
    expect(requirementStatus(req, { confirmations: {} })).toBe(UNKNOWN)
    expect(requirementStatus(req, { confirmations: { 'diary:hard-karamja-diary': 'have' } })).toBe(MET)
    expect(methodAvailability(gems, { confirmations: { 'diary:medium-karamja-diary': 'have' } }).unmet).toEqual([])
  })

  it('asks for the easy Kourend diary for the Hosidius kitchen', () => {
    const m = TRAINING_METHODS.find((x) => x.id === 'cooking-karambwan')
    expect(requirementsFor(m).map((r) => r.id)).toContain('diary:easy-kourend-kebos-diary')
  })

  it('list what a quest or diary opens', () => {
    expect(unlocksFor('diary:medium-karamja-diary').map((u) => u.name)).toContain('Gem rocks')
    expect(unlocksFor('quest:family-crest').map((u) => u.name)).toContain('Blast Furnace (gold, gauntlets)')
    expect(unlocksFor('quest:children-of-the-sun').some((u) => /Gemstone Crab/.test(u.name))).toBe(true)
    expect(unlocksFor('quest:no-such-quest')).toEqual([])
  })
})

describe('quest points', () => {
  it('count the points of the quests marked done', () => {
    expect(questPoints({}).have).toBe(0)
    expect(questPoints({}).total).toBeGreaterThan(250)
    expect(questPoints({ 'quest:family-crest': 'have' }).have).toBe(1)
    // A partial answer is not a finished quest.
    expect(questPoints({ 'quest:family-crest:partial': 'have' }).have).toBe(0)
  })
})
