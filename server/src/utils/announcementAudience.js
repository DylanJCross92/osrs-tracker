// Who a one-off announcement goes to. Pure (no database): it merges the two lists and drops repeats, so the rules are easy to test.
//   users        accounts with a confirmed email that have not unsubscribed and are not on the team: [{ id, email }]
//   subscribers  people who asked to hear about news and have not unsubscribed: [{ email, unsub_token }]
//   alreadySent  lower-case addresses this announcement already went to
// One entry per address (an account wins over a subscriber with the same address), nobody already sent to, in a steady order.
// Returns [{ email, kind: 'user' | 'subscriber', userId?, token? }].
export function buildAudience({ users = [], subscribers = [], alreadySent = [] } = {}) {
  const done = new Set(alreadySent.map((e) => String(e).trim().toLowerCase()))
  const seen = new Set()
  const out = []
  const add = (entry) => {
    const key = String(entry.email || '').trim().toLowerCase()
    if (!key || !key.includes('@') || seen.has(key) || done.has(key)) return
    seen.add(key)
    out.push({ ...entry, email: String(entry.email).trim() })
  }
  for (const u of users) add({ email: u.email, kind: 'user', userId: u.id })
  for (const s of subscribers) add({ email: s.email, kind: 'subscriber', token: s.unsub_token })
  return out
}

/** Every address, whether or not it was already sent to (the full size of the audience). */
export const audienceSize = ({ users = [], subscribers = [] } = {}) => buildAudience({ users, subscribers }).length
