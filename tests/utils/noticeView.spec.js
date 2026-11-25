import { describe, expect, it } from 'vitest'
import { bellTotal, dayBucket, foldRuns, noticeKind, sectionsByDay, seenKey, seenNow } from '@/utils/noticeView'

const now = new Date(2026, 10, 18, 15, 0)
const at = (daysAgo, hour = 9) => new Date(2026, 10, 18 - daysAgo, hour).toISOString()
const rec = (id, daysAgo, subject = 'Zezima') => ({ id, type: 'record', subject, createdAt: at(daysAgo), read: false })

describe('noticeKind', () => {
  it('gives each kind an icon and tone, and marks the ones waiting on you with an action', () => {
    expect(noticeKind('record').tone).toBe('gold')
    expect(noticeKind('cheer').tone).toBe('rose')
    expect(noticeKind('claims_waiting').action).toBe('Review')
    expect(noticeKind('record').action).toBe('')
  })
  it('keeps the weekly race notice that was sent to everyone looking right in their bell', () => {
    expect(noticeKind('race_open')).toMatchObject({ tone: 'gold', action: 'Join' })
  })
  it('falls back to a plain bell for an unknown type', () => {
    expect(noticeKind('something_new').paths.length).toBeGreaterThan(0)
  })
})

describe('dayBucket', () => {
  it('names the day by calendar day, not by hours', () => {
    expect(dayBucket(at(0, 1), now)).toBe('Today')
    expect(dayBucket(at(1, 23), now)).toBe('Yesterday')
    expect(dayBucket(at(3), now)).toBe('This week')
    expect(dayBucket(at(9), now)).toBe('Earlier')
  })
})

describe('foldRuns', () => {
  it('folds three or more of the same kind about the same player into the newest one', () => {
    const rows = foldRuns([rec(5, 0), rec(4, 1), rec(3, 2), rec(2, 3)])
    expect(rows).toHaveLength(1)
    expect(rows[0].n.id).toBe(5)
    expect(rows[0].more).toEqual({ count: 3, open: false })
  })
  it('shows the rest, indented, when the run is opened', () => {
    const rows = foldRuns([rec(5, 0), rec(4, 1), rec(3, 2)], new Set(['run-5']))
    expect(rows.map((r) => [r.n.id, !!r.child])).toEqual([[5, false], [4, true], [3, true]])
    expect(rows[0].more.open).toBe(true)
  })
  it('leaves short runs and notices about different players alone', () => {
    expect(foldRuns([rec(3, 0), rec(2, 1)])).toHaveLength(2)
    expect(foldRuns([rec(3, 0, 'A'), rec(2, 1, 'B'), rec(1, 2, 'A')])).toHaveLength(3)
  })
  it('never folds notices with no player', () => {
    const none = [1, 2, 3].map((id) => ({ id, type: 'claim_approved', subject: null, createdAt: at(0) }))
    expect(foldRuns(none)).toHaveLength(3)
  })
})

describe('sectionsByDay', () => {
  it('groups rows under their heading in order', () => {
    const rows = foldRuns([rec(1, 0), { id: 2, type: 'cheer', subject: null, createdAt: at(0, 2) }, rec(3, 1), rec(4, 20)])
    expect(sectionsByDay(rows, now).map((s) => [s.label, s.rows.length])).toEqual([['Today', 2], ['Yesterday', 1], ['Earlier', 1]])
  })
})

describe('claims waiting and the bell number', () => {
  const claim = { id: 'claim-waiting-7', type: 'claims_waiting', count: 1 }
  const clan = { id: 'clan-request-x', type: 'clan_request', count: 1 }
  const data = { items: [claim, clan], unread: 2, total: 4 }

  it('counts everything until the claim line has been seen', () => {
    expect(bellTotal(data, new Set())).toBe(4)
  })
  it('stops counting a claim line once it was seen, but nothing else', () => {
    expect(bellTotal(data, seenNow(data.items))).toBe(3)
  })
  it('only claim lines are remembered', () => {
    expect([...seenNow(data.items)]).toEqual(['claim-waiting-7:1'])
    expect(seenKey(clan)).toBeNull()
  })
  it('a new claim changes the line, so it counts as new again', () => {
    const seen = seenNow([claim])
    const more = { items: [{ id: 'claim-waiting-8', type: 'claims_waiting', count: 1 }, claim], unread: 0, total: 2 }
    expect(bellTotal(more, seen)).toBe(1)
  })
  it('never goes below zero', () => {
    expect(bellTotal({ items: [claim], unread: 0, total: 0 }, seenNow([claim]))).toBe(0)
  })
})
