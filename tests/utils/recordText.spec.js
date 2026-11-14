import { describe, it, expect } from 'vitest'
import { recordNowNoun, recordNowParts, recordNowTag } from '@/utils/recordText'

describe('records being set right now', () => {
  it('names each kind of record in plain words', () => {
    expect(recordNowNoun({ key: 'longest-streak' })).toBe('record streak')
    expect(recordNowNoun({ key: 'best-day' })).toBe('record day')
    expect(recordNowNoun({ key: 'best-week' })).toBe('record week')
    expect(recordNowNoun({ key: 'skill-mining' })).toBe('new record')
    expect(recordNowNoun(undefined)).toBe('new record')
  })
  it('capitalises the name for the small tag', () => {
    expect(recordNowTag({ key: 'longest-streak' })).toBe('Record streak')
    expect(recordNowTag({ key: 'whatever' })).toBe('New record')
  })
  it('says "A record streak is underway." for one record', () => {
    expect(recordNowParts([{ key: 'longest-streak', title: 'Longest streak' }])).toEqual({ lead: 'A record streak', rest: 'is underway.' })
  })
  it('lists several records by title', () => {
    expect(recordNowParts([{ key: 'longest-streak', title: 'Longest streak' }, { key: 'best-day', title: 'Biggest day' }])).toEqual({
      lead: '2 records',
      rest: 'are underway: longest streak, biggest day.',
    })
  })
})
