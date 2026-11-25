import { describe, expect, it } from 'vitest'
import { buildAudience } from '../../server/src/utils/announcementAudience.js'
import { graveyardEmail, ANNOUNCEMENTS, GRAVEYARD_KEY } from '../../server/src/utils/announcementEmail.js'
import { runAnnouncement } from '../../server/src/services/announcements.service.js'

describe('buildAudience', () => {
  it('has one entry per address, an account winning over a subscriber, ignoring case and spaces', () => {
    const out = buildAudience({
      users: [{ id: 1, email: 'Ann@Example.com' }, { id: 2, email: 'bob@example.com' }],
      subscribers: [{ email: ' ann@example.com ', unsub_token: 'x' }, { email: 'cy@example.com', unsub_token: 'y' }],
    })
    expect(out.map((r) => [r.email, r.kind])).toEqual([['Ann@Example.com', 'user'], ['bob@example.com', 'user'], ['cy@example.com', 'subscriber']])
    expect(out[0].userId).toBe(1)
    expect(out[2].token).toBe('y')
  })
  it('leaves out addresses already sent to, and anything that is not an address', () => {
    const out = buildAudience({
      users: [{ id: 1, email: 'ann@example.com' }, { id: 2, email: '' }, { id: 3, email: 'not-an-email' }],
      subscribers: [{ email: 'cy@example.com', unsub_token: 'y' }],
      alreadySent: ['ANN@example.com'],
    })
    expect(out.map((r) => r.email)).toEqual(['cy@example.com'])
  })
  it('is empty with nothing to send to', () => {
    expect(buildAudience()).toEqual([])
  })
})

describe('the Graveyard email', () => {
  it('says what the quest and course are, links the planner and the unsubscribe page, and has no personal details', () => {
    const e = graveyardEmail({ unsubscribeUrl: 'https://tickgains.com/unsubscribe?t=abc' })
    expect(e.subject).toContain('Graveyard')
    expect(e.text).toContain('Master')
    expect(e.text).toContain('Sailing 65')
    expect(e.text).toContain('2,960 XP a lap')
    expect(e.text).toContain('https://tickgains.com/planner')
    expect(e.text).toContain('Unsubscribe from news emails: https://tickgains.com/unsubscribe?t=abc')
    expect(e.html).toContain('Unsubscribe from news emails')
    expect(ANNOUNCEMENTS[GRAVEYARD_KEY].subject).toBe(e.subject)
  })
})

describe('runAnnouncement', () => {
  const people = ['a', 'b', 'c', 'd'].map((n) => ({ email: `${n}@example.com` }))
  const noWait = async () => {}

  it('sends to each person once, records each success, and counts them', async () => {
    const sent = []
    const recorded = []
    const state = await runAnnouncement({ recipients: people, send: async (r) => (sent.push(r.email), true), record: async (r) => recorded.push(r.email), wait: noWait })
    expect(sent).toEqual(recorded)
    expect(sent).toHaveLength(4)
    expect(state).toMatchObject({ running: false, total: 4, sent: 4, failed: 0, stoppedReason: '' })
  })
  it('does not record a failure, so the person is tried again next time, and carries on past a single failure', async () => {
    const recorded = []
    const state = await runAnnouncement({ recipients: people, send: async (r) => r.email !== 'b@example.com', record: async (r) => recorded.push(r.email), wait: noWait })
    expect(recorded).toEqual(['a@example.com', 'c@example.com', 'd@example.com'])
    expect(state).toMatchObject({ sent: 3, failed: 1, stoppedReason: '' })
  })
  it('treats a send that throws as a failure', async () => {
    const state = await runAnnouncement({ recipients: people.slice(0, 2), send: async () => { throw new Error('boom') }, record: async () => {}, wait: noWait })
    expect(state).toMatchObject({ sent: 0, failed: 2 })
  })
  it('stops after several failures in a row instead of working through the whole list', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ email: `p${i}@example.com` }))
    let tries = 0
    const state = await runAnnouncement({ recipients: many, send: async () => (tries++, false), record: async () => {}, wait: noWait, stopAfter: 5 })
    expect(tries).toBe(5)
    expect(state.running).toBe(false)
    expect(state.stoppedReason).toContain('5 failures in a row')
  })
  it('pauses between messages, not before the first', async () => {
    const waits = []
    await runAnnouncement({ recipients: people, send: async () => true, record: async () => {}, wait: async (ms) => waits.push(ms), pause: 600 })
    expect(waits).toEqual([600, 600, 600])
  })
})
