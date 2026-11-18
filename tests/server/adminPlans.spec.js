import { describe, it, expect } from 'vitest'
import { groupPlansByPlayer, playerKey } from '../../server/src/utils/adminPlans.js'

const plan = (id, rsn, updatedAt, goals = [{ skill: 'Slayer', currentXp: 100, targetXp: 200, methodId: 'global' }]) => ({ id, name: `Plan ${id}`, player: { rsn }, updatedAt, hoursPerDay: 2, globalStrategy: 'auto-fast', goals })
const saved = (plans) => ({ plans: { value: plans, updatedAt: '2026-11-01T00:00:00.000Z' } })

describe('playerKey', () => {
  it('treats case, spaces, underscores and hyphens as the same name', () => {
    expect(playerKey('Iron Man')).toBe(playerKey('iron_man'))
    expect(playerKey(' Zezima ')).toBe('zezima')
    expect(playerKey(null)).toBe('')
  })
})

describe('groupPlansByPlayer', () => {
  it('groups plans by player name, A to Z, with accounts counted once', () => {
    const out = groupPlansByPlayer([saved([plan('a', 'Zezima', '2026-11-02'), plan('b', 'Alice', '2026-11-03')]), saved([plan('c', 'zezima', '2026-11-04')])])
    expect(out.players.map((p) => p.name)).toEqual(['Alice', 'Zezima'])
    const z = out.players[1]
    expect(z.accounts).toBe(2)
    expect(z.plans.map((p) => p.id)).toEqual(['c', 'a']) // newest first
    expect(out.totals).toEqual({ players: 2, plans: 3, accounts: 2, visitors: 0 })
  })

  it('puts plans with no player name last', () => {
    const out = groupPlansByPlayer([saved([plan('a', '', '2026-11-02'), plan('b', 'Bob', '2026-11-01')])])
    expect(out.players.map((p) => p.key)).toEqual(['bob', ''])
    expect(out.totals.players).toBe(1)
  })

  it('includes the working planner unless it is just an open copy of a saved plan', () => {
    const working = { value: { rsn: 'Bob', goals: [{ skill: 'Mining', currentXp: 0, targetXp: 10 }], planId: 'zzz', planName: '' }, updatedAt: '2026-11-05' }
    const a = groupPlansByPlayer([{ plans: { value: [] }, planner: working }])
    expect(a.players[0].plans[0]).toMatchObject({ source: 'working', name: 'Unsaved plan' })
    const b = groupPlansByPlayer([{ plans: { value: [plan('zzz', 'Bob', '2026-11-01')] }, planner: working }])
    expect(b.totals.plans).toBe(1)
  })

  it('ignores junk and never carries account details', () => {
    const out = groupPlansByPlayer([{ plans: { value: [null, 'x', { id: 'q', goals: 'no' }] }, planner: { value: { goals: [] } }, email: 'a@b.c' }, {}, null])
    expect(JSON.stringify(out)).not.toContain('a@b.c')
    expect(out.players[0].plans[0].goals).toEqual([])
  })
})

describe('plans from visitors who are not signed in', () => {
  const vid = 'ab'.repeat(16)
  const visitor = (id, plans, planner = null) => ({ id, plans, planner, updatedAt: '2026-11-06T00:00:00.000Z' })

  it('groups them with the same player and tags each plan with the visitor it belongs to', () => {
    const out = groupPlansByPlayer([saved([plan('a', 'Zezima', '2026-11-02')])], [visitor(vid, [plan('v1', 'zezima', '2026-11-05')])])
    expect(out.players).toHaveLength(1)
    const z = out.players[0]
    expect(z.accounts).toBe(1)
    expect(z.visitors).toBe(1)
    expect(z.plans.map((p) => p.id)).toEqual(['v1', 'a'])
    expect(z.plans[0].owner).toEqual({ key: `v:${vid}`, label: 'Visitor ababab' })
    expect(z.plans[1].owner).toBeUndefined()
    expect(out.totals).toMatchObject({ plans: 2, accounts: 1, visitors: 1 })
  })

  it('counts a visitor once however many plans they have, and includes their unsaved planner', () => {
    const draft = { rsn: 'Bob', goals: [{ skill: 'Mining', currentXp: 0, targetXp: 10 }], planId: 'x', planName: '' }
    const out = groupPlansByPlayer([], [visitor(vid, [plan('v1', 'Bob', '2026-11-05'), plan('v2', 'Bob', '2026-11-04')], draft)])
    expect(out.totals).toMatchObject({ plans: 3, accounts: 0, visitors: 1 })
    expect(out.players[0].plans.some((p) => p.source === 'working')).toBe(true)
  })

  it('ignores a visitor with a malformed id, and never lets them be mistaken for an account', () => {
    const out = groupPlansByPlayer([], [visitor('not-an-id', [plan('v1', 'Bob', '2026-11-05')])])
    expect(out.totals).toMatchObject({ plans: 0, visitors: 0 })
  })
})
