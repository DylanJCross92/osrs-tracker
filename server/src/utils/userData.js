// What an account may keep from the browser, and how big it may be. The server keeps only these keys, in this shape,
// so the data column cannot be used to store arbitrary files. Each key is { value, updatedAt } where updatedAt is an
// ISO time the browser sets when that key last changed (used to decide which side is newer).
export const MAX_PLANS = 50
export const MAX_PLAN_BYTES = 20_000
export const MAX_PLANNER_BYTES = 60_000
export const MAX_RECENTS = 10
export const MAX_SET = 200
export const MAX_WATCH = 100
const NAME_RE = /^[A-Za-z0-9 _-]{1,12}$/
const ID_RE = /^[\w-]{1,40}$/

const bytes = (v) => Buffer.byteLength(JSON.stringify(v), 'utf8')
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
const stamp = (v) => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date(0).toISOString()
}

function cleanPlans(list) {
  if (!Array.isArray(list)) return null
  const plans = []
  for (const p of list) {
    if (!isObj(p) || typeof p.id !== 'string' || !ID_RE.test(p.id) || typeof p.name !== 'string') continue
    if (bytes(p) > MAX_PLAN_BYTES) continue
    plans.push({ ...p, name: p.name.slice(0, 60), updatedAt: stamp(p.updatedAt) })
  }
  return plans.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_PLANS)
}

function cleanRecents(list) {
  if (!Array.isArray(list)) return null
  const out = []
  const seen = new Set()
  for (const r of list) {
    if (!isObj(r) || typeof r.username !== 'string' || !NAME_RE.test(r.username) || seen.has(r.username.toLowerCase())) continue
    seen.add(r.username.toLowerCase())
    out.push({ username: r.username, displayName: typeof r.displayName === 'string' && NAME_RE.test(r.displayName) ? r.displayName : r.username })
    if (out.length >= MAX_RECENTS) break
  }
  return out
}

// Answers to "do you have this quest, item or unlock?", keyed by requirement id ("quest:monkey-madness-ii").
export const MAX_REQUIREMENTS = 600
function cleanRequirements(map) {
  if (!isObj(map)) return null
  const out = {}
  for (const [id, v] of Object.entries(map)) {
    if (!/^[a-z]+:[a-z0-9:'-]{1,80}$/.test(id) || !['have', 'missing', 'unknown'].includes(v)) continue
    out[id] = v
    if (Object.keys(out).length >= MAX_REQUIREMENTS) break
  }
  return out
}

function cleanSet(list) {
  if (!Array.isArray(list)) return null
  return [...new Set(list.filter((v) => typeof v === 'string' && v.length > 0 && v.length <= 80))].slice(-MAX_SET)
}

// The answers to the Smart Planner's questions (see utils/smartPlanner.js): a small fixed set of choices, nothing free-form.
const PLANNER_GOALS = ['skills', 'money', 'combat', 'quests', 'afk', 'hardcore']
const PLANNER_GP = ['low', 'some', 'good', 'rich']
const PLANNER_EXPERIENCE = ['new', 'returning', 'veteran']
function cleanPlannerProfile(v) {
  if (!isObj(v)) return null
  const out = {}
  if (typeof v.members === 'boolean') out.members = v.members
  if (PLANNER_GOALS.includes(v.goal)) out.goal = v.goal
  if (Number.isFinite(Number(v.hours))) out.hours = Math.min(12, Math.max(0.5, Math.round(Number(v.hours) * 2) / 2))
  if (PLANNER_GP.includes(v.gp)) out.gp = v.gp
  if (PLANNER_EXPERIENCE.includes(v.experience)) out.experience = v.experience
  if (typeof v.iron === 'boolean') out.iron = v.iron
  return out
}

// The Grand Exchange items someone watches, as item addresses ("dragon-bones"), in the order they were added.
function cleanWatch(list) {
  if (!Array.isArray(list)) return null
  return [...new Set(list.filter((v) => typeof v === 'string' && /^[a-z0-9-]{1,120}$/.test(v)))].slice(0, MAX_WATCH)
}

/** Keeps the known keys with valid values. A key that is missing or invalid is left out (so a partial save never wipes the rest). */
export function sanitizeUserData(input) {
  const out = {}
  if (!isObj(input)) return out
  const take = (key, clean) => {
    const entry = input[key]
    if (!isObj(entry)) return
    const value = clean(entry.value)
    if (value !== null) out[key] = { value, updatedAt: stamp(entry.updatedAt) }
  }
  take('plans', cleanPlans)
  take('planner', (v) => (isObj(v) && Array.isArray(v.goals) && bytes(v) <= MAX_PLANNER_BYTES ? v : null))
  take('recents', cleanRecents)
  take('cheered', cleanSet)
  take('dismissed', cleanSet)
  take('requirements', cleanRequirements)
  take('watch', cleanWatch)
  take('plannerProfile', cleanPlannerProfile)
  return out
}
