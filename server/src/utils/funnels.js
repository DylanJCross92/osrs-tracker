// The conversion funnels, the user flow and the insights for the owner's statistics page. Pure (no database), so it is easy to test.
//
// A person is an account, or a browser that has not signed up. Row shape (see services/funnels.service.js):
//   { key: 'a:7' | 'v:<id>', kind: 'account' | 'visitor', label, events: [{ name, at, path }], signedUpAt, confirmedAt, claimedAt, lastSeenAt }
// with every time in milliseconds (or null) and the events oldest first.
//
// Funnels count in sequence: a person is counted at a step only when they also reached every step before it, and did it after the
// step before. Each step also reports how many people did it at all, in any order (`independent`), so the two kinds of number are
// never confused: independent counts can be larger than the sequential one, and the difference is `bypassed`.

const MINUTE = 60_000
const DAY = 86_400_000

export const MIN_STEP_SAMPLE = 10
export const MIN_COHORT_SAMPLE = 30
export const FLOW_COLUMNS = 4
const FLOW_PEOPLE_SHOWN = 12

/** The middle value of a list of numbers, or null when empty. */
export function median(list) {
  const v = list.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!v.length) return null
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2)
}

/** 4 min, 3 h, 2 days: how long a gap in milliseconds was, in a few words. null -> ''. */
export function spanLabel(ms) {
  if (ms == null) return ''
  if (ms < MINUTE) return 'under a minute'
  const min = Math.round(ms / MINUTE)
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} h`
  return `${Math.round(h / 24)} days`
}

const pct = (n, of) => (of ? Math.round((n / of) * 1000) / 10 : null)
const dayOf = (t) => new Date(t).toISOString().slice(0, 10)
const pathOnly = (path) => String(path || '/').split(/[?#]/)[0] || '/'

// --- the funnels -------------------------------------------------------------------------------------------------------------
// A step says when a person did it: every time it happened, oldest first. Events are matched by name or by the page opened.

const matching = (test) => (p) => p.events.filter(test).map((e) => e.at)
const named = (...names) => matching((e) => names.includes(e.name))
const onPage = (test) => matching((e) => e.name === 'spa_page_view' && test(pathOnly(e.path)))
const fact = (key) => (p) => (p[key] != null ? [p[key]] : [])
const anyOf = (...fns) => (p) => fns.flatMap((f) => f(p)).sort((a, b) => a - b)

const PLANNER_PAGE = (path) => path === '/planner' || path.startsWith('/planner/')
const CLAN_PAGES = (path) => path === '/clans' || path.startsWith('/clans/') || path.startsWith('/join/')
const CLAN_VIEW = (path) => /^\/clans\/(?!mine$|new$)[^/]+/.test(path)

export const FUNNELS = [
  {
    key: 'registration',
    label: 'Registration',
    blurb: 'From a first visit to an account with a claimed player.',
    steps: [
      { key: 'visited', label: 'Visited', times: (p) => [p.first] },
      { key: 'signedUp', label: 'Signed up', times: fact('signedUpAt') },
      { key: 'confirmed', label: 'Confirmed email', times: fact('confirmedAt') },
      { key: 'claimed', label: 'Claimed a player', times: fact('claimedAt') },
    ],
  },
  {
    key: 'tracking',
    label: 'Tracking',
    blurb: 'From a first visit to looking up, opening and exploring a player, and claiming one.',
    steps: [
      { key: 'visited', label: 'Visited', times: (p) => [p.first] },
      { key: 'lookup', label: 'Looked up a player', times: named('player_search', 'player_added', 'profile_view', 'search_suggestion_selected') },
      { key: 'profile', label: 'Opened a profile', times: named('profile_view') },
      { key: 'explored', label: 'Explored a profile', times: named('profile_tab', 'profile_gain_period', 'profile_table_toggle', 'profile_check_history', 'profile_customize', 'profile_refresh', 'profile_skill_planner') },
      { key: 'claimed', label: 'Claimed a player', times: fact('claimedAt') },
    ],
  },
  {
    key: 'planner',
    label: 'Planner',
    blurb: 'From opening the planner to a saved, shared plan.',
    steps: [
      { key: 'visited', label: 'Visited', times: (p) => [p.first] },
      { key: 'opened', label: 'Opened the planner', times: anyOf(onPage(PLANNER_PAGE), matching((e) => e.name.startsWith('planner_') || e.name.startsWith('quick_planner_'))) },
      { key: 'goal', label: 'Added a goal', times: named('planner_goal_added', 'planner_template_used', 'planner_recommended_used', 'planner_route_picked', 'quick_planner_goal') },
      { key: 'saved', label: 'Saved a plan', times: named('planner_plan_saved') },
      { key: 'shared', label: 'Shared a plan', times: named('plan_share', 'plan_shared', 'plan_share_updated') },
    ],
  },
  {
    key: 'clans',
    label: 'Clans',
    blurb: 'From opening Clans to joining or running one.',
    steps: [
      { key: 'visited', label: 'Visited', times: (p) => [p.first] },
      { key: 'opened', label: 'Opened Clans', times: anyOf(onPage(CLAN_PAGES), matching((e) => e.name.startsWith('clan_'))) },
      { key: 'viewed', label: 'Viewed a clan', times: anyOf(onPage(CLAN_VIEW), named('clan_invite_open')) },
      { key: 'joined', label: 'Joined or ran a clan', times: named('clan_join_request', 'clan_create', 'clan_member_add', 'competition_create') },
    ],
  },
]

/** The step times of a person, in sequence: [t1, t2, ...] up to the last step they reached (each at or after the one before). */
export function reachOf(person, steps) {
  const out = []
  let previous = -Infinity
  for (const s of steps) {
    const at = s.times(person).find((t) => t >= previous)
    if (at === undefined) break
    out.push(at)
    previous = at
  }
  return out
}

/** One funnel: [{ key, label, value, ofFirst, ofPrevious, lost, independent, bypassed, medianMs, medianLabel, lowSample }] and the biggest drop. */
export function buildFunnel(def, people) {
  const reached = people.map((p) => reachOf(p, def.steps))
  const steps = def.steps.map((s, i) => {
    const here = reached.filter((r) => r.length > i)
    const previous = i ? reached.filter((r) => r.length > i - 1).length : null
    const independent = i ? people.filter((p) => s.times(p).length > 0).length : people.length
    const gap = i ? median(here.map((r) => r[i] - r[i - 1])) : null
    return {
      key: s.key,
      label: s.label,
      value: here.length,
      ofFirst: pct(here.length, people.length),
      ofPrevious: i ? pct(here.length, previous) : null,
      lost: i ? previous - here.length : 0,
      independent,
      bypassed: Math.max(0, independent - here.length),
      medianMs: gap,
      medianLabel: spanLabel(gap),
      // Too few people reached the step before for the percentage to mean much.
      lowSample: i ? previous < MIN_STEP_SAMPLE : false,
    }
  })
  // The biggest drop is where the most people were lost (a bigger share breaks a tie).
  let biggest = -1
  steps.forEach((s, i) => {
    if (!i || s.lost <= 0) return
    const b = steps[biggest]
    if (!b || s.lost > b.lost || (s.lost === b.lost && (s.ofPrevious ?? 100) < (b.ofPrevious ?? 100))) biggest = i
  })
  return { key: def.key, label: def.label, blurb: def.blurb, steps, biggestDrop: biggest >= 0 ? biggest : null }
}

// --- who is counted --------------------------------------------------------------------------------------------------------------

const SHARED_EVENTS = new Set(['planner_share_link_opened', 'shared_plan_viewed', 'clan_invite_open'])

/** The groups of people the page can look at. */
export const SEGMENTS = [
  { key: 'all', label: 'Everyone', test: () => true },
  { key: 'signedup', label: 'Signed up', test: (p) => p.kind === 'account' },
  { key: 'visitor', label: 'Not signed up', test: (p) => p.kind !== 'account' },
  { key: 'returning', label: 'Came back another day', test: (p) => new Set(p.events.map((e) => dayOf(e.at))).size >= 2 },
  { key: 'shared', label: 'Opened a shared plan or invite', test: (p) => p.events.some((e) => SHARED_EVENTS.has(e.name)) },
]

/** Everything that needs a person's first and last time. `people` come in without `first`; they are added here. */
export function withFirst(people) {
  return people.map((p) => {
    const times = [p.events[0]?.at, p.signedUpAt].filter((t) => t != null)
    return { ...p, first: times.length ? Math.min(...times) : null }
  }).filter((p) => p.first != null)
}

// --- the flow ----------------------------------------------------------------------------------------------------------------------

/** The part of the site a page belongs to. */
export function areaOf(path) {
  const p = pathOnly(path)
  if (p === '/') return 'Home'
  if (/^\/(player|challenge)(\/|$)/.test(p)) return 'Player profile'
  if (/^\/(discover|leaderboard)(\/|$)/.test(p)) return 'Discover'
  if (/^\/(planner|plan|plans)(\/|$)/.test(p)) return 'Planner'
  if (/^\/(calculators|osrs-xp-table)(\/|$)/.test(p)) return 'Calculators'
  if (/^\/(clans|join|competitions)(\/|$)/.test(p)) return 'Clans'
  if (/^\/compare(\/|$)/.test(p)) return 'Compare'
  if (/^\/(login|signup|forgot-password|reset-password|verify-email|account)(\/|$)/.test(p)) return 'Account'
  return 'Other'
}

/** The areas a person visited in order, one entry for a run of pages in the same area: [{ area, at }]. */
export function pathOf(person) {
  const out = []
  for (const e of person.events) {
    if (e.name !== 'spa_page_view') continue
    const area = areaOf(e.path)
    if (out.length && out[out.length - 1].area === area) continue
    out.push({ area, at: e.at })
  }
  return out
}

/**
 * The paths people took: nodes (an area at a step, or "Left" at a step) and the links between them, with how many people took each
 * and the median time between steps. Nobody is assumed to follow a single sequence: every different path is its own branch.
 * People with no page recorded cannot be placed and are counted in `noPath`.
 */
export function buildFlow(people, columns = FLOW_COLUMNS) {
  const nodes = new Map()
  const links = new Map()
  let placed = 0
  const node = (col, area) => {
    const id = `${col}:${area}`
    if (!nodes.has(id)) nodes.set(id, { id, col, area, label: area === 'left' ? 'Left the site' : area, left: area === 'left', count: 0, gaps: [], people: [] })
    return nodes.get(id)
  }
  const link = (from, to) => {
    const id = `${from.id}>${to.id}`
    if (!links.has(id)) links.set(id, { id, from: from.id, to: to.id, count: 0, gaps: [] })
    return links.get(id)
  }
  for (const person of people) {
    const steps = pathOf(person).slice(0, columns)
    if (!steps.length) continue
    placed++
    const ended = pathOf(person).length < columns
    const chain = steps.map((s, col) => ({ n: node(col, s.area), at: s.at }))
    if (ended) chain.push({ n: node(steps.length, 'left'), at: null })
    chain.forEach((c, i) => {
      c.n.count++
      c.n.people.push({ key: person.key, label: person.label, at: person.events[person.events.length - 1].at })
      if (i) {
        const gap = c.at != null && chain[i - 1].at != null ? c.at - chain[i - 1].at : null
        const l = link(chain[i - 1].n, c.n)
        l.count++
        if (gap != null) {
          l.gaps.push(gap)
          c.n.gaps.push(gap)
        }
      }
    })
  }
  const nodeList = [...nodes.values()]
    .map((n) => {
      const gap = median(n.gaps)
      return {
        id: n.id,
        col: n.col,
        area: n.area,
        label: n.label,
        left: n.left,
        count: n.count,
        pct: pct(n.count, placed),
        medianMs: gap,
        medianLabel: spanLabel(gap),
        // The people most recently active, for opening in the Visitors tab.
        people: n.people.sort((a, b) => b.at - a.at).slice(0, FLOW_PEOPLE_SHOWN).map(({ key, label }) => ({ key, label })),
      }
    })
    .sort((a, b) => a.col - b.col || Number(a.left) - Number(b.left) || b.count - a.count)
  const linkList = [...links.values()].map((l) => ({ id: l.id, from: l.from, to: l.to, count: l.count, pct: pct(l.count, placed), medianMs: median(l.gaps), medianLabel: spanLabel(median(l.gaps)) })).sort((a, b) => b.count - a.count)
  return { columns, people: placed, noPath: people.length - placed, nodes: nodeList, links: linkList }
}

// --- insights -----------------------------------------------------------------------------------------------------------------------

const people = (n) => `${n.toLocaleString('en-US')} ${n === 1 ? 'person' : 'people'}`
const pctText = (p) => (p == null ? '-' : `${Number.isInteger(p) ? p : p.toFixed(1)}%`)

/**
 * Plain statements about what the numbers show: the biggest drop in each funnel, what converts well, patterns worth a look, and
 * warnings where the sample is too small to conclude anything. [{ kind: 'warning' | 'drop' | 'win' | 'pattern', title, text, funnel? }].
 */
export function buildInsights({ cohort, funnels, flow }) {
  const out = []
  if (cohort < MIN_COHORT_SAMPLE) {
    out.push({ kind: 'warning', title: 'Small sample', text: `Only ${people(cohort)} are in this view. Percentages can swing a lot with one person, so read these as hints, not conclusions.` })
  }
  for (const f of funnels) {
    const top = f.steps[0].value
    if (top < 1) continue
    if (f.biggestDrop != null) {
      const s = f.steps[f.biggestDrop]
      const before = f.steps[f.biggestDrop - 1]
      out.push({
        kind: 'drop',
        funnel: f.key,
        title: `${f.label}: biggest drop is before "${s.label}"`,
        text: `${people(s.lost)} of ${before.value.toLocaleString('en-US')} got as far as "${before.label}" but not on to "${s.label}" (${pctText(100 - (s.ofPrevious ?? 0))} lost).${s.lowSample ? ` Only ${people(before.value)} reached the step before, so this may be chance.` : ''}`,
        lowSample: s.lowSample,
      })
    }
    // What converts well: the step with the best carry-on rate among steps that enough people reached.
    const sturdy = f.steps.map((s, i) => ({ s, i })).filter(({ s, i }) => i && !s.lowSample && s.value > 0)
    const best = sturdy.sort((a, b) => (b.s.ofPrevious ?? 0) - (a.s.ofPrevious ?? 0))[0]
    if (best && (best.s.ofPrevious ?? 0) >= 50) {
      out.push({ kind: 'win', funnel: f.key, title: `${f.label}: "${best.s.label}" converts well`, text: `${pctText(best.s.ofPrevious)} of the people who reached "${f.steps[best.i - 1].label}" went on to "${best.s.label}".` })
    }
    // People who did a step but not in the funnel's order: independent counts and sequential counts disagree, and that is why.
    f.steps.forEach((s, i) => {
      if (i && s.bypassed >= 3 && s.bypassed >= s.independent * 0.25) {
        out.push({
          kind: 'pattern',
          funnel: f.key,
          title: `${f.label}: "${s.label}" happens outside the order`,
          text: `${people(s.independent)} did this, but only ${s.value.toLocaleString('en-US')} did it after the steps before it. The other ${s.bypassed.toLocaleString('en-US')} skipped ahead, so they are in the "did it at all" count and not in the bar.`,
        })
      }
    })
    // A step that nobody got past even though plenty reached it.
    f.steps.forEach((s, i) => {
      const before = i ? f.steps[i - 1] : null
      if (before && before.value >= MIN_STEP_SAMPLE && s.value === 0) {
        out.push({ kind: 'pattern', funnel: f.key, title: `${f.label}: nobody reached "${s.label}"`, text: `${people(before.value)} reached "${before.label}" and none went on. Check that the step can be done and is recorded.` })
      }
    })
  }
  if (flow && flow.people >= MIN_STEP_SAMPLE) {
    const first = flow.nodes.filter((n) => n.col === 0)
    const exits = flow.nodes.filter((n) => n.left && n.col === 1)
    const single = exits.reduce((s, n) => s + n.count, 0)
    if (single) {
      out.push({ kind: 'pattern', title: 'One-page visits', text: `${pctText(pct(single, flow.people))} of people (${people(single)}) left after one part of the site.` })
    }
    const lead = first.sort((a, b) => b.count - a.count)[0]
    if (lead && lead.pct >= 40) out.push({ kind: 'pattern', title: `Most people start on ${lead.label}`, text: `${pctText(lead.pct)} of people (${people(lead.count)}) begin on ${lead.label === 'Home' ? 'the home page' : `the ${lead.label} pages`}.` })
  } else if (flow && flow.people > 0) {
    out.push({ kind: 'warning', title: 'Few paths to show', text: `Only ${people(flow.people)} have a page path recorded, so the flow is a rough picture.` })
  }
  // Warnings first, then what to fix, then what works, then the rest.
  const order = { warning: 0, drop: 1, win: 2, pattern: 3 }
  return out.sort((a, b) => order[a.kind] - order[b.kind])
}

/** Everything the statistics page needs for the people given (already limited to the date range) and the chosen segment. */
export function buildAnalysis(allPeople, segmentKey = 'all') {
  const segments = SEGMENTS.map((s) => ({ key: s.key, label: s.label, people: allPeople.filter(s.test).length }))
  const chosen = SEGMENTS.find((s) => s.key === segmentKey) || SEGMENTS[0]
  const cohort = allPeople.filter(chosen.test)
  const funnels = FUNNELS.map((f) => buildFunnel(f, cohort))
  const flow = buildFlow(cohort)
  return { segment: chosen.key, segments, cohort: cohort.length, funnels, flow, insights: buildInsights({ cohort: cohort.length, funnels, flow }) }
}

export const DAY_MS = DAY
