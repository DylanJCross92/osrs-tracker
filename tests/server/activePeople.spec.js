import { describe, expect, it } from 'vitest'
import { WINDOWS, fillHourly, shapeAreas, shapeWindows } from '../../server/src/utils/activePeople.js'

describe('shapeWindows', () => {
  it('gives the three windows in order, with signed in plus visitors adding up to the people', () => {
    const r = shapeWindows({
      online: '2',
      hour_people: '5', hour_signed: '2', hour_events: '40', hour_untracked: '1', hour_logins: '1', hour_new_accounts: '0',
      day_people: '30', day_signed: '12', day_events: '300', day_untracked: '4', day_logins: '9', day_new_accounts: '3',
      week_people: '120', week_signed: '45', week_events: '2000', week_untracked: '20', week_logins: '60', week_new_accounts: '11',
    })
    expect(r.online).toBe(2)
    expect(r.windows.map((w) => w.key)).toEqual(WINDOWS.map((w) => w.key))
    expect(r.windows[0]).toMatchObject({ people: 5, signedIn: 2, visitors: 3, newAccounts: 0, logins: 1, events: 40, untracked: 1 })
    expect(r.windows[2]).toMatchObject({ people: 120, signedIn: 45, visitors: 75, newAccounts: 11 })
    for (const w of r.windows) expect(w.signedIn + w.visitors).toBe(w.people)
  })
  it('turns missing numbers into zeros and never lets signed in pass the total', () => {
    const r = shapeWindows({ hour_people: 1, hour_signed: 3 })
    expect(r.windows[0]).toMatchObject({ people: 1, signedIn: 1, visitors: 0 })
    expect(shapeWindows().windows.every((w) => w.people === 0 && w.events === 0)).toBe(true)
    expect(shapeWindows().online).toBe(0)
  })
})

describe('fillHourly', () => {
  const now = new Date('2026-11-25T15:40:00Z')
  it('returns 24 hours, oldest first, ending with the hour now is in, quiet hours as zero', () => {
    const out = fillHourly([{ hour: '2026-11-25T15:00:00Z', people: 4 }, { hour: new Date('2026-11-24T20:00:00Z'), people: '7' }], now)
    expect(out).toHaveLength(24)
    expect(out[0].at).toBe('2026-11-24T16:00:00.000Z')
    expect(out[23]).toEqual({ at: '2026-11-25T15:00:00.000Z', people: 4, signedIn: 0, actions: 0 })
    expect(out.find((h) => h.at === '2026-11-24T20:00:00.000Z').people).toBe(7)
    expect(out.filter((h) => h.people === 0)).toHaveLength(22)
  })
  it('carries signed-in people and actions for each hour, never more signed in than people', () => {
    const out = fillHourly([{ hour: '2026-11-25T15:00:00Z', people: 4, signed_in: 9, actions: '30' }, { hour: '2026-11-25T14:00:00Z', people: 3, signed_in: 1, actions: 5 }], now)
    expect(out[23]).toMatchObject({ people: 4, signedIn: 4, actions: 30 })
    expect(out[22]).toMatchObject({ people: 3, signedIn: 1, actions: 5 })
  })
  it('ignores hours outside the window', () => {
    const out = fillHourly([{ hour: '2026-11-20T10:00:00Z', people: 9 }], now)
    expect(out.every((h) => h.people === 0)).toBe(true)
  })
})

describe('shapeAreas', () => {
  it('ranks by people then views, drops blank names and cuts to the limit', () => {
    const rows = [
      { area: 'players', people: 5, views: 9 },
      { area: '', people: 99, views: 99 },
      { area: 'planner', people: 5, views: 12 },
      { area: 'items', people: 2, views: 2 },
      { area: null, people: 3, views: 3 },
    ]
    expect(shapeAreas(rows).map((a) => a.area)).toEqual(['planner', 'players', 'items'])
    expect(shapeAreas(rows, 2)).toHaveLength(2)
  })
})
