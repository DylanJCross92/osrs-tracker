import { describe, expect, it } from 'vitest'
import { skipsEmailConfirmation } from '../../server/src/utils/localSignup.js'

// Only a sign-up on a developer's own machine skips the confirmation email.
const req = (hostname, origin) => ({ hostname, headers: origin ? { origin } : {} })

describe('sign-up without email confirmation (localhost only)', () => {
  it('skips it for the local dev server', () => {
    expect(skipsEmailConfirmation(req('localhost', 'http://localhost:5173'), {})).toBe(true)
    expect(skipsEmailConfirmation(req('127.0.0.1'), {})).toBe(true)
    expect(skipsEmailConfirmation(req('localhost', 'http://127.0.0.1:5173'), { NODE_ENV: 'development' })).toBe(true)
  })

  it('never skips it in production, whatever the address', () => {
    expect(skipsEmailConfirmation(req('localhost', 'http://localhost:5173'), { NODE_ENV: 'production' })).toBe(false)
  })

  it('never skips it for any other address, or a page from another site', () => {
    expect(skipsEmailConfirmation(req('tickgains.com', 'https://tickgains.com'), {})).toBe(false)
    expect(skipsEmailConfirmation(req('localhost', 'https://evil.example'), {})).toBe(false)
    expect(skipsEmailConfirmation(req('localhost.evil.example'), {})).toBe(false)
    expect(skipsEmailConfirmation(req('192.168.1.20', 'http://192.168.1.20:5173'), {})).toBe(false)
  })

  it('can be turned off to try the real flow locally', () => {
    expect(skipsEmailConfirmation(req('localhost'), { REQUIRE_EMAIL_CONFIRMATION: '1' })).toBe(false)
  })
})
