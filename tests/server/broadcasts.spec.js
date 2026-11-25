import { describe, expect, it } from 'vitest'
import { BROADCASTS, MAX_NOTICE_TEXT, broadcastDedupeKey } from '../../server/src/utils/broadcasts.js'
import { noticeKind } from '../../src/utils/noticeView.js'
import { isTypeMuted } from '../../server/src/utils/noticeGroups.js'

describe('one-off notices', () => {
  it('each has a type, a short text and a link inside the app', () => {
    for (const [key, b] of Object.entries(BROADCASTS)) {
      expect(key).toMatch(/^[a-z0-9-]+$/)
      expect(b.type).toBeTruthy()
      expect(b.text.length).toBeGreaterThan(10)
      expect(b.text.length).toBeLessThanOrEqual(MAX_NOTICE_TEXT)
      expect(b.link).toMatch(/^\/[^/]/)
    }
  })
  it('the weekly race notice has its own icon and a Join action, and cannot be muted by accident', () => {
    const b = BROADCASTS['weekly-race-2026-11']
    expect(noticeKind(b.type).action).toBe('Join')
    expect(noticeKind(b.type).paths.length).toBeGreaterThan(0)
    expect(isTypeMuted(b.type, ['records', 'mine', 'following', 'social'])).toBe(false)
  })
  it('keeps one notice per account for each', () => {
    expect(broadcastDedupeKey('weekly-race-2026-11')).toBe('broadcast:weekly-race-2026-11')
  })
})
