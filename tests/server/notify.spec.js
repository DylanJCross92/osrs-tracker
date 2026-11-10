import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { notifyNewSubscriber, notifyConfigured, _resetNotifyCap } from '../../server/src/services/notify.service.js'

const ENV = { RESEND_API_KEY: 're_test', NOTIFY_EMAIL: 'owner@example.com' }

describe('notifyNewSubscriber', () => {
  beforeEach(() => {
    _resetNotifyCap()
    delete process.env.RESEND_API_KEY
    delete process.env.NOTIFY_EMAIL
    delete process.env.NOTIFY_FROM
  })
  afterEach(() => vi.unstubAllGlobals())

  it('does nothing when the mail settings are missing', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(notifyConfigured()).toBe(false)
    expect(await notifyNewSubscriber({ email: 'a@b.com' })).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends one plain-text email to the owner', async () => {
    Object.assign(process.env, ENV)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    expect(await notifyNewSubscriber({ email: 'fan@example.com', source: 'footer', total: 7 })).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer re_test')
    const body = JSON.parse(init.body)
    expect(body.to).toEqual(['owner@example.com'])
    expect(body.text).toContain('fan@example.com')
    expect(body.text).toContain('footer')
    expect(body.text).toContain('7')
  })

  it('never throws when the mail service fails', async () => {
    Object.assign(process.env, ENV)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    expect(await notifyNewSubscriber({ email: 'a@b.com' })).toBe(false)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    expect(await notifyNewSubscriber({ email: 'a@b.com' })).toBe(false)
    spy.mockRestore()
  })

  it('stops after 20 emails in an hour', async () => {
    Object.assign(process.env, ENV)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    for (let i = 0; i < 25; i++) await notifyNewSubscriber({ email: `n${i}@example.com` })
    expect(fetchMock).toHaveBeenCalledTimes(20)
  })
})
