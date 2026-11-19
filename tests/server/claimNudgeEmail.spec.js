import { describe, expect, it } from 'vitest'
import { claimFeatures, claimNudgeEmail } from '../../server/src/utils/claimNudgeEmail.js'
import { renderEmail } from '../../server/src/utils/emailTemplate.js'

describe('claimNudgeEmail', () => {
  it('lists every feature in the HTML and the plain-text twin and links to the site', () => {
    const { subject, html, text } = claimNudgeEmail()
    expect(subject).toMatch(/TickGains/)
    for (const f of claimFeatures()) {
      expect(html).toContain(f.title.replace(/&/g, '&amp;'))
      expect(text).toContain(f.title)
    }
    expect(html).toContain('Claim my profile')
    expect(text).toContain('https://tickgains.com/')
    expect(text).not.toContain('<')
  })
  it('shows pictures from the site and never from anywhere else', () => {
    const { html } = claimNudgeEmail()
    expect(html).toContain('src="https://tickgains.com/email/dashboard.png"')
    expect(html).toContain('/email/profile.png')
    expect(html).toContain('/email/notifications.png')
  })
  it('greets by name when it has one, and escapes it', () => {
    expect(claimNudgeEmail({ name: 'Zezima' }).html).toContain('Zezima, claim your player')
    expect(claimNudgeEmail({ name: '<img src=x>' }).html).not.toContain('<img src=x>')
  })
  it('never contains an email address', () => {
    expect(claimNudgeEmail({ name: 'Bob' }).html).not.toMatch(/[\w.+-]+@[\w-]+\.\w+/)
  })
})

describe('renderEmail features', () => {
  it('renders ticks and bullets, and escapes markup', () => {
    const { html, text } = renderEmail({ title: 'T', features: [{ title: 'A <b>', text: 'x & y' }] })
    expect(html).toContain('A &lt;b&gt;')
    expect(html).toContain('x &amp; y')
    expect(text).toContain('- A <b>: x & y')
  })
})

describe('renderEmail feature pictures', () => {
  it('only uses web links for pictures', () => {
    const { html } = renderEmail({ title: 'T', features: [{ title: 'A', text: 'b', image: { src: 'javascript:alert(1)', alt: 'x' } }, { title: 'C', text: 'd', image: { src: 'https://tickgains.com/email/a.png', alt: 'ok' } }] })
    expect(html).not.toContain('javascript:')
    expect(html).toContain('src="https://tickgains.com/email/a.png"')
  })
})

describe('unsubscribe link', () => {
  it('is in the footer, in the text twin, and only when given', () => {
    const url = 'https://tickgains.com/unsubscribe?t=' + 'a'.repeat(48)
    const withLink = claimNudgeEmail({ unsubscribeUrl: url })
    expect(withLink.html).toContain(`href="${url}"`)
    expect(withLink.html).toContain('Unsubscribe from reminder emails')
    expect(withLink.text).toContain(url)
    expect(claimNudgeEmail().html).not.toContain('Unsubscribe')
    expect(renderEmail({ title: 'T', unsubscribeUrl: 'javascript:alert(1)' }).html).not.toContain('javascript:')
  })
})
