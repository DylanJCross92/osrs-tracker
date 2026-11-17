// Rules for the feedback form. Pure (no database), so what is accepted is easy to test. Everything is untrusted input.
import { normalizeEmail } from './email.js'

export const KINDS = { bug: 'Bug', idea: 'Idea', other: 'Other' }
export const MIN_MESSAGE = 5
export const MAX_MESSAGE = 2000

/** The path of the page the person was on (no query or hash, so nothing typed in a link comes along), or ''. */
export function cleanPage(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return ''
  const path = value.split(/[?#]/)[0].slice(0, 200)
  return /^[\w\-./%~@:+ ]*$/.test(path) ? path : ''
}

/** "390x844" or ''. */
export const cleanViewport = (value) => (typeof value === 'string' && /^\d{2,5}x\d{2,5}$/.test(value) ? value : '')

/**
 * { error } when the form cannot be accepted, otherwise { value: { kind, message, email, page, viewport } }.
 * The reply email is optional; when given it has to look like an address.
 */
export function cleanFeedback(body) {
  const message = typeof body?.message === 'string' ? body.message.replace(/\r\n/g, '\n').trim() : ''
  if (message.length < MIN_MESSAGE) return { error: 'Please write a little more so we can understand.' }
  if (message.length > MAX_MESSAGE) return { error: `Please keep it under ${MAX_MESSAGE.toLocaleString('en-US')} characters.` }

  const rawEmail = typeof body?.email === 'string' ? body.email.trim() : ''
  const email = rawEmail ? normalizeEmail(rawEmail) : null
  if (rawEmail && !email) return { error: 'That email address does not look right. Leave it empty if you would rather not be contacted.' }

  const kind = Object.keys(KINDS).includes(body?.kind) ? body.kind : 'other'
  return { value: { kind, message, email, page: cleanPage(body?.page), viewport: cleanViewport(body?.viewport) } }
}
