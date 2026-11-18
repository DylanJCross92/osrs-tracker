import { describe, expect, it } from 'vitest'
import { VISITOR_ID_DAYS, getVisitorId, newVisitorId } from '@/utils/visitorId'
import { describeEvent } from '@/utils/describeEvent'

const memory = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}
const DAY = 86_400_000
const T0 = Date.parse('2026-11-18T12:00:00Z')

describe('getVisitorId', () => {
  it('makes a random 32 character id and keeps it', () => {
    const storage = memory()
    const a = getVisitorId({ storage, now: T0, dnt: false })
    expect(a).toMatch(/^[a-f0-9]{32}$/)
    expect(getVisitorId({ storage, now: T0 + DAY, dnt: false })).toBe(a)
    expect(newVisitorId()).not.toBe(newVisitorId())
  })
  it('replaces the id after 90 days', () => {
    const storage = memory()
    const a = getVisitorId({ storage, now: T0, dnt: false })
    expect(getVisitorId({ storage, now: T0 + (VISITOR_ID_DAYS - 1) * DAY, dnt: false })).toBe(a)
    expect(getVisitorId({ storage, now: T0 + (VISITOR_ID_DAYS + 1) * DAY, dnt: false })).not.toBe(a)
  })
  it('gives nothing, and removes what it had, when the browser asks not to be tracked', () => {
    const storage = memory()
    getVisitorId({ storage, now: T0, dnt: false })
    expect(getVisitorId({ storage, now: T0, dnt: true })).toBeNull()
    expect(storage.getItem('tickgains-vid-v1')).toBeNull()
  })
  it('replaces a damaged value and copes with storage that fails', () => {
    const storage = memory()
    storage.setItem('tickgains-vid-v1', '{oops')
    expect(getVisitorId({ storage, now: T0, dnt: false })).toMatch(/^[a-f0-9]{32}$/)
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem() {} }
    expect(getVisitorId({ storage: broken, now: T0, dnt: false })).toBeNull()
  })
})

describe('describeEvent', () => {
  it('reads a page view as the page', () => {
    expect(describeEvent('spa_page_view', { page_path: '/player/zezima', page_title: 'x' })).toEqual({ kind: 'page', text: 'Viewed', detail: '/player/zezima' })
  })
  it('reads other events as words with their details', () => {
    expect(describeEvent('plan_share', { method: 'copy_link', goals: 3 })).toEqual({ kind: 'action', text: 'Plan share', detail: 'method: copy_link · goals: 3' })
    expect(describeEvent('login', { method: 'email_link' })).toEqual({ kind: 'action', text: 'Signed in', detail: 'email link' })
    expect(describeEvent('search_started', {}).detail).toBe('')
  })
})
