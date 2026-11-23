import { describe, it, expect } from 'vitest'
import { FUNNELS, SEGMENTS, areaOf, buildAnalysis, buildFlow, buildFunnel, buildInsights, median, pathOf, reachOf, spanLabel, withFirst } from '../../server/src/utils/funnels.js'

const T0 = Date.UTC(2026, 10, 1)
const min = (n) => T0 + n * 60_000
const ev = (name, at, path) => ({ name, at: min(at), ...(path ? { path } : {}) })
let n = 0
const person = (events = [], extra = {}) => ({ key: `v:${(++n).toString(16).padStart(32, '0')}`, kind: 'visitor', label: `Visitor ${n}`, events, signedUpAt: null, confirmedAt: null, claimedAt: null, lastSeenAt: null, ...extra })
const prep = (list) => withFirst(list)
const def = (key) => FUNNELS.find((f) => f.key === key)

describe('helpers', () => {
  it('median and spanLabel', () => {
    expect(median([5, 1, 3])).toBe(3)
    expect(median([1, 2, 3, 4])).toBe(3)
    expect(median([])).toBeNull()
    expect(spanLabel(10_000)).toBe('under a minute')
    expect(spanLabel(3 * 60_000)).toBe('3 min')
    expect(spanLabel(5 * 86_400_000)).toBe('5 days')
    expect(spanLabel(null)).toBe('')
  })
  it('sorts pages into areas', () => {
    expect(areaOf('/')).toBe('Home')
    expect(areaOf('/player/zezima?x=1')).toBe('Player profile')
    expect(areaOf('/planner/new?g=1')).toBe('Planner')
    expect(areaOf('/plan/abc')).toBe('Planner')
    expect(areaOf('/clans/mine')).toBe('Clans')
    expect(areaOf('/leaderboard')).toBe('Discover')
    expect(areaOf('/signup')).toBe('Account')
    expect(areaOf('/items/dragon-bones')).toBe('Items')
    expect(areaOf('/nope')).toBe('Other')
  })
})

describe('sequential counting', () => {
  const planner = def('planner')
  it('counts a person at a step only after the step before it', () => {
    const inOrder = person([ev('spa_page_view', 0, '/planner'), ev('planner_goal_added', 1), ev('planner_plan_saved', 2)])
    // Saved a plan without adding a goal first: not counted past "opened".
    const skipped = person([ev('spa_page_view', 0, '/planner'), ev('planner_plan_saved', 2)])
    const people = prep([inOrder, skipped])
    expect(reachOf(people[0], planner.steps)).toHaveLength(4)
    const f = buildFunnel(planner, people)
    expect(f.steps.map((s) => s.value)).toEqual([2, 2, 1, 1, 0])
  })
  it('never lets a later step exceed the one before it', () => {
    const people = prep(Array.from({ length: 20 }, (_, i) => person(i % 2 ? [ev('planner_goal_added', 1), ev('plan_share', 3)] : [ev('plan_share', 3)])))
    const f = buildFunnel(planner, people)
    for (let i = 1; i < f.steps.length; i++) expect(f.steps[i].value).toBeLessThanOrEqual(f.steps[i - 1].value)
  })
  it('reports the independent count and the people who skipped ahead', () => {
    const people = prep([person([ev('planner_plan_saved', 2)]), person([ev('planner_plan_saved', 2)]), person([ev('spa_page_view', 0, '/planner'), ev('planner_goal_added', 1), ev('planner_plan_saved', 2)])])
    const saved = buildFunnel(planner, people).steps.find((s) => s.key === 'saved')
    expect(saved.value).toBe(1)
    expect(saved.independent).toBe(3)
    expect(saved.bypassed).toBe(2)
  })
  it('gives the middle time between steps and rates against the step before', () => {
    const people = prep([person([ev('profile_view', 1), ev('profile_tab', 4)]), person([ev('profile_view', 1), ev('profile_tab', 6)]), person([ev('profile_view', 1), ev('profile_tab', 10)])])
    const f = buildFunnel(def('tracking'), people)
    const explored = f.steps.find((s) => s.key === 'explored')
    expect(explored.value).toBe(3)
    expect(explored.ofPrevious).toBe(100)
    expect(explored.medianMs).toBe(5 * 60_000)
    expect(explored.medianLabel).toBe('5 min')
  })
  it('finds the biggest drop by people lost and marks small samples', () => {
    const many = Array.from({ length: 40 }, () => person([ev('spa_page_view', 0, '/clans')]))
    const some = Array.from({ length: 4 }, () => person([ev('spa_page_view', 0, '/clans/x'), ev('clan_join_request', 2)]))
    const f = buildFunnel(def('clans'), prep([...many, ...some]))
    expect(f.steps.map((s) => s.value)).toEqual([44, 44, 4, 4])
    expect(f.biggestDrop).toBe(2)
    expect(f.steps[2].lost).toBe(40)
    expect(f.steps[2].lowSample).toBe(false)
    expect(f.steps[3].lowSample).toBe(true)
  })
  it('registration uses the account facts', () => {
    const joined = person([ev('spa_page_view', 0, '/')], { kind: 'account', signedUpAt: min(2), confirmedAt: min(3), claimedAt: min(5), lastSeenAt: min(60 * 24 * 2) })
    const lurker = person([ev('spa_page_view', 0, '/')])
    const f = buildFunnel(def('registration'), prep([joined, lurker]))
    expect(f.steps.map((s) => s.value)).toEqual([2, 1, 1, 1])
  })
})

describe('the Smart Planner funnel', () => {
  const smart = def('smartPlanner')
  it('counts a person from opening it to starting the plan, in order', () => {
    const full = person([ev('smart_planner_open', 0), ev('smart_planner_answer', 1), ev('smart_planner_plan_viewed', 2), ev('smart_planner_start', 3)])
    const looked = person([ev('smart_planner_open', 0), ev('smart_planner_answer', 1), ev('smart_planner_plan_viewed', 2)])
    const bounced = person([ev('smart_planner_open', 0)])
    const f = buildFunnel(smart, prep([full, looked, bounced]))
    expect(f.steps.map((x) => x.value)).toEqual([3, 3, 2, 2, 1])
  })
  it('also counts a plan that was started from the planner side', () => {
    const f = buildFunnel(smart, prep([person([ev('smart_planner_open', 0), ev('smart_planner_answer', 1), ev('smart_planner_plan_viewed', 2), ev('planner_smart_used', 3)])]))
    expect(f.steps[f.steps.length - 1].value).toBe(1)
  })
})

describe('segments', () => {
  const account = person([ev('spa_page_view', 0, '/')], { kind: 'account', signedUpAt: min(1) })
  const guest = person([ev('spa_page_view', 0, '/'), ev('spa_page_view', 60 * 30, '/planner')])
  const shared = person([ev('planner_share_link_opened', 0)])
  const all = prep([account, guest, shared])
  it('counts the people in each group', () => {
    const a = buildAnalysis(all, 'all')
    expect(a.segments.find((s) => s.key === 'signedup').people).toBe(1)
    expect(a.segments.find((s) => s.key === 'visitor').people).toBe(2)
    expect(a.segments.find((s) => s.key === 'shared').people).toBe(1)
    expect(a.segments.find((s) => s.key === 'returning').people).toBe(1)
  })
  it('limits everything to the chosen group and falls back to everyone', () => {
    expect(buildAnalysis(all, 'signedup').cohort).toBe(1)
    expect(buildAnalysis(all, 'nonsense').segment).toBe('all')
    expect(SEGMENTS.map((s) => s.key)).toContain('shared')
  })
})

describe('flow', () => {
  const home = (at) => ev('spa_page_view', at, '/')
  const prof = (at) => ev('spa_page_view', at, '/player/x')
  const plan = (at) => ev('spa_page_view', at, '/planner')
  const people = prep([person([home(0), prof(2), plan(5)]), person([home(0), prof(4)]), person([home(0), plan(1)]), person([prof(0)]), person([ev('player_search', 1)])])
  it('shows each branch, not one sequence', () => {
    const flow = buildFlow(people)
    expect(flow.people).toBe(4)
    expect(flow.noPath).toBe(1)
    const ids = flow.nodes.map((x) => x.id)
    expect(ids).toContain('0:Home')
    expect(ids).toContain('1:Player profile')
    expect(ids).toContain('1:Planner')
    expect(flow.nodes.find((x) => x.id === '0:Home').count).toBe(3)
    expect(flow.links.find((l) => l.id === '0:Home>1:Player profile').count).toBe(2)
    expect(flow.links.find((l) => l.id === '0:Home>1:Planner').count).toBe(1)
  })
  it('puts everyone who stopped at a "Left the site" node and keeps the counts consistent', () => {
    const flow = buildFlow(people)
    const left = flow.nodes.filter((x) => x.left)
    expect(left.reduce((s, x) => s + x.count, 0)).toBe(4)
    for (const c of [0, 1, 2]) {
      const out = flow.links.filter((l) => l.from.startsWith(`${c}:`)).reduce((s, l) => s + l.count, 0)
      const into = flow.nodes.filter((x) => x.col === c).reduce((s, x) => s + x.count, 0)
      if (c > 0) expect(into).toBeGreaterThanOrEqual(out)
    }
  })
  it('gives the median time between steps and who to open', () => {
    const flow = buildFlow(people)
    const toProfile = flow.links.find((l) => l.id === '0:Home>1:Player profile')
    expect(toProfile.medianMs).toBe(3 * 60_000)
    expect(flow.nodes.find((x) => x.id === '1:Player profile').people[0].key).toMatch(/^v:/)
  })
  it('collapses a run of pages in one area', () => {
    const p = prep([person([prof(0), ev('spa_page_view', 1, '/player/y'), plan(2)])])[0]
    expect(pathOf(p).map((s) => s.area)).toEqual(['Player profile', 'Planner'])
  })
})

describe('insights', () => {
  it('warns about a small sample', () => {
    const a = buildAnalysis(prep([person([ev('spa_page_view', 0, '/')])]))
    expect(a.insights[0].kind).toBe('warning')
  })
  it('names the biggest drop in each funnel and explains steps done out of order', () => {
    const lots = Array.from({ length: 40 }, () => person([ev('spa_page_view', 0, '/planner')]))
    const skippers = Array.from({ length: 6 }, () => person([ev('planner_plan_saved', 2)]))
    const a = buildAnalysis(prep([...lots, ...skippers]))
    const drop = a.insights.find((i) => i.kind === 'drop' && i.funnel === 'planner')
    expect(drop.title).toContain('Added a goal')
    expect(a.insights.some((i) => i.kind === 'pattern' && /outside the order/.test(i.title))).toBe(true)
  })
  it('keeps warnings first', () => {
    const out = buildInsights({ cohort: 5, funnels: [], flow: { people: 0, nodes: [], links: [] } })
    expect(out[0].kind).toBe('warning')
  })
})

describe('people who cannot be followed', () => {
  it('has a key of its own for the entry that mixes them', async () => {
    const { parsePersonKey, ANON_KEY } = await import('../../server/src/utils/journeys.js')
    expect(parsePersonKey(ANON_KEY)).toEqual({ kind: 'anon', id: null })
    expect(parsePersonKey('a:7')).toEqual({ kind: 'account', id: 7 })
    expect(parsePersonKey('n:other')).toBeNull()
  })
})
