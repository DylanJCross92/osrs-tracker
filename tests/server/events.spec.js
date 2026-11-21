import { describe, it, expect } from 'vitest'
import { askedNotToTrack, isCrawler, cleanEvents, cleanProps, summarizeBreakdown, summarizeEvents, MAX_BATCH, MAX_STRING } from '../../server/src/utils/events.js'

describe('cleanProps', () => {
  it('keeps short strings, numbers and booleans', () => {
    expect(cleanProps({ skill: 'Mining', goals: 3, ok: true })).toEqual({ skill: 'Mining', goals: 3, ok: true })
  })
  it('turns camelCase keys into snake_case', () => {
    expect(cleanProps({ hadPlan: true, hasPlayer: false })).toEqual({ had_plan: true, has_player: false })
  })
  it('drops anything that could name a person or carry text they typed', () => {
    const out = cleanProps({ player_name: 'Zezima', username: 'x', email: 'a@b.c', query: 'abc', clan_name: 'Foo', username_length: 6, skill: 'Cooking' })
    expect(out).toEqual({ username_length: 6, skill: 'Cooking' })
  })
  it('keeps the player a search was for', () => {
    expect(cleanProps({ player: 'Zezima', source: 'home', username_length: 6 })).toEqual({ player: 'Zezima', source: 'home', username_length: 6 })
  })
  it('drops an email-looking value whatever the key is', () => {
    expect(cleanProps({ source: 'me@example.com', tab: 'stats' })).toEqual({ tab: 'stats' })
  })
  it('drops objects, arrays, nulls and bad numbers', () => {
    expect(cleanProps({ a: { b: 1 }, b: [1], c: null, d: NaN, e: Infinity, f: 'ok' })).toEqual({ f: 'ok' })
  })
  it('cuts long strings and ignores bad keys', () => {
    expect(cleanProps({ note: 'x'.repeat(500) }).note).toHaveLength(MAX_STRING)
    expect(cleanProps({ 'bad key!': 'x', '1abc': 'y' })).toEqual({})
  })
  it('keeps at most 12 details and drops an oversized set', () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]))
    expect(Object.keys(cleanProps(many))).toHaveLength(12)
    const big = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`key${i}`, 'v'.repeat(80)]))
    expect(cleanProps(big)).toEqual({})
  })
  it('handles junk input', () => {
    for (const bad of [null, undefined, 'x', 5, []]) expect(cleanProps(bad)).toEqual({})
  })
})

describe('cleanEvents', () => {
  it('keeps valid events and skips invalid names', () => {
    const { events } = cleanEvents({ events: [{ name: 'profile_view', props: { tab: 'stats' } }, { name: 'Bad Name' }, { name: '' }, { props: {} }, null, { name: 'x' }] })
    expect(events).toEqual([{ name: 'profile_view', props: { tab: 'stats' } }])
  })
  it('lowercases names and caps the batch', () => {
    const list = Array.from({ length: 60 }, () => ({ name: 'Planner_Plan_Saved' }))
    const { events } = cleanEvents({ events: list })
    expect(events).toHaveLength(MAX_BATCH)
    expect(events[0].name).toBe('planner_plan_saved')
  })
  it('reads the anonymous flag only when it is exactly true', () => {
    expect(cleanEvents({ events: [], anon: true }).anon).toBe(true)
    expect(cleanEvents({ events: [], anon: 'yes' }).anon).toBe(false)
    expect(cleanEvents({}).anon).toBe(false)
  })
  it('survives a body that is not an object', () => {
    expect(cleanEvents(undefined)).toEqual({ events: [], anon: false, vid: null })
    expect(cleanEvents({ events: 'no' })).toEqual({ events: [], anon: false, vid: null })
  })
})

describe('summarizeEvents', () => {
  it('lays each event out day by day, busiest first', () => {
    const out = summarizeEvents(
      [{ name: 'a', day: '2026-01-09', n: 2 }, { name: 'a', day: '2026-01-10', n: 5 }, { name: 'b', day: '2026-01-10', n: 9 }],
      [{ name: 'a', total: 7, accounts: 2, accounts_today: 1 }, { name: 'b', total: 9, accounts: 0 }],
      3,
      '2026-01-10',
    )
    expect(out.map((e) => e.name)).toEqual(['b', 'a'])
    expect(out[1]).toMatchObject({ total: 7, accounts: 2, accountsToday: 1, today: 5, daily: [0, 2, 5] })
  })
  it('ignores days outside the window', () => {
    const out = summarizeEvents([{ name: 'a', day: '2025-12-01', n: 4 }], [{ name: 'a', total: 4, accounts: 0 }], 3, '2026-01-10')
    expect(out[0].daily).toEqual([0, 0, 0])
  })
})

describe('summarizeBreakdown', () => {
  it('lists the most common values of each detail', () => {
    const out = summarizeBreakdown([{ k: 'skill', v: 'Mining', n: 3 }, { k: 'skill', v: 'Fishing', n: 9 }, { k: 'tab', v: 'a', n: 1 }], 1)
    expect(out).toEqual({ skill: [{ value: 'Fishing', n: 9 }], tab: [{ value: 'a', n: 1 }] })
  })
})

describe('sign-in events', () => {
  it('ignores login and session_resumed sent by a browser (the server counts those)', () => {
    const { events } = cleanEvents({ events: [{ name: 'login' }, { name: 'session_resumed' }, { name: 'dashboard_refresh' }] })
    expect(events.map((e) => e.name)).toEqual(['dashboard_refresh'])
  })

  it('reads Do Not Track and Global Privacy Control from request headers', () => {
    expect(askedNotToTrack({ dnt: '1' })).toBe(true)
    expect(askedNotToTrack({ 'sec-gpc': '1' })).toBe(true)
    expect(askedNotToTrack({ dnt: '0' })).toBe(false)
    expect(askedNotToTrack({})).toBe(false)
    expect(askedNotToTrack()).toBe(false)
  })
})

describe('isCrawler', () => {
  it('spots search engines, rendering services and scripts', () => {
    const bots = [
      'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/125.0.0.0 Safari/537.36',
      'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
      'python-requests/2.31.0',
      'Mozilla/5.0 (Linux; Android 11; Chrome-Lighthouse) AppleWebKit/537.36 Chrome/109 Mobile Safari/537.36',
      'Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)',
      '',
      undefined,
    ]
    for (const ua of bots) expect(isCrawler(ua), String(ua)).toBe(true)
  })
  it('leaves real browsers alone, including phones with "bot" in the name', () => {
    const people = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 12; CUBOT_X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 DuckDuckGo/7 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    ]
    for (const ua of people) expect(isCrawler(ua), ua).toBe(false)
  })
})
