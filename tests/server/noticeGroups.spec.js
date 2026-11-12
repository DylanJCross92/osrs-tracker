import { describe, expect, it } from 'vitest'
import { isTypeMuted, NOTICE_GROUPS } from '../../server/src/utils/noticeGroups.js'
import { sanitizeSettings } from '../../server/src/utils/settings.js'

describe('notice groups', () => {
  it('mutes only the types in a switched-off group', () => {
    expect(isTypeMuted('record', ['records'])).toBe(true)
    expect(isTypeMuted('milestone', ['records'])).toBe(false)
    expect(isTypeMuted('follow_goal', ['following', 'social'])).toBe(true)
    expect(isTypeMuted('record', [])).toBe(false)
    expect(isTypeMuted('record', null)).toBe(false)
  })

  it('never mutes claim updates, which belong to no group', () => {
    const all = Object.keys(NOTICE_GROUPS)
    expect(isTypeMuted('claim_approved', all)).toBe(false)
    expect(isTypeMuted('claim_rejected', all)).toBe(false)
  })

  it('keeps only known groups in the saved setting, without duplicates', () => {
    expect(sanitizeSettings({ muteNotices: ['records', 'nonsense', 'records', 'social'] })).toEqual({ muteNotices: ['records', 'social'] })
    expect(sanitizeSettings({ muteNotices: 'records' })).toEqual({})
    expect(sanitizeSettings({ muteNotices: [] })).toEqual({ muteNotices: [] })
  })
})
