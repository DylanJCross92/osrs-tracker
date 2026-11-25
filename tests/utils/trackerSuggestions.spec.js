import { describe, expect, it } from 'vitest'
import { shortfalls, suggestNext } from '@/utils/trackerSuggestions'
import { SKILL_NAMES } from '@/utils/osrsSkills'
import { QUEST_LIST } from '@/data/questList'

const levels = (over = {}) => ({ ...Object.fromEntries(SKILL_NAMES.map((s) => [s, 1])), Hitpoints: 10, ...over })

describe('shortfalls', () => {
  it('lists the levels a player is short of, and nothing without levels', () => {
    expect(shortfalls({ Mining: 40, Smithing: 40 }, levels({ Mining: 45, Smithing: 30 }))).toEqual([{ skill: 'Smithing', need: 40, have: 30 }])
    expect(shortfalls({ Mining: 40 }, null)).toEqual([])
  })
})

describe('suggestNext', () => {
  it('suggests something useful with nothing done and no levels, saying it cannot check them', () => {
    const list = suggestNext({}, null)
    expect(list.length).toBeGreaterThan(2)
    expect(list.length).toBeLessThanOrEqual(5)
    for (const s of list) {
      expect(s.why.length).toBeGreaterThan(10)
      expect(s.status).toBe('unknown')
      expect(s.note).toMatch(/Add your name/)
    }
  })

  it('never suggests a finished quest, or one whose first quests are not done', () => {
    const list = suggestNext({ 'quest:family-crest': 'have' }, null, { limit: 40 })
    expect(list.map((s) => s.key)).not.toContain('quest:family-crest')
    // Monkey Madness I needs two quests first, so it is not offered until they are done.
    expect(suggestNext({}, null, { limit: 200 }).map((s) => s.key)).not.toContain('quest:monkey-madness-i')
    const after = suggestNext({ 'quest:the-grand-tree': 'have', 'quest:tree-gnome-village': 'have' }, null, { limit: 200 })
    expect(after.map((s) => s.key)).toContain('quest:monkey-madness-i')
  })

  it('keeps diary tiers to the next tier of a region and to a couple of places', () => {
    const list = suggestNext({}, null, { limit: 8 })
    const diaries = list.filter((s) => s.kind === 'diary')
    expect(diaries.length).toBeLessThanOrEqual(2)
    for (const d of diaries) expect(d.key).toMatch(/^diary:easy-/)
    const next = suggestNext({ 'diary:easy-karamja-diary': 'have' }, null, { limit: 40, maxDiaries: 12 }).filter((s) => s.kind === 'diary')
    expect(next.map((s) => s.key)).not.toContain('diary:easy-karamja-diary')
  })

  it('with levels, offers what can be started now first and says what a short account lacks', () => {
    const weak = suggestNext({}, levels(), { limit: 40, maxDiaries: 12 })
    expect(weak.every((s) => s.status === 'ready' || s.status === 'almost')).toBe(true)
    // A level 1 account is not offered a quest that needs 40 Mining.
    expect(weak.map((s) => s.key)).not.toContain('quest:family-crest')
    const strong = suggestNext({}, levels({ Mining: 40, Smithing: 40, Magic: 59, Crafting: 40, Hitpoints: 60, Defence: 40, Attack: 40, Strength: 40 }), { limit: 200 })
    const crest = strong.find((s) => s.key === 'quest:family-crest')
    expect(crest?.status).toBe('ready')
    expect(crest.note).toBe('You meet every requirement')
    expect(crest.why).toMatch(/^Opens .* and 5 other methods in the planner, gives 6K XP\.$/)
    expect(crest.unlocks.map((u) => u.name)).toContain('Blast Furnace (gold, gauntlets)')
  })

  it('names the diary levels a player is a few short of', () => {
    const list = suggestNext({}, levels({ Agility: 12, Mining: 40, Thieving: 30 }), { limit: 40, maxDiaries: 12 })
    for (const s of list.filter((x) => x.status === 'almost')) expect(s.note).toMatch(/Needs|Quests first/)
  })

  it('is quick enough to run on every tick', () => {
    const t = Date.now()
    for (let i = 0; i < 20; i++) suggestNext({}, levels({ Mining: 50 }))
    expect(Date.now() - t).toBeLessThan(2000)
  })

  it('offers a free-to-play account only free quests and no diaries', () => {
    const free = new Set(QUEST_LIST.filter((q) => q.type === 'F').map((q) => q.slug))
    const list = suggestNext({}, null, { members: false, limit: 20 })
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((s) => s.kind === 'quest' && free.has(s.slug))).toBe(true)
    // A members account still gets diaries among its suggestions.
    expect(suggestNext({}, null, { limit: 30, maxDiaries: 5 }).some((s) => s.kind === 'diary')).toBe(true)
  })
})
