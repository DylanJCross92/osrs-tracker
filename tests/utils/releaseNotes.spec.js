import { describe, expect, it } from 'vitest'
import { KINDS, RELEASE_NOTES } from '@/data/releaseNotes'

// The release notes are written by hand, so the shape is checked: real dates, newest first, one entry per day, each line a plain sentence of a known kind.
describe('release notes', () => {
  it('has real dates, newest first, one entry for each day', () => {
    const dates = RELEASE_NOTES.map((d) => d.date)
    for (const d of dates) {
      expect(d, d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(new Date(`${d}T12:00:00Z`).getTime()), d).toBe(false)
    }
    expect(new Set(dates).size).toBe(dates.length)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('has at least one line in every day (days with nothing are not listed)', () => {
    for (const d of RELEASE_NOTES) expect(d.items.length, d.date).toBeGreaterThan(0)
  })

  it('gives every line a known kind and some plain text', () => {
    for (const d of RELEASE_NOTES) {
      for (const item of d.items) {
        expect(Object.keys(KINDS), `${d.date}: ${item.text}`).toContain(item.kind)
        expect(item.text.trim().length, `${d.date}`).toBeGreaterThan(15)
        // The site does not use em dashes, and a note is a sentence, not a dev note.
        expect(item.text, `${d.date}`).not.toMatch(/—/)
        expect(item.text, `${d.date}`).not.toMatch(/\b(commit|refactor|css class)\b/i)
      }
    }
  })

  it('starts with the launch and has every kind somewhere', () => {
    expect(RELEASE_NOTES[RELEASE_NOTES.length - 1].date).toBe('2026-11-05')
    const kinds = new Set(RELEASE_NOTES.flatMap((d) => d.items.map((i) => i.kind)))
    expect([...kinds].sort()).toEqual(Object.keys(KINDS).sort())
  })
})
