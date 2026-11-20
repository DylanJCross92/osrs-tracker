import { describe, it, expect } from 'vitest'
import { describeOwners, findPlanOwners, goalsCode } from '../../server/src/utils/planMatch.js'
import { goalsCode as appCode } from '@/utils/goalsCode'

const goals = [
  { skill: 'Farming', currentXp: 10, targetXp: 5346332, methodId: 'x' },
  { skill: 'Prayer', currentXp: 99, targetXp: 5346332, methodId: 'y' },
]
const VID = 'a'.repeat(32)
const VID2 = 'b'.repeat(32)

describe('goalsCode', () => {
  it('is the same in the app and on the server', () => {
    expect(appCode(goals)).toBe(goalsCode(goals))
    expect(goalsCode(goals)).toMatch(/^[0-9a-f]{8}$/)
  })
  it('ignores order, the starting XP and the method', () => {
    const other = [{ skill: 'Prayer', currentXp: 1, targetXp: 5346332, methodId: 'z' }, { skill: 'Farming', currentXp: 2, targetXp: 5346332 }]
    expect(goalsCode(other)).toBe(goalsCode(goals))
  })
  it('changes with the skills or the targets, and is empty without goals', () => {
    expect(goalsCode([{ skill: 'Farming', targetXp: 5346332 }])).not.toBe(goalsCode(goals))
    expect(goalsCode([{ skill: 'Farming', targetXp: 5346333 }, goals[1]])).not.toBe(goalsCode(goals))
    expect(goalsCode([])).toBe('')
    expect(goalsCode(null)).toBe('')
  })
})

describe('findPlanOwners', () => {
  const code = goalsCode(goals)
  const accounts = [
    { id: 7, email: 'sharer@example.com', plans: { value: [{ id: 'p1', goals }] }, planner: null },
    { id: 8, email: 'other@example.com', plans: [{ id: 'p2', goals: [{ skill: 'Mining', targetXp: 13034431 }] }], planner: null },
    { id: 9, email: 'draft@example.com', plans: null, planner: { value: { goals } } },
  ]
  const visitors = [
    { id: VID, plans: [{ id: 'p3', goals }], planner: null },
    { id: VID2, plans: [], planner: { goals: [{ skill: 'Mining', targetXp: 1 }] } },
  ]
  it('finds accounts and browsers with a saved or in-progress plan of the same code', () => {
    expect(findPlanOwners(code, accounts, visitors).map((o) => o.key)).toEqual(['a:7', 'a:9', `v:${VID}`])
    expect(findPlanOwners(code, accounts, visitors)[2].label).toBe('Visitor aaaaaa')
  })
  it('leaves out the person being looked at', () => {
    expect(findPlanOwners(code, accounts, visitors, 'a:7').map((o) => o.key)).toEqual(['a:9', `v:${VID}`])
  })
  it('finds nobody for an empty or unknown code', () => {
    expect(findPlanOwners('', accounts, visitors)).toEqual([])
    expect(findPlanOwners('00000000', accounts, visitors)).toEqual([])
  })
})

describe('describeOwners', () => {
  it('lists a few and counts the rest', () => {
    const o = ['A', 'B', 'C', 'D', 'E'].map((label) => ({ label }))
    expect(describeOwners(o.slice(0, 2))).toBe('A, B')
    expect(describeOwners(o)).toBe('A, B, C and 2 more')
  })
})
