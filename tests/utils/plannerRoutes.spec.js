import { describe, expect, it } from 'vitest'
import { createAppRouter } from '@/router'

// The planner's addresses: one page, told apart by the route.
describe('planner routes', () => {
  const router = createAppRouter()
  const resolve = (path) => router.resolve(path)

  it('gives the overview, the new-plan page and each saved plan their own address', () => {
    expect(resolve('/planner').name).toBe('planner')
    expect(resolve('/planner/new').name).toBe('plannerNew')
    expect(resolve('/planner/p_abc').name).toBe('plannerPlan')
    expect(resolve('/planner/p_abc').params.id).toBe('p_abc')
    // There is no whole-plan edit page: its old address goes to the plan.
    const old = resolve('/planner/p_abc/edit')
    const target = typeof old.matched[0].redirect === 'function' ? old.matched[0].redirect(old) : null
    expect(target).toMatchObject({ name: 'plannerPlan', params: { id: 'p_abc' } })
  })

  it('opens a skill in the plan, or its editor', () => {
    const view = resolve('/planner/p_abc/runecraft')
    expect(view.name).toBe('plannerSkill')
    expect(view.params).toMatchObject({ id: 'p_abc', skill: 'runecraft' })
    const edit = resolve('/planner/p_abc/edit/runecraft')
    expect(edit.name).toBe('plannerEditSkill')
    expect(edit.params).toMatchObject({ id: 'p_abc', skill: 'runecraft' })
  })

  it('does not mistake "new" or "edit" for a plan or a skill', () => {
    expect(resolve('/planner/new').params.id).toBeUndefined()
    expect(resolve('/planner/p_abc/edit').params.skill).toBeUndefined()
  })
})
