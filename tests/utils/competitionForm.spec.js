import { describe, it, expect } from 'vitest'
import { applyLength, applySotw, mondayOf, nextMonday, skillOfTheWeek, sotwTitle, blankForm, buildCompetitionBody, clockText, defaultTitle, describeWindow, durationText, fullDateTime, joinLocal, lengthText, setStartNow, toDateInput, toTimeInput } from '@/utils/competitionForm'

const now = new Date(2026, 10, 14, 15, 20) // 14 Nov 2026, 3:20 PM local
const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min)
const fields = (start, end) => ({ startDate: toDateInput(start), startTime: toTimeInput(start), endDate: toDateInput(end), endTime: toTimeInput(end) })
const base = { title: 'Mining race', metric: 'skill_xp', skill: 'Mining', ...fields(now, new Date(now.getTime() + 7 * 86_400_000)) }

describe('blankForm', () => {
  it('starts now and ends a week later, on the person\'s own clock', () => {
    const f = blankForm(now)
    expect(f).toMatchObject({ metric: 'skill_xp', skill: 'Mining', title: 'Mining XP race', startDate: '2026-11-14', startTime: '15:20', endDate: '2026-11-21', endTime: '15:20' })
  })
})

describe('buildCompetitionBody', () => {
  it('uses the chosen start and end exactly', () => {
    const start = at(2026, 11, 20, 18, 30)
    const end = at(2026, 11, 27, 21, 0)
    const r = buildCompetitionBody({ ...base, ...fields(start, end) }, now)
    expect(r.ok).toBe(true)
    expect(new Date(r.body.startsAt).getTime()).toBe(start.getTime())
    expect(new Date(r.body.endsAt).getTime()).toBe(end.getTime())
  })
  it('treats a start at (or just before) the current minute as now', () => {
    const r = buildCompetitionBody({ ...base, ...fields(at(2026, 11, 14, 15, 19), at(2026, 11, 21, 15, 20)) }, now)
    expect(r.ok).toBe(true)
    expect(r.body.startsAt).toBe(now.toISOString())
  })
  it('drops the skill for overall XP', () => {
    expect(buildCompetitionBody({ ...base, metric: 'overall_xp', skill: 'Mining' }, now).body.skill).toBe('')
  })
  it('rejects a short title, a missing skill and a missing metric', () => {
    expect(buildCompetitionBody({ ...base, title: 'ab' }, now).ok).toBe(false)
    expect(buildCompetitionBody({ ...base, title: '   ' }, now).ok).toBe(false)
    expect(buildCompetitionBody({ ...base, skill: '' }, now).ok).toBe(false)
    expect(buildCompetitionBody({ ...base, metric: '' }, now).ok).toBe(false)
  })
  it('rejects empty or past or far-off starts', () => {
    expect(buildCompetitionBody({ ...base, startDate: '' }, now).error).toMatch(/start date and time/)
    expect(buildCompetitionBody({ ...base, startTime: '' }, now).ok).toBe(false)
    expect(buildCompetitionBody({ ...base, ...fields(at(2026, 11, 14, 12, 0), at(2026, 11, 21, 12, 0)) }, now).error).toMatch(/already passed/)
    expect(buildCompetitionBody({ ...base, ...fields(at(2027, 6, 1, 12, 0), at(2027, 6, 8, 12, 0)) }, now).error).toMatch(/90 days/)
  })
  it('rejects an empty end, one before the start, one too soon, and one more than 60 days away', () => {
    expect(buildCompetitionBody({ ...base, endDate: '' }, now).error).toMatch(/end date and time/)
    expect(buildCompetitionBody({ ...base, ...fields(now, at(2026, 11, 10, 12, 0)) }, now).error).toMatch(/after the start/)
    expect(buildCompetitionBody({ ...base, ...fields(now, at(2026, 11, 14, 15, 50)) }, now).error).toMatch(/at least 1 hour/)
    expect(buildCompetitionBody({ ...base, ...fields(now, at(2027, 2, 1, 12, 0)) }, now).error).toMatch(/at most 60 days/)
  })
})

describe('setting the fields', () => {
  it('sets the start to now', () => {
    const f = { ...base, startDate: '2026-12-01', startTime: '08:00' }
    setStartNow(f, now)
    expect([f.startDate, f.startTime]).toEqual(['2026-11-14', '15:20'])
  })
  it('sets the end a length after the start', () => {
    const f = { ...base, ...fields(at(2026, 11, 20, 18, 0), at(2026, 11, 21, 18, 0)) }
    applyLength(f, 3 * 86_400_000, now)
    expect([f.endDate, f.endTime]).toEqual(['2026-11-23', '18:00'])
  })
  it('counts from now when the start is empty or already behind us', () => {
    const f = { ...base, startDate: '', startTime: '' }
    applyLength(f, 86_400_000, now)
    expect([f.endDate, f.endTime]).toEqual(['2026-11-15', '15:20'])
  })
  it('joins date and time inputs into a moment, or null', () => {
    expect(joinLocal('2026-11-14', '15:20').getTime()).toBe(now.getTime())
    expect(joinLocal('', '15:20')).toBeNull()
    expect(joinLocal('2026-11-14', '')).toBeNull()
    expect(joinLocal('nope', '15:20')).toBeNull()
  })
})

describe('describing the window', () => {
  it('spells out a date and time, adding the year only when it is not this year', () => {
    expect(fullDateTime(at(2026, 11, 20, 18, 30), now)).toMatch(/Fri, Nov 20/)
    expect(fullDateTime(at(2026, 11, 20, 18, 30), now)).not.toMatch(/2026/)
    expect(fullDateTime(at(2027, 1, 5, 9, 0), now)).toMatch(/2027/)
  })
  it('words the length', () => {
    expect(lengthText(7 * 86_400_000)).toBe('7 days')
    expect(lengthText(86_400_000)).toBe('1 day')
    expect(lengthText(36 * 3_600_000)).toBe('36 hours')
    expect(lengthText(3_600_000)).toBe('1 hour')
    expect(lengthText(3 * 86_400_000 + 12 * 3_600_000)).toBe('3 days 12 hours')
  })
  it('says "right away" for a start at this moment, and how far off a later one is', () => {
    const now2 = describeWindow(new Date(now), at(2026, 11, 21, 15, 20), now)
    expect(now2).toMatchObject({ rightAway: true, startText: 'Right away', length: '7 days' })
    const later = describeWindow(at(2026, 11, 14, 18, 20), at(2026, 11, 21, 18, 20), now)
    expect(later.rightAway).toBe(false)
    expect(later.startNote).toBe('in 3h')
    expect(later.startText).toMatch(/Sat, Nov 14/)
  })
})

describe('titles and clock', () => {
  it('suggests a title for each kind', () => {
    expect(defaultTitle('skill_xp', 'Fishing')).toBe('Fishing XP race')
    expect(defaultTitle('overall_xp', '')).toBe('Overall XP race')
  })
  it('words a duration', () => {
    expect(durationText(30_000)).toBe('under a minute')
    expect(durationText(12 * 60_000)).toBe('12m')
    expect(durationText((5 * 60 + 12) * 60_000)).toBe('5h 12m')
    expect(durationText(5 * 3_600_000)).toBe('5h')
    expect(durationText((2 * 24 + 5) * 3_600_000)).toBe('2d 5h')
    expect(durationText(-5)).toBe('under a minute')
  })
  it('says what the clock is doing', () => {
    const t = (h) => new Date(now.getTime() + h * 3_600_000).toISOString()
    const c = (status, s, e) => ({ status, startsAt: t(s), endsAt: t(e) })
    expect(clockText(c('scheduled', 5, 100), now.getTime())).toBe('Starts in 5h')
    expect(clockText(c('running', -2, 22), now.getTime())).toBe('Ends in 22h')
    expect(clockText(c('running', -30, -1), now.getTime())).toContain('Finishing up')
    expect(clockText(c('finished', -30, -1), now.getTime())).toMatch(/^Ended /)
    expect(clockText(c('cancelled', 1, 20), now.getTime())).toBe('Cancelled')
  })
})

describe('Skill of the Week', () => {
  const SKILLS = ['Attack', 'Defence', 'Strength', 'Hitpoints', 'Ranged', 'Prayer', 'Magic', 'Cooking', 'Woodcutting', 'Fletching', 'Fishing', 'Firemaking', 'Crafting', 'Smithing', 'Mining', 'Herblore', 'Agility', 'Thieving', 'Slayer', 'Farming', 'Runecraft', 'Hunter', 'Construction', 'Sailing']
  it('finds the Monday of a week and the one after', () => {
    // 14 Nov 2026 is a Saturday.
    expect(mondayOf(at(2026, 11, 14, 15, 20)).getTime()).toBe(at(2026, 11, 9).getTime())
    expect(mondayOf(at(2026, 11, 9, 0, 0)).getTime()).toBe(at(2026, 11, 9).getTime())
    expect(mondayOf(at(2026, 11, 15, 23, 59)).getTime()).toBe(at(2026, 11, 9).getTime())
    expect(nextMonday(at(2026, 11, 14, 15, 20)).getTime()).toBe(at(2026, 11, 16).getTime())
    expect(nextMonday(at(2026, 11, 16, 0, 0)).getTime()).toBe(at(2026, 11, 23).getTime())
  })
  it('features the same skill all week and a new one each Monday', () => {
    const week = ['2026-11-09', '2026-11-11', '2026-11-15'].map((d) => skillOfTheWeek(SKILLS, new Date(`${d}T12:00`)))
    expect(new Set(week).size).toBe(1)
    expect(skillOfTheWeek(SKILLS, new Date('2026-11-16T12:00'))).not.toBe(week[0])
  })
  it('goes through every skill before repeating', () => {
    const seen = new Set()
    for (let w = 0; w < SKILLS.length; w++) seen.add(skillOfTheWeek(SKILLS, new Date(2026, 0, 5 + 7 * w, 12)))
    expect(seen.size).toBe(SKILLS.length)
  })
  it('sets the form up for a week of one skill, starting now or on Monday', () => {
    const f = blankForm(now)
    applySotw(f, 'Fishing', 'now', now)
    expect(f).toMatchObject({ metric: 'skill_xp', skill: 'Fishing', title: sotwTitle('Fishing'), startDate: '2026-11-14', startTime: '15:20', endDate: '2026-11-21', endTime: '15:20' })
    applySotw(f, 'Fishing', 'monday', now)
    expect(f).toMatchObject({ startDate: '2026-11-16', startTime: '00:00', endDate: '2026-11-23', endTime: '00:00' })
    const r = buildCompetitionBody(f, now)
    expect(r.ok).toBe(true)
    expect(r.body.title).toBe('Skill of the Week: Fishing')
  })
})
