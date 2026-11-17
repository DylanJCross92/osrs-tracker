import { describe, expect, it } from 'vitest'
import { eventGroup, groupTotals } from '../../src/utils/eventGroups.js'

describe('eventGroup', () => {
  it.each([
    ['spa_page_view', 'pages'],
    ['plan_share', 'sharing'],
    ['shared_plan_viewed', 'sharing'],
    ['planner_goal_added', 'planner'],
    ['quick_planner_modal_open', 'planner'],
    ['search_started', 'search'],
    ['player_added', 'search'],
    ['sign_up', 'account'],
    ['session_resumed', 'account'],
    ['profile_tab', 'profile'],
    ['outbound_click', 'other'],
  ])('%s belongs to %s', (name, key) => expect(eventGroup(name).key).toBe(key))
})

describe('groupTotals', () => {
  it('adds up each part of the site, biggest first, without page views', () => {
    const out = groupTotals([
      { name: 'spa_page_view', total: 500 },
      { name: 'planner_goal_added', total: 3 },
      { name: 'planner_new_plan', total: 4 },
      { name: 'search_started', total: 10 },
    ])
    expect(out.map((g) => [g.key, g.value])).toEqual([['search', 10], ['planner', 7]])
  })
})
