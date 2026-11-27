import { describe, it, expect } from 'vitest'
import { renderEmail } from '../../server/src/utils/emailTemplate.js'

describe('renderEmail replyable', () => {
  it('declares a dark colour scheme by default, but not for an email the reader will answer (so a reply is not typed in white)', () => {
    const plain = renderEmail({ title: 'T', paragraphs: ['x'] }).html
    const replyable = renderEmail({ title: 'T', paragraphs: ['x'], replyable: true }).html
    expect(plain).toContain('name="color-scheme"')
    expect(replyable).not.toContain('color-scheme')
    expect(replyable).not.toContain('supported-color-schemes')
    // it still looks the same: the panel and text keep their own colours
    expect(replyable).toContain('background:#211c14')
  })
})

describe('renderEmail', () => {
  const base = { title: 'Welcome', paragraphs: ['Hello there'], button: { label: 'Confirm', url: 'https://tickgains.com/verify-email?t=abc' }, note: 'Ignore if not you' }

  it('makes HTML and a plain-text twin with the button link in both', () => {
    const { html, text } = renderEmail(base)
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('href="https://tickgains.com/verify-email?t=abc"')
    expect(html).toContain('Welcome')
    expect(text).toContain('https://tickgains.com/verify-email?t=abc')
    expect(text).toContain('Hello there')
    expect(text).not.toContain('<')
  })

  it('escapes anything that could be markup', () => {
    const { html } = renderEmail({ title: '<b>x</b>', paragraphs: [{ text: 'a <script>alert(1)</script> b', strong: '<script>alert(1)</script>' }], rows: [{ label: 'L', value: '"><img src=x>' }] })
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('never turns a non-web link into a button', () => {
    const { html } = renderEmail({ title: 'T', button: { label: 'Go', url: 'javascript:alert(1)' } })
    expect(html).not.toContain('javascript:')
  })

  it('shows rows as label and value', () => {
    const { html, text } = renderEmail({ title: 'T', rows: [{ label: 'Accounts now', value: 3 }] })
    expect(html).toContain('Accounts now')
    expect(text).toContain('Accounts now: 3')
  })
})
