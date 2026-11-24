import { beforeEach, describe, expect, it } from 'vitest'
import { applyBackup, collectBackup, decodeBackup, describeBackup, encodeBackup } from '@/utils/guestBackup'

// A save code carries what a visitor keeps in the browser to another device, and adds it without taking anything away.
const mem = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }
}
const put = (s, key, value) => s.setItem(key, JSON.stringify(value))
const get = (s, key) => JSON.parse(s.getItem(key))

describe('save code', () => {
  let a
  beforeEach(() => {
    a = mem()
    put(a, 'tickgains-saved-plans-v1', [{ id: 'p_1', name: 'Max', updatedAt: '2026-01-02T00:00:00Z', goals: [] }])
    put(a, 'tickgains-planner-requirements-v1', { 'quest:family-crest': 'have', 'diary:easy-karamja-diary': 'have', 'quest:x:partial': 'have' })
    put(a, 'tickgains:rivals', ['Zezima'])
    put(a, 'tickgains:me', 'oo Jake')
    put(a, 'tickgains-planner-prefs-v1', { hours: 4 })
  })

  it('collects only what holds something, and describes it', () => {
    const b = collectBackup(a)
    expect(Object.keys(b.data).sort()).toEqual(['me', 'plannerPrefs', 'plans', 'requirements', 'rivals'])
    const rows = describeBackup(b)
    expect(rows.find((r) => r.name === 'quests').count).toBe(1)
    expect(rows.find((r) => r.name === 'diaries').count).toBe(1)
    expect(rows.find((r) => r.name === 'plans').count).toBe(1)
  })

  it('goes to text and back, whether or not the browser can compress', async () => {
    const b = collectBackup(a)
    const text = await encodeBackup(b)
    expect(text).toMatch(/^TG[01]\.[A-Za-z0-9_-]+$/)
    expect((await decodeBackup(`  ${text.slice(0, 20)}\n${text.slice(20)} `)).data).toEqual(b.data)
    // Found inside a link or a message too.
    expect((await decodeBackup(`https://tickgains.com/restore#${text}`)).data.me).toBe('oo Jake')
  })

  it('refuses text that is not a TickGains save code', async () => {
    expect(await decodeBackup('')).toBeNull()
    expect(await decodeBackup('hello world')).toBeNull()
    expect(await decodeBackup('TG1.notvalid!!')).toBeNull()
    expect(await decodeBackup(`TG0.${btoa('{"app":"other","data":{}}')}`)).toBeNull()
  })

  it('adds to another browser without taking anything away', async () => {
    const b = await decodeBackup(await encodeBackup(collectBackup(a)))
    const c = mem()
    put(c, 'tickgains-saved-plans-v1', [{ id: 'p_2', name: 'Other', updatedAt: '2026-01-01T00:00:00Z', goals: [] }, { id: 'p_1', name: 'Old Max', updatedAt: '2025-12-01T00:00:00Z', goals: [] }])
    put(c, 'tickgains-planner-requirements-v1', { 'quest:rune-mysteries': 'have' })
    put(c, 'tickgains:rivals', ['Lynx Titan'])
    put(c, 'tickgains:me', 'Someone')
    applyBackup(b, c)
    const plans = get(c, 'tickgains-saved-plans-v1')
    expect(plans.map((p) => p.id).sort()).toEqual(['p_1', 'p_2'])
    expect(plans.find((p) => p.id === 'p_1').name).toBe('Max')
    expect(get(c, 'tickgains-planner-requirements-v1')).toMatchObject({ 'quest:rune-mysteries': 'have', 'quest:family-crest': 'have' })
    expect(get(c, 'tickgains:rivals').sort()).toEqual(['Lynx Titan', 'Zezima'])
    // A single value already set here is kept; one that was not set is taken.
    expect(get(c, 'tickgains:me')).toBe('Someone')
    expect(get(c, 'tickgains-planner-prefs-v1')).toEqual({ hours: 4 })
  })
})
