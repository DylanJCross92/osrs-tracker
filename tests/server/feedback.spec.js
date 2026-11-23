import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanFeedback, cleanPage, cleanPlanContext, cleanViewport, MAX_CONTEXT_BYTES, MAX_MESSAGE } from '../../server/src/utils/feedback.js'
import { notifyFeedback, _resetNotifyCap } from '../../server/src/services/notify.service.js'

describe('cleanFeedback', () => {
  it('accepts a message with the defaults filled in', () => {
    const { value } = cleanFeedback({ message: '  The planner is great!  ' })
    expect(value).toEqual({ kind: 'other', message: 'The planner is great!', email: null, page: '', viewport: '' })
  })
  it('keeps a known kind, a valid email, the page path and screen size', () => {
    const { value } = cleanFeedback({ kind: 'bug', message: 'Button does nothing', email: ' Me@Example.com ', page: '/planner?plan=3#x', viewport: '390x844' })
    expect(value).toMatchObject({ kind: 'bug', email: 'me@example.com', page: '/planner', viewport: '390x844' })
  })
  it('turns an unknown kind into other', () => {
    expect(cleanFeedback({ kind: 'spam', message: 'hello there' }).value.kind).toBe('other')
  })
  it('asks for more when the message is empty or tiny', () => {
    for (const message of ['', '   ', 'hi', undefined, 42]) expect(cleanFeedback({ message }).error).toBeTruthy()
  })
  it('refuses a message that is too long', () => {
    expect(cleanFeedback({ message: 'x'.repeat(MAX_MESSAGE + 1) }).error).toMatch(/under/)
    expect(cleanFeedback({ message: 'x'.repeat(MAX_MESSAGE) }).value).toBeTruthy()
  })
  it('refuses an email that does not look right, but an empty one is fine', () => {
    expect(cleanFeedback({ message: 'hello there', email: 'not-an-email' }).error).toBeTruthy()
    expect(cleanFeedback({ message: 'hello there', email: '' }).value.email).toBeNull()
  })
})

describe('a Smart Planner plan report', () => {
  const context = {
    profile: { members: true, iron: false, goal: 'money', gp: 'low', experience: 'returning', hours: 2.5 },
    goals: [{ skill: 'Runecraft', from: 44, to: 54, hours: 7.2, rsn: 'SomeName' }],
    phases: [{ title: 'Make money while you train', rows: 3 }],
    notes: ['Fletching stops at level 40 to stay inside your 1M gp budget.'],
    skipped: [{ title: 'Monkey Madness I', reason: 'Its fights need about combat level 65; yours is 40.' }],
    assumed: { combat: 40, doneQuests: 2 },
    username: 'SomeName',
  }
  it('keeps the plan context only for a plan report, with only known fields', () => {
    const { value } = cleanFeedback({ kind: 'plan_report', message: 'This looks wrong to me', context })
    expect(value.kind).toBe('plan_report')
    expect(value.context.profile).toEqual({ members: true, iron: false, goal: 'money', gp: 'low', experience: 'returning', hours: 2.5 })
    expect(value.context.goals).toEqual([{ skill: 'Runecraft', from: 44, to: 54, hours: 7 }])
    expect(JSON.stringify(value.context)).not.toMatch(/SomeName/)
    expect(cleanFeedback({ kind: 'bug', message: 'This looks wrong to me', context }).value.context).toBeUndefined()
  })
  it('drops a context that is too big or not an object, and unknown answers', () => {
    const huge = { ...context, notes: Array.from({ length: 8 }, () => 'x'.repeat(200)), skipped: Array.from({ length: 6 }, () => ({ title: 'y'.repeat(60), reason: 'z'.repeat(160) })), goals: Array.from({ length: 30 }, () => ({ skill: 'Mining', from: 1, to: 99, hours: 5 })) }
    expect(JSON.stringify(cleanPlanContext(huge) || {}).length).toBeLessThanOrEqual(MAX_CONTEXT_BYTES)
    expect(cleanPlanContext('nope')).toBeNull()
    expect(cleanPlanContext({ profile: { goal: 'evil', gp: 'lots', experience: 'god', hours: 99 } }).profile).toMatchObject({ goal: null, gp: null, experience: null, hours: 12 })
  })
})

describe('cleanPage and cleanViewport', () => {
  it('keeps only a plain path', () => {
    expect(cleanPage('/player/khint?tab=records')).toBe('/player/khint')
    expect(cleanPage('https://evil.example/x')).toBe('')
    expect(cleanPage('/a<script>')).toBe('')
    expect(cleanPage(null)).toBe('')
  })
  it('keeps only a WIDTHxHEIGHT size', () => {
    expect(cleanViewport('1280x720')).toBe('1280x720')
    for (const bad of ['big', '12x', '1280 x 720', null]) expect(cleanViewport(bad)).toBe('')
  })
})

describe('notifyFeedback', () => {
  const ENV = { RESEND_API_KEY: 're_test', NOTIFY_EMAIL: 'owner@example.com' }
  const item = { id: 1, kind: 'bug', kindLabel: 'Bug', message: 'Line one\nLine two', email: 'fan@example.com', page: '/planner', viewport: '390x844', signedIn: true }
  beforeEach(() => {
    _resetNotifyCap()
    delete process.env.RESEND_API_KEY
    delete process.env.NOTIFY_EMAIL
  })
  afterEach(() => vi.unstubAllGlobals())

  it('does nothing without mail settings', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await notifyFeedback(item)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('emails the owner with the message, the details and a reply-to for the sender', async () => {
    Object.assign(process.env, ENV)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    expect(await notifyFeedback(item)).toBe(true)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.to).toEqual(['owner@example.com'])
    expect(body.reply_to).toEqual(['fan@example.com'])
    expect(body.subject).toContain('Bug')
    expect(body.text).toContain('Line one')
    expect(body.text).toContain('Line two')
    expect(body.text).toContain('/planner')
  })

  it('leaves out reply-to when the sender gave no address', async () => {
    Object.assign(process.env, ENV)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    await notifyFeedback({ ...item, email: null })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reply_to).toBeUndefined()
  })

  it('never throws when the mail service fails', async () => {
    Object.assign(process.env, ENV)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    expect(await notifyFeedback(item)).toBe(false)
  })
})
