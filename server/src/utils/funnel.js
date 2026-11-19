// Turns one row per person (see services/funnel.service.js) into the conversion funnel and the user journey for the owner's
// statistics page. Pure (no database), so it is easy to test.
//
// A person is an account, or a browser that has not signed up. The cohort is everyone seen in the window who did not already
// have an account when it started, plus every account created inside it. Row shape:
//   { first, played, added, viewed, signedUp, confirmed, claimed, back }
// where each time is an ISO string or null: first = first thing seen, played = first time a player was added or viewed,
// signedUp = account created, confirmed = email confirmed, claimed = first verified claim, back = last seen (an account only).

const ms = (t) => (t ? new Date(t).getTime() : null)
const MINUTE = 60_000

/** The middle value of a list of numbers, or null when empty. */
export function median(list) {
  const v = list.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!v.length) return null
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2)
}

/** 4 min, 3 h, 2 days: how long a gap in milliseconds was, in a few words. null -> ''. */
export function spanLabel(milliseconds) {
  if (milliseconds == null) return ''
  if (milliseconds < MINUTE) return 'under a minute'
  const min = Math.round(milliseconds / MINUTE)
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} h`
  const d = Math.round(h / 24)
  return `${d} days`
}

const pct = (n, of) => (of ? Math.round((n / of) * 1000) / 10 : null)

const STEPS = [
  { key: 'visited', label: 'Visited' },
  { key: 'player', label: 'Added or viewed a player' },
  { key: 'signedUp', label: 'Signed up' },
  { key: 'claimed', label: 'Claimed a player' },
]

/**
 * The funnel: each step counts only people who reached every step before it, so the bars only ever get shorter. People who
 * skipped a step (signed up without adding or viewing a player first, for example) are counted in `skipped` instead of being lost.
 */
export function buildFunnel(rows) {
  const all = rows || []
  const player = all.filter((r) => r.added || r.viewed)
  const signed = player.filter((r) => r.signedUp)
  const claimed = signed.filter((r) => r.claimed)
  const counts = [all.length, player.length, signed.length, claimed.length]
  const steps = STEPS.map((s, i) => ({
    key: s.key,
    label: s.label,
    value: counts[i],
    ofFirst: pct(counts[i], counts[0]),
    ofPrevious: i ? pct(counts[i], counts[i - 1]) : null,
  }))
  steps[1].detail = { added: player.filter((r) => r.added).length, viewed: player.filter((r) => r.viewed).length, both: player.filter((r) => r.added && r.viewed).length }
  steps[2].detail = { confirmed: signed.filter((r) => r.confirmed).length }
  const joined = all.filter((r) => r.signedUp)
  return {
    steps,
    // Signed up (and maybe claimed) without a recorded player step: they are in these totals but not in the funnel above.
    skipped: { signedUp: joined.length - signed.length, claimed: all.filter((r) => r.signedUp && r.claimed).length - claimed.length },
    totals: { people: all.length, signedUp: joined.length, claimed: all.filter((r) => r.signedUp && r.claimed).length },
  }
}

// The milestones a person can reach, with the one each time is measured from.
const MILESTONES = [
  { key: 'visited', label: 'First visit', at: (r) => r.first, from: null },
  { key: 'player', label: 'Added or viewed a player', at: (r) => r.played, from: 'visited', fromLabel: 'first visit' },
  { key: 'signedUp', label: 'Signed up', at: (r) => r.signedUp, from: 'visited', fromLabel: 'first visit' },
  { key: 'confirmed', label: 'Confirmed email', at: (r) => r.confirmed, from: 'signedUp', fromLabel: 'signing up' },
  { key: 'claimed', label: 'Claimed a player', at: (r) => r.claimed, from: 'signedUp', fromLabel: 'signing up' },
  { key: 'back', label: 'Came back another day', at: (r) => (r.signedUp && r.back && String(r.back).slice(0, 10) > String(r.signedUp).slice(0, 10) ? r.back : null), from: 'signedUp', fromLabel: 'signing up' },
]
const PATH_NAMES = { player: 'Viewed a player', signedUp: 'Signed up', confirmed: 'Confirmed', claimed: 'Claimed', back: 'Came back' }
const ORDER = ['player', 'signedUp', 'confirmed', 'claimed', 'back']

/** The milestones a person reached, in the order they happened (ties keep the usual order). */
export function milestonesOf(row) {
  return ORDER.map((key) => ({ key, at: ms(MILESTONES.find((m) => m.key === key).at(row)) }))
    .filter((m) => m.at != null)
    .sort((a, b) => a.at - b.at || ORDER.indexOf(a.key) - ORDER.indexOf(b.key))
    .map((m) => m.key)
}

/**
 * The journey: how many people reached each milestone and how long it typically took (the median) from the one it is measured
 * against, plus the most common paths people took, as a sequence of milestones.
 */
export function buildJourney(rows, pathLimit = 6) {
  const all = (rows || []).map((r) => ({ ...r, first: r.first || r.signedUp || r.played }))
  const reached = (m) => all.filter((r) => m.at(r))
  const milestones = MILESTONES.map((m) => {
    const who = reached(m)
    const from = m.from ? MILESTONES.find((x) => x.key === m.from) : null
    const gaps = from ? who.map((r) => ms(m.at(r)) - ms(from.at(r))).filter((g) => Number.isFinite(g)).map((g) => Math.max(0, g)) : []
    const mid = median(gaps)
    return {
      key: m.key,
      label: m.label,
      value: who.length,
      // Signing up and what follows are shared out among the people who signed up, the earlier steps among everyone.
      ofBase: m.key === 'visited' ? null : pct(who.length, ['confirmed', 'claimed', 'back'].includes(m.key) ? reached(MILESTONES[2]).length : all.length),
      baseLabel: ['confirmed', 'claimed', 'back'].includes(m.key) ? 'of sign-ups' : 'of visitors',
      typical: mid == null ? null : mid,
      typicalLabel: mid == null ? '' : `${spanLabel(mid)} after ${m.fromLabel}`,
    }
  })
  const paths = new Map()
  for (const r of all) {
    const key = milestonesOf(r).join('>')
    paths.set(key, (paths.get(key) || 0) + 1)
  }
  const total = all.length
  const list = [...paths]
    .map(([key, n]) => ({ key, n, steps: key ? key.split('>') : [], label: ['Visited', ...(key ? key.split('>').map((k) => PATH_NAMES[k]) : [])].join(' → '), pct: pct(n, total) }))
    .sort((a, b) => b.n - a.n || a.key.length - b.key.length)
  return { milestones, paths: list.slice(0, pathLimit), otherPaths: list.slice(pathLimit).reduce((s, p) => s + p.n, 0) }
}
