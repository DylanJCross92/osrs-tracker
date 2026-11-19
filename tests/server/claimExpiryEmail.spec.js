import { describe, expect, it } from 'vitest'
import { claimExpiryEmail, deadlineLabel } from '../../server/src/utils/claimExpiryEmail.js'

const PLAYER = { username: 'Sir Example', displayName: 'Sir Example' }
const DEADLINE = '2026-11-21T15:20:00.000Z'

describe('claimExpiryEmail', () => {
  it('names the player and the 48 hours in the subject and body', () => {
    const { subject, html, text } = claimExpiryEmail({ player: PLAYER, deadline: DEADLINE, contact: 'Dylanz297' })
    expect(subject).toBe('Your claim for Sir Example closes in 48 hours')
    expect(html).toContain('You have <strong')
    expect(text).toContain('You have 48 hours to finish it.')
  })
  it('says when it closes, in one fixed zone, and who to message', () => {
    const { text } = claimExpiryEmail({ player: PLAYER, deadline: DEADLINE, contact: 'Dylanz297' })
    expect(text).toContain('Claim closes: Sat, Nov 21, 3:20 PM UTC')
    expect(text).toContain('Message in game: Dylanz297')
  })
  it('says a new claim can be opened afterwards', () => {
    expect(claimExpiryEmail({ player: PLAYER, deadline: DEADLINE }).text).toContain('open a new claim whenever you like')
  })
  it('links to the profile page and never carries a claim code or an address', () => {
    const { html, text } = claimExpiryEmail({ player: PLAYER, deadline: DEADLINE, contact: 'Dylanz297' })
    expect(text).toContain('https://tickgains.com/player/Sir%20Example')
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.\w+/)
  })
  it('puts the unsubscribe link in the footer when given one', () => {
    expect(claimExpiryEmail({ player: PLAYER, deadline: DEADLINE, unsubscribeUrl: 'https://tickgains.com/unsubscribe?t=abc' }).html).toContain('unsubscribe?t=abc')
  })
  it('escapes a hostile name', () => {
    expect(claimExpiryEmail({ player: { username: 'x', displayName: '<img src=x>' }, deadline: DEADLINE }).html).not.toContain('<img src=x>')
  })
  it('copes with a missing deadline', () => {
    expect(deadlineLabel('nope')).toBe('')
    expect(claimExpiryEmail({ player: PLAYER, deadline: null }).text).not.toContain('Claim closes')
  })
})
