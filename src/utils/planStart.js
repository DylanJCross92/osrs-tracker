// Whether a saved plan has really started. A plan made for a skill you will train later used to count from the day it was made, so it showed "behind
// schedule" before a single XP was gained. Now a plan starts when XP is gained in its skills (found from the player's tracked history), or when the person
// says so, and a long gap in training is a break that does not count against the schedule. Pure functions: no storage, no network.

const DAY = 86_400_000
/** Days without XP in a plan's skills before the plan is called paused (and time after that stops counting against it). */
export const PAUSE_DAYS = 7

const ms = (v) => {
  const t = v ? new Date(v).getTime() : NaN
  return Number.isFinite(t) ? t : null
}

/**
 * Where a plan stands: { state, startedAt, lastGainAt, activeDays, manual }.
 *  state       'not-started' (nothing gained in its skills yet, or the person said so), 'active', or 'paused' (no XP in its skills for PAUSE_DAYS)
 *  startedAt   ISO time training began (just before the first gain, or when the person started it); null while not started
 *  activeDays  days of training time since it started, without the breaks (null while not started): what the schedule is measured from
 *  manual      true when the person chose (start now, or not started yet) instead of it being found from the XP
 * `plan` has statsAt (when the starting stats were taken), goals (with their starting XP) and optionally startedAt / startHold (the person's choice).
 * `history` is the player's tracked snapshots ([{ capturedAt, skills }]), `latest` their newest one; either may be missing.
 */
export function planStartInfo(plan, { history = null, latest = null } = {}, now = new Date()) {
  const nowMs = now.getTime()
  const goals = plan?.goals || []
  const notStarted = (manual = false) => ({ state: 'not-started', startedAt: null, lastGainAt: null, activeDays: null, manual })
  const baseMs = ms(plan?.statsAt) ?? ms(plan?.createdAt)
  if (!goals.length || baseMs == null) return notStarted()

  const manualStart = ms(plan.startedAt)
  if (plan.startHold === true && manualStart == null) return notStarted(true)

  const total = (skills) => goals.reduce((sum, g) => sum + (Number(skills?.[g.skill]?.xp) || 0), 0)
  const all = (history || [])
    .map((s) => ({ t: ms(s.capturedAt), skills: s.skills }))
    .filter((r) => r.t != null)
    .sort((a, b) => a.t - b.t)
  // Where each skill really stood: a start level typed in below the player's real level is not a reason to call the plan started (or to count XP
  // already there as gained since), so the starting XP is the higher of the plan's and the player's at the time the stats were taken.
  const xpAt = (t) => {
    const row = [...all].reverse().find((r) => r.t <= t)
    return Object.fromEntries(goals.map((g) => [g.skill, Math.max(Number(g.currentXp) || 0, Number(row?.skills?.[g.skill]?.xp) || 0)]))
  }
  const base = xpAt(baseMs)
  const startXp = goals.reduce((sum, g) => sum + base[g.skill], 0)

  // Every time XP was gained in the plan's skills since it was made, and when the snapshot before the first gain was taken.
  const rows = (history || [])
    .map((s) => ({ t: ms(s.capturedAt), xp: total(s.skills) }))
    .filter((r) => r.t != null && r.t >= baseMs && r.t <= nowMs)
    .sort((a, b) => a.t - b.t)
  const gains = []
  let prevXp = startXp
  let prevT = baseMs
  let beforeFirst = null
  for (const r of rows) {
    if (r.xp > prevXp) {
      gains.push(r.t)
      if (beforeFirst == null) beforeFirst = prevT
    }
    prevXp = Math.max(prevXp, r.xp)
    prevT = r.t
  }
  // No usable history, but the newest stats are ahead of where the plan began: it has been trained, though not when.
  const latestMs = ms(latest?.capturedAt)
  if (!gains.length && latest?.skills && total(latest.skills) > startXp) gains.push(latestMs ?? nowMs)

  let startMs = null
  if (manualStart != null) startMs = manualStart
  else if (gains.length) startMs = beforeFirst ?? baseMs
  if (startMs == null || startMs > nowMs) return notStarted(manualStart != null)

  // Training time since the start, where a stretch without XP only counts for its first PAUSE_DAYS (so a break never makes the schedule jump back).
  const points = [...gains.filter((t) => t >= startMs), nowMs]
  let activeDays = 0
  let prev = startMs
  for (const t of points) {
    activeDays += Math.min((t - prev) / DAY, PAUSE_DAYS)
    prev = Math.max(prev, t)
  }
  const lastGain = gains.filter((t) => t >= startMs).pop() ?? null
  const idle = (nowMs - (lastGain ?? startMs)) / DAY
  // What each skill stood at when the plan started: the schedule is worked out from there, not from a lower level typed in as the start.
  const atStart = xpAt(startMs)
  return {
    baseXp: Object.fromEntries(goals.map((g) => [g.skill, Math.max(base[g.skill], atStart[g.skill])])),
    state: idle > PAUSE_DAYS ? 'paused' : 'active',
    startedAt: new Date(startMs).toISOString(),
    lastGainAt: lastGain != null ? new Date(lastGain).toISOString() : null,
    activeDays,
    manual: manualStart != null,
  }
}
