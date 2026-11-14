import { describe, it, expect } from 'vitest'
import { parseAvailability, pingWaitMinutes, MAX_WINDOW_HOURS } from '../../server/src/utils/claimAvailability.js'
import { pingMessage, startedMessage, windowText } from '../../server/src/services/discord.service.js'

const now = new Date('2026-11-14T12:00:00Z')
const iso = (h) => new Date(now.getTime() + h * 3_600_000).toISOString()

describe('parseAvailability', () => {
  it('treats no times as no window', () => {
    expect(parseAvailability({}, now)).toEqual({ ok: true, value: null })
    expect(parseAvailability(undefined, now)).toEqual({ ok: true, value: null })
  })
  it('accepts a window that is still to come', () => {
    const r = parseAvailability({ onlineFrom: iso(2), onlineUntil: iso(5) }, now)
    expect(r.ok).toBe(true)
    expect(r.value.from.toISOString()).toBe(iso(2))
  })
  it('accepts a window that has started but not ended', () => {
    expect(parseAvailability({ onlineFrom: iso(-1), onlineUntil: iso(2) }, now).ok).toBe(true)
  })
  it('rejects a lone time, junk, wrong order, a window that is over, too far off and too long', () => {
    expect(parseAvailability({ onlineFrom: iso(2) }, now).ok).toBe(false)
    expect(parseAvailability({ onlineFrom: 'soon', onlineUntil: 'later' }, now).ok).toBe(false)
    expect(parseAvailability({ onlineFrom: 5, onlineUntil: 6 }, now).ok).toBe(false)
    expect(parseAvailability({ onlineFrom: iso(5), onlineUntil: iso(2) }, now).ok).toBe(false)
    expect(parseAvailability({ onlineFrom: iso(-5), onlineUntil: iso(-2) }, now).ok).toBe(false)
    expect(parseAvailability({ onlineFrom: iso(24 * 20), onlineUntil: iso(24 * 20 + 2) }, now).ok).toBe(false)
    expect(parseAvailability({ onlineFrom: iso(1), onlineUntil: iso(1 + MAX_WINDOW_HOURS + 1) }, now).ok).toBe(false)
  })
})

describe('pingWaitMinutes', () => {
  it('is zero with no earlier ping or once the cooldown is over', () => {
    expect(pingWaitMinutes(null, 30, now)).toBe(0)
    expect(pingWaitMinutes(new Date(now.getTime() - 31 * 60_000), 30, now)).toBe(0)
  })
  it('counts the minutes left, rounded up', () => {
    expect(pingWaitMinutes(new Date(now.getTime() - 10 * 60_000), 30, now)).toBe(20)
    expect(pingWaitMinutes(new Date(now.getTime() - 29.5 * 60_000), 30, now)).toBe(1)
  })
})

describe('Discord messages', () => {
  const from = new Date('2026-11-15T18:00:00Z')
  const until = new Date('2026-11-15T22:00:00Z')
  it('show the window as timestamps Discord converts for the reader', () => {
    const t = windowText(from, until)
    expect(t).toContain(`<t:${from.getTime() / 1000}:f>`)
    expect(t).toContain(`<t:${until.getTime() / 1000}:t>`)
    expect(windowText(null, null)).toBe('')
  })
  it('say so when there is no window, and never include a code or email', () => {
    const m = startedMessage({ playerName: 'Lynx Titan' })
    expect(m).toContain('Lynx Titan')
    expect(m).toContain('did not say')
  })
  it('mention the owner on a ping only when an id is configured', () => {
    delete process.env.DISCORD_OWNER_ID
    expect(pingMessage({ playerName: 'Zezima' })).not.toContain('<@')
    process.env.DISCORD_OWNER_ID = '123456789012345678'
    expect(pingMessage({ playerName: 'Zezima' })).toContain('<@123456789012345678>')
    process.env.DISCORD_OWNER_ID = 'everyone'
    expect(pingMessage({ playerName: 'Zezima' })).not.toContain('<@')
    delete process.env.DISCORD_OWNER_ID
  })
})
