import { describe, expect, it } from 'vitest'
import { fingerprint, planPayload } from '@/utils/visitorPlans'

const store = (data) => (key) => data[key] || ''
const plans = JSON.stringify([{ id: 'p1', name: 'Plan', goals: [] }])
const planner = JSON.stringify({ goals: [{ skill: 'Mining' }], rsn: 'Bob' })

describe('planPayload', () => {
  it('sends the saved plans and the working planner when they are new', () => {
    const out = planPayload({ read: store({ 'tickgains-saved-plans-v1': plans, 'tickgains-planner-v1': planner }), sent: '' })
    expect(out.plans).toHaveLength(1)
    expect(out.planner.rsn).toBe('Bob')
    expect(out.print).toBe(fingerprint(`${plans}|${planner}`))
  })
  it('sends nothing when nothing changed since the last send', () => {
    const print = fingerprint(`${plans}|${planner}`)
    expect(planPayload({ read: store({ 'tickgains-saved-plans-v1': plans, 'tickgains-planner-v1': planner }), sent: print })).toBeNull()
  })
  it('sends nothing for a visitor who never had plans, but sends the emptying of plans that were sent before', () => {
    expect(planPayload({ read: store({}), sent: '' })).toBeNull()
    const out = planPayload({ read: store({}), sent: fingerprint(`${plans}|${planner}`) })
    expect(out).toMatchObject({ plans: [], planner: null })
  })
  it('copes with damaged storage and keeps at most 30 plans', () => {
    expect(planPayload({ read: store({ 'tickgains-saved-plans-v1': '{oops' }), sent: '' })).toBeNull()
    const many = JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ id: `p${i}` })))
    expect(planPayload({ read: store({ 'tickgains-saved-plans-v1': many }), sent: '' }).plans).toHaveLength(30)
  })
})
