import { describe, expect, it } from 'vitest'
import { buildJourney, parsePersonKey, silentVisitor } from '../../server/src/utils/journeys.js'
import { cleanEvents, cleanVisitorId } from '../../server/src/utils/events.js'

const id = 'a'.repeat(32)

describe('parsePersonKey', () => {
  it('reads an account or a browser id, and nothing else', () => {
    expect(parsePersonKey('a:12')).toEqual({ kind: 'account', id: 12 })
    expect(parsePersonKey(`v:${id}`)).toEqual({ kind: 'visitor', id })
    expect(parsePersonKey('a:12; DROP TABLE users')).toBeNull()
    expect(parsePersonKey('v:short')).toBeNull()
    expect(parsePersonKey(undefined)).toBeNull()
  })
})

describe('buildJourney', () => {
  const rows = [
    { at: '2026-11-18T14:05:00Z', name: 'search_started', props: {} },
    { at: '2026-11-18T14:00:00Z', name: 'spa_page_view', props: { page_path: '/' } },
    { at: '2026-11-18T14:20:00Z', name: 'spa_page_view', props: { page_path: '/player/zezima' } },
    { at: '2026-11-17T09:00:00Z', name: 'spa_page_view', props: { page_path: '/planner' } },
    { at: 'not a date', name: 'broken', props: {} },
  ]
  const j = buildJourney(rows, 3, '2026-11-18')

  it('puts the newest visit first and the newest step first inside a visit', () => {
    expect(j.sessions).toHaveLength(2)
    expect(j.sessions[0].events.map((e) => e.at)).toEqual(['2026-11-18T14:20:00.000Z', '2026-11-18T14:05:00.000Z', '2026-11-18T14:00:00.000Z'])
    expect(j.sessions[1].events.map((e) => e.props.page_path)).toEqual(['/planner'])
  })
  it('counts steps and page views, skipping rows with no usable time', () => {
    expect(j.count).toBe(4)
    expect(j.pages).toBe(3)
    expect(j.first).toBe('2026-11-17T09:00:00.000Z')
    expect(j.last).toBe('2026-11-18T14:20:00.000Z')
  })
  it('gives one point per day for the whole window, quiet days included', () => {
    expect(j.daily).toEqual([
      { day: '2026-11-16', n: 0 },
      { day: '2026-11-17', n: 1 },
      { day: '2026-11-18', n: 3 },
    ])
  })
  it('starts a new visit after a quiet gap', () => {
    const out = buildJourney([{ at: '2026-11-18T10:00:00Z', name: 'a' }, { at: '2026-11-18T10:31:00Z', name: 'b' }], 1, '2026-11-18')
    expect(out.sessions).toHaveLength(2)
    expect(buildJourney([{ at: '2026-11-18T10:00:00Z', name: 'a' }, { at: '2026-11-18T10:30:00Z', name: 'b' }], 1, '2026-11-18').sessions).toHaveLength(1)
  })
  it('handles nobody', () => {
    expect(buildJourney([], 2, '2026-11-18')).toMatchObject({ count: 0, first: null, last: null, sessions: [] })
  })
})

describe('the visitor id on events', () => {
  it('accepts only 32 hex characters', () => {
    expect(cleanVisitorId(id)).toBe(id)
    expect(cleanVisitorId('A'.repeat(32))).toBeNull()
    expect(cleanVisitorId('abc')).toBeNull()
    expect(cleanVisitorId(42)).toBeNull()
  })
  it('keeps the id on events, and never for a browser that asked not to be tracked', () => {
    const events = [{ name: 'profile_view', props: {} }]
    expect(cleanEvents({ events, vid: id }).vid).toBe(id)
    expect(cleanEvents({ events, vid: id, anon: true }).vid).toBeNull()
    expect(cleanEvents({ events }).vid).toBeNull()
  })
})

describe('requests nobody made by hand', () => {
  it('does not record a view of a /.well-known file, whatever else arrives with it', () => {
    const events = [
      { name: 'spa_page_view', props: { page_path: '/.well-known/apple-app-site-association' } },
      { name: 'spa_page_view', props: { page_path: '/planner' } },
    ]
    expect(cleanEvents({ events }).events.map((e) => e.props.page_path)).toEqual(['/planner'])
  })
})

describe('visitors that never interacted', () => {
  it('does not count the interaction as a step, but knows it happened', () => {
    const at = (m) => `2026-11-18T12:0${m}:00Z`
    const j = buildJourney([{ at: at(0), name: 'spa_page_view', props: {} }, { at: at(1), name: 'page_interacted', props: {} }], 3, '2026-11-18')
    expect(j.count).toBe(1)
    expect(j.interacted).toBe(true)
    expect(buildJourney([{ at: at(0), name: 'spa_page_view', props: {} }], 3, '2026-11-18').interacted).toBe(false)
  })

  it('calls a visitor silent only if the site was already recording interactions when they came', () => {
    const shipAt = '2026-11-20T00:00:00Z'
    expect(silentVisitor({ interacted: false, first: '2026-11-21T00:00:00Z', shipAt, kind: 'visitor' })).toBe(true)
    expect(silentVisitor({ interacted: true, first: '2026-11-21T00:00:00Z', shipAt, kind: 'visitor' })).toBe(false)
    expect(silentVisitor({ interacted: false, first: '2026-11-19T00:00:00Z', shipAt, kind: 'visitor' })).toBe(false) // before it shipped
    expect(silentVisitor({ interacted: false, first: '2026-11-21T00:00:00Z', shipAt: null, kind: 'visitor' })).toBe(false)
    // one that stayed open for half a minute is someone reading, not a scanner passing through
    expect(silentVisitor({ interacted: false, first: '2026-11-21T00:00:00Z', last: '2026-11-21T00:00:29Z', shipAt, kind: 'visitor' })).toBe(false)
    expect(silentVisitor({ interacted: false, first: '2026-11-21T00:00:00Z', last: '2026-11-21T00:00:02Z', shipAt, kind: 'visitor' })).toBe(true)
    expect(silentVisitor({ interacted: false, first: '2026-11-21T00:00:00Z', shipAt, kind: 'account' })).toBe(false)
  })
})
