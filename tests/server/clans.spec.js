import { describe, it, expect } from 'vitest'
import { describeInvite, summarizeClans, cleanClanInput, cleanRsn, newInviteToken, newSlug, slugify } from '../../server/src/utils/clans.js'
import { FINALIZE_DEADLINE_MS, LATE_GRACE_MS, cleanCompetitionInput, competitionPhase, freezeResults, metricValue, standings, winnersOf } from '../../server/src/utils/competitions.js'

const SKILLS = ['Overall', 'Attack', 'Mining', 'Fishing']

describe('clan input', () => {
  it('accepts a normal name and tidies whitespace', () => {
    expect(cleanClanInput({ name: '  The   Iron\nClan  ', description: 'Weekly   XP races' })).toEqual({ ok: true, value: { name: 'The Iron Clan', description: 'Weekly XP races' } })
  })
  it('rejects names that are too short, missing, or contain links', () => {
    expect(cleanClanInput({ name: 'ab' }).ok).toBe(false)
    expect(cleanClanInput({}).ok).toBe(false)
    expect(cleanClanInput({ name: 'Join discord.gg now' }).ok).toBe(false)
    expect(cleanClanInput({ name: 'Fine name', description: 'see https://evil.example' }).ok).toBe(false)
    expect(cleanClanInput({ name: 'www.spam' }).ok).toBe(false)
  })
  it('cuts a name and description to their limits', () => {
    const v = cleanClanInput({ name: 'x'.repeat(100), description: 'y'.repeat(500) }).value
    expect(v.name).toHaveLength(40)
    expect(v.description).toHaveLength(200)
  })
})

describe('rsns, slugs and tokens', () => {
  it('accepts hiscores names only', () => {
    expect(cleanRsn(' Zezima ')).toBe('Zezima')
    expect(cleanRsn('a_b-c d')).toBe('a_b-c d')
    expect(cleanRsn('')).toBeNull()
    expect(cleanRsn('thirteenchars!')).toBeNull()
    expect(cleanRsn('bad<script>')).toBeNull()
    expect(cleanRsn(42)).toBeNull()
  })
  it('makes URL-safe slugs with a random part', () => {
    expect(slugify('The Iron Clan!!')).toBe('the-iron-clan')
    expect(slugify('!!!')).toBe('clan')
    const a = newSlug('The Iron Clan')
    expect(a).toMatch(/^the-iron-clan-[a-z2-9]{5}$/)
    expect(newSlug('The Iron Clan')).not.toBe(a)
  })
  it('makes long unique invite tokens', () => {
    const t = newInviteToken()
    expect(t).toMatch(/^[A-Za-z0-9_-]{20,}$/)
    expect(newInviteToken()).not.toBe(t)
  })
})

describe('cleanCompetitionInput', () => {
  const now = new Date('2026-11-14T12:00:00Z')
  const hours = (h) => new Date(now.getTime() + h * 3_600_000).toISOString()
  const ok = { title: 'Mining week', metric: 'skill_xp', skill: 'Mining', startsAt: hours(1), endsAt: hours(24 * 7 + 1) }
  it('accepts a valid competition', () => {
    const r = cleanCompetitionInput(ok, SKILLS, now)
    expect(r.ok).toBe(true)
    expect(r.value).toMatchObject({ title: 'Mining week', metric: 'skill_xp', skill: 'Mining' })
  })
  it('needs a skill for skill XP and ignores it for overall', () => {
    expect(cleanCompetitionInput({ ...ok, skill: '' }, SKILLS, now).ok).toBe(false)
    expect(cleanCompetitionInput({ ...ok, skill: 'Overall' }, SKILLS, now).ok).toBe(false)
    expect(cleanCompetitionInput({ ...ok, skill: 'Cheese' }, SKILLS, now).ok).toBe(false)
    expect(cleanCompetitionInput({ ...ok, metric: 'overall_xp', skill: 'Cheese' }, SKILLS, now).value.skill).toBe('')
  })
  it('rejects bad titles, metrics and times', () => {
    expect(cleanCompetitionInput({ ...ok, title: 'ab' }, SKILLS, now).ok).toBe(false)
    expect(cleanCompetitionInput({ ...ok, metric: 'levels' }, SKILLS, now).ok).toBe(false)
    expect(cleanCompetitionInput({ ...ok, startsAt: 'soon' }, SKILLS, now).ok).toBe(false)
    expect(cleanCompetitionInput({ ...ok, endsAt: ok.startsAt }, SKILLS, now).ok).toBe(false)
    expect(cleanCompetitionInput({ ...ok, endsAt: hours(1.5) }, SKILLS, now).ok).toBe(false)
    expect(cleanCompetitionInput({ ...ok, endsAt: hours(24 * 90) }, SKILLS, now).ok).toBe(false)
    expect(cleanCompetitionInput({ ...ok, startsAt: hours(24 * 100), endsAt: hours(24 * 101) }, SKILLS, now).ok).toBe(false)
    expect(cleanCompetitionInput({ ...ok, startsAt: hours(-2) }, SKILLS, now).ok).toBe(false)
  })
  it('treats a start a moment ago as now', () => {
    const r = cleanCompetitionInput({ ...ok, startsAt: new Date(now.getTime() - 60_000).toISOString() }, SKILLS, now)
    expect(r.ok).toBe(true)
    expect(r.value.startsAt.getTime()).toBe(now.getTime())
  })
})

describe('competitionPhase', () => {
  const c = { startsAt: '2026-11-14T12:00:00Z', endsAt: '2026-11-21T12:00:00Z' }
  it('follows the clock', () => {
    expect(competitionPhase(c, Date.parse('2026-11-14T11:59:59Z'))).toBe('scheduled')
    expect(competitionPhase(c, Date.parse('2026-11-14T12:00:00Z'))).toBe('running')
    expect(competitionPhase(c, Date.parse('2026-11-21T12:00:00Z'))).toBe('ended')
  })
})

describe('metricValue', () => {
  const snap = { overallXp: 5_000_000, skills: { Mining: { xp: 1_200_000 } } }
  it('reads the right number for each kind', () => {
    expect(metricValue('overall_xp', '', snap)).toBe(5_000_000)
    expect(metricValue('skill_xp', 'Mining', snap)).toBe(1_200_000)
    expect(metricValue('skill_xp', 'Fishing', snap)).toBe(0)
    expect(metricValue('overall_xp', '', null)).toBeNull()
  })
})

describe('standings', () => {
  const startsAt = '2026-11-14T12:00:00Z'
  const m = (name, startXp, currentXp, extra = {}) => ({ playerId: name, username: name, displayName: name, startXp, currentXp, joinedAt: '2026-11-14T11:00:00Z', ...extra })
  it('ranks by gain, biggest first, with the gap to the player above', () => {
    const rows = standings([m('b', 100, 400), m('a', 100, 900), m('c', 100, 150)], { startsAt })
    expect(rows.map((r) => [r.username, r.gain, r.rank, r.gapToAbove])).toEqual([['a', 800, 1, null], ['b', 300, 2, 500], ['c', 50, 3, 250]])
  })
  it('shares a rank for a tie and skips the next one', () => {
    const rows = standings([m('a', 0, 500), m('b', 0, 500), m('c', 0, 100)], { startsAt })
    expect(rows.map((r) => [r.username, r.rank])).toEqual([['a', 1], ['b', 1], ['c', 3]])
    expect(rows[1].gapToAbove).toBe(0)
  })
  it('uses the end XP once it is set, and never goes below zero', () => {
    const rows = standings([m('a', 100, 9999, { endXp: 300 }), m('b', 500, 400)], { startsAt })
    expect(rows[0]).toMatchObject({ username: 'a', gain: 200 })
    expect(rows[1].gain).toBe(0)
  })
  it('puts entrants without a start last, marked pending', () => {
    const rows = standings([m('new', null, 500), m('a', 0, 10)], { startsAt })
    expect(rows.map((r) => r.username)).toEqual(['a', 'new'])
    expect(rows[1]).toMatchObject({ pending: true, gain: 0, rank: 2 })
  })
  it('marks someone who joined after the start window as a late joiner', () => {
    const late = new Date(Date.parse(startsAt) + LATE_GRACE_MS + 60_000).toISOString()
    const rows = standings([m('a', 0, 10, { joinedAt: late }), m('b', 0, 5)], { startsAt })
    expect(rows.find((r) => r.username === 'a').joinedLate).toBe(true)
    expect(rows.find((r) => r.username === 'b').joinedLate).toBe(false)
  })
  it('breaks equal gains by name so the order is stable', () => {
    const rows = standings([m('zed', 0, 5), m('Amy', 0, 5)], { startsAt })
    expect(rows.map((r) => r.username)).toEqual(['Amy', 'zed'])
  })
})

describe('results', () => {
  const rows = standings(
    [{ playerId: 1, username: 'a', displayName: 'A', startXp: 0, endXp: 500, joinedAt: '2026-11-14T11:00:00Z' }, { playerId: 2, username: 'b', displayName: 'B', startXp: 0, endXp: 500, joinedAt: '2026-11-14T11:00:00Z' }, { playerId: 3, username: 'c', displayName: 'C', startXp: 0, endXp: 5, joinedAt: '2026-11-14T11:00:00Z' }],
    { startsAt: '2026-11-14T12:00:00Z' },
  )
  it('freezes the standing without live fields', () => {
    const frozen = freezeResults(rows)
    expect(frozen[0]).toEqual({ playerId: 1, username: 'a', displayName: 'A', rank: 1, gain: 500, startXp: 0, endXp: 500, joinedLate: false, pending: false })
  })
  it('names every player tied for first as a winner, and nobody when no one gained', () => {
    expect(winnersOf(freezeResults(rows)).map((r) => r.username)).toEqual(['a', 'b'])
    expect(winnersOf(freezeResults(standings([{ playerId: 1, username: 'a', startXp: 5, endXp: 5, joinedAt: '2026-11-14T11:00:00Z' }], { startsAt: '2026-11-14T12:00:00Z' })))).toEqual([])
  })
  it('gives finalizing a deadline', () => {
    expect(FINALIZE_DEADLINE_MS).toBe(30 * 60_000)
  })
})

describe('describeInvite', () => {
  it('says how many are in and what is on', () => {
    expect(describeInvite({ name: 'Iron', memberCount: 12, competitions: [{ title: 'Mining sprint', label: 'Mining XP', status: 'running' }] })).toBe('12 members. Running now: Mining sprint (Mining XP). Ask to join with your RuneScape name.')
    expect(describeInvite({ name: 'Iron', memberCount: 3, competitions: [{ title: 'Big week', label: 'Overall XP', status: 'scheduled' }] })).toContain('Starting soon: Big week (Overall XP)')
  })
  it('falls back to a plain invitation with no competition, and handles one member', () => {
    expect(describeInvite({ name: 'Iron', memberCount: 1, competitions: [] })).toBe('1 member. Ask to join Iron with your RuneScape name, no account needed.')
  })
})

describe('summarizeClans', () => {
  const clan = (id, name, extra = {}) => ({ id, slug: `${name.toLowerCase().replace(/ /g, '-')}-abc12`, name, description: '', created_at: '2026-11-01T00:00:00Z', ...extra })
  const member = (clan_id, username, week_gain, overall_level = 1000) => ({ clan_id, username, display_name: username, week_gain, overall_level })
  const comp = (id, clan_id, status, starts, ends, extra = {}) => ({ id, clan_id, title: `Comp ${id}`, label: 'Mining XP', status, starts_at: starts, ends_at: ends, entrants: 5, ...extra })

  const out = summarizeClans(
    [clan(1, 'Quiet Clan'), clan(2, 'Busy Clan'), clan(3, 'Big Clan')],
    [member(1, 'a', 0), member(2, 'b', 1_000_000), member(2, 'c', 3_000_000), member(2, 'd', 500), member(2, 'e', 2_000_000), member(3, 'f', 100_000), member(3, 'g', 0), member(3, 'h', 0)],
    [comp(10, 2, 'scheduled', '2026-11-20T00:00:00Z', '2026-11-27T00:00:00Z'), comp(11, 2, 'running', '2026-11-14T00:00:00Z', '2026-11-18T00:00:00Z'), comp(12, 3, 'running', '2026-11-14T00:00:00Z', '2026-11-16T00:00:00Z')],
  )
  it('ranks clans by this week\'s XP, then size', () => {
    expect(out.clans.map((c) => c.name)).toEqual(['Busy Clan', 'Big Clan', 'Quiet Clan'])
  })
  it('totals a clan\'s week and lists its three top gainers', () => {
    const busy = out.clans[0]
    expect(busy.weekGain).toBe(6_000_500)
    expect(busy.memberCount).toBe(4)
    expect(busy.topMembers.map((m) => m.username)).toEqual(['c', 'e', 'b'])
  })
  it('puts a clan\'s running competition before an upcoming one', () => {
    expect(out.clans[0].competitions.map((c) => c.status)).toEqual(['running', 'scheduled'])
  })
  it('lists the running competitions across clans, soonest to end first', () => {
    expect(out.running.map((c) => [c.id, c.clan.name])).toEqual([[12, 'Big Clan'], [11, 'Busy Clan']])
  })
  it('gives the page totals', () => {
    expect(out.totals).toEqual({ clans: 3, members: 8, runningCompetitions: 2, weekGain: 6_100_500 })
  })
  it('copes with nothing listed and with a clan that has no members', () => {
    expect(summarizeClans([], [], []).totals).toEqual({ clans: 0, members: 0, runningCompetitions: 0, weekGain: 0 })
    const empty = summarizeClans([clan(9, 'Empty Clan')], [], [])
    expect(empty.clans[0]).toMatchObject({ memberCount: 0, weekGain: 0, topMembers: [], competitions: [] })
  })
  it('never counts a negative week', () => {
    expect(summarizeClans([clan(1, 'X Clan')], [member(1, 'a', -500)], []).clans[0].weekGain).toBe(0)
  })
})
