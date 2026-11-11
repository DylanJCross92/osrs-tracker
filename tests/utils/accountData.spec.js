// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

const api = { getData: vi.fn(), saveData: vi.fn() }
vi.mock('@/api/auth', () => ({ authApi: api }))

const { linkAccountData, unlinkAccountData, KEYS } = await import('@/utils/accountData')

const put = (name, value) => localStorage.setItem(KEYS[name], JSON.stringify(value))
const get = (name) => JSON.parse(localStorage.getItem(KEYS[name]) || 'null')
const OLD = '2026-01-01T00:00:00.000Z'
const NEW = '2026-11-01T00:00:00.000Z'
const planner = (rsn) => ({ goals: [{ skill: 'Mining', targetXp: 100 }], username: rsn })

beforeEach(() => {
  localStorage.clear()
  api.getData.mockReset()
  api.saveData.mockReset().mockResolvedValue({ data: {} })
  unlinkAccountData()
  api.saveData.mockClear()
})

describe('linkAccountData', () => {
  it('sends this browser\'s planner up when the account has none', async () => {
    put('planner', planner('a'))
    api.getData.mockResolvedValue({ data: {} })
    await linkAccountData()
    const sent = api.saveData.mock.calls[0][0]
    expect(sent.planner.value.username).toBe('a')
  })

  it('brings the account\'s planner down to a fresh browser', async () => {
    api.getData.mockResolvedValue({ data: { planner: { value: planner('cloud'), updatedAt: NEW } } })
    const changed = await linkAccountData()
    expect(changed).toBe(true)
    expect(get('planner').username).toBe('cloud')
  })

  it('lets the account win when this browser never recorded a change time', async () => {
    put('planner', planner('local'))
    localStorage.removeItem('tickgains:sync-meta')
    api.getData.mockResolvedValue({ data: { planner: { value: planner('cloud'), updatedAt: OLD } } })
    await linkAccountData()
    expect(get('planner').username).toBe('cloud')
  })

  it('joins saved plans from both sides the first time, newest copy of each id', async () => {
    put('plans', [{ id: 'p_a', name: 'local only', updatedAt: NEW }, { id: 'p_c', name: 'local newer', updatedAt: NEW }])
    api.getData.mockResolvedValue({ data: { plans: { value: [{ id: 'p_b', name: 'cloud only', updatedAt: OLD }, { id: 'p_c', name: 'cloud older', updatedAt: OLD }], updatedAt: OLD } } })
    await linkAccountData()
    const ids = get('plans').map((p) => p.id).sort()
    expect(ids).toEqual(['p_a', 'p_b', 'p_c'])
    expect(get('plans').find((p) => p.id === 'p_c').name).toBe('local newer')
    expect(api.saveData).toHaveBeenCalled()
  })

  it('joins congratulation sets', async () => {
    put('cheered', ['a:1'])
    api.getData.mockResolvedValue({ data: { cheered: { value: ['b:2'], updatedAt: OLD } } })
    await linkAccountData()
    expect(get('cheered').sort()).toEqual(['a:1', 'b:2'])
  })

  it('leaves the browser alone when the account cannot be reached', async () => {
    put('planner', planner('keep'))
    api.getData.mockRejectedValue(new Error('offline'))
    const changed = await linkAccountData()
    expect(changed).toBe(false)
    expect(get('planner').username).toBe('keep')
  })

  it('clears the synced data on sign-out', async () => {
    put('planner', planner('x'))
    put('recents', [{ username: 'sedz', displayName: 'sedz' }])
    unlinkAccountData()
    expect(get('planner')).toBeNull()
    expect(get('recents')).toBeNull()
  })
})
