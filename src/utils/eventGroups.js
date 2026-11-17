// Sorts the site's product events into the parts of the site they belong to, for the statistics page. First match wins.
const GROUPS = [
  { key: 'pages', label: 'Page views', test: /^spa_page_view$/ },
  { key: 'sharing', label: 'Sharing', test: /share|shared|link_copied/ },
  { key: 'planner', label: 'Planner', test: /^(planner_|quick_planner_|plan_|profile_skill_planner|quest_tracker)/ },
  { key: 'search', label: 'Search', test: /^(search_|player_search|player_added|player_link_click)/ },
  { key: 'account', label: 'Accounts', test: /^(sign_up|login|logout|session_resumed|password_|verification_|newsletter)/ },
  { key: 'profile', label: 'Profiles and Discover', test: /^(profile_|leaderboard_|home_view|congratulate|challenge_)/ },
]
export const OTHER_GROUP = { key: 'other', label: 'Everything else' }

export function eventGroup(name) {
  return GROUPS.find((g) => g.test.test(name)) || OTHER_GROUP
}

/** events: [{ name, total }] -> [{ key, label, value }], biggest first, page views left out (they are not something people chose to do). */
export function groupTotals(events) {
  const sums = new Map()
  for (const e of events) {
    const g = eventGroup(e.name)
    if (g.key === 'pages') continue
    sums.set(g.key, { key: g.key, label: g.label, value: (sums.get(g.key)?.value || 0) + (Number(e.total) || 0) })
  }
  return [...sums.values()].sort((a, b) => b.value - a.value)
}

// The path from first typing a name to having it tracked: each step is an event.
export const SEARCH_FUNNEL = [
  { name: 'search_started', label: 'Started a search' },
  { name: 'search_suggestions_shown', label: 'Saw suggestions' },
  { name: 'search_suggestion_selected', label: 'Picked a suggestion' },
  { name: 'player_added', label: 'Added a new player' },
]
