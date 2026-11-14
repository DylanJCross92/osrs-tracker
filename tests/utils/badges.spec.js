import { describe, it, expect } from 'vitest'
import { flairBadges, pinOptions, pinnedAchievement, streakFlair } from '@/utils/badges'

const ach = (type, skill, value, completed, title = `${value} ${skill}`, category = 'Skill Levels') => ({ key: `${type}:${skill}:${value}`, type, skill, value, completed, title, category, description: '' })

describe('streakFlair', () => {
  it('shows a live streak from two days, with the best when it is longer', () => {
    expect(streakFlair({ current: 12, longest: 41 })).toMatchObject({ kind: 'live', text: '12-day streak', best: 41 })
    expect(streakFlair({ current: 12, longest: 12 })).toMatchObject({ kind: 'live', best: null })
  })
  it('falls back to the best streak when there is no live one, and shows nothing for a tiny one', () => {
    expect(streakFlair({ current: 0, longest: 9 })).toMatchObject({ kind: 'best', text: 'Best streak 9 days' })
    expect(streakFlair({ current: 1, longest: 2 })).toBeNull()
    expect(streakFlair(null)).toBeNull()
    expect(streakFlair({})).toBeNull()
  })
  it('never lets the best be lower than the current run', () => {
    expect(streakFlair({ current: 5, longest: 0 })).toMatchObject({ kind: 'live', longest: 5, best: null })
  })
})

describe('flairBadges', () => {
  const list = [
    ach('skill_level', 'Mining', 99, true),
    ach('skill_level', 'Fishing', 99, true),
    ach('skill_level', 'Cooking', 99, false),
    ach('skill_level', 'Mining', 90, true),
    ach('skill_xp', 'Fishing', 200_000_000, true, '200M Fishing XP', 'Skill XP'),
    ach('total_level', '', 1500, true, '1,500 Overall', 'Overall'),
    ach('total_level', '', 2000, true, '2,000 Overall', 'Overall'),
    ach('total_level', '', 2200, false, '2,200 Overall', 'Overall'),
    ach('total_xp', '', 50_000_000, true, '50M Total XP', 'Total XP'),
  ]
  const b = flairBadges(list)
  it('lists each skill at 99, with 200M skills first and flagged', () => {
    expect(b.capes).toEqual([{ skill: 'Fishing', max: true }, { skill: 'Mining', max: false }])
  })
  it('picks the highest total level and total XP earned', () => {
    expect(b.totalLevel).toEqual({ value: 2000, title: '2,000 Overall' })
    expect(b.totalXp).toEqual({ value: 50_000_000, title: '50M Total XP' })
  })
  it('counts what is earned out of everything', () => {
    expect(b.earned).toBe(7)
    expect(b.total).toBe(9)
  })
  it('is empty for a profile with nothing earned or no data', () => {
    expect(flairBadges([ach('skill_level', 'Mining', 99, false)])).toMatchObject({ capes: [], totalLevel: null, totalXp: null, earned: 0 })
    expect(flairBadges(undefined)).toMatchObject({ capes: [], earned: 0, total: 0 })
  })
})

describe('pinning', () => {
  const list = [ach('skill_level', 'Mining', 99, true), ach('skill_level', 'Fishing', 99, false), ach('skill_level', 'Mining', 70, true), ach('total_level', '', 2000, true, '2,000 Overall', 'Overall')]
  it('only shows a pinned achievement that has been earned', () => {
    expect(pinnedAchievement(list, 'skill_level:Mining:99')?.title).toBe('99 Mining')
    expect(pinnedAchievement(list, 'skill_level:Fishing:99')).toBeNull()
    expect(pinnedAchievement(list, 'nonsense')).toBeNull()
    expect(pinnedAchievement(list, '')).toBeNull()
  })
  it('offers earned achievements by category, biggest first', () => {
    const opts = pinOptions(list)
    expect(opts.map((g) => g.category)).toEqual(['Skill Levels', 'Overall'])
    expect(opts[0].items.map((a) => a.value)).toEqual([99, 70])
  })
})
