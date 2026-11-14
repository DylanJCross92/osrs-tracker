// What a profile shows off: the daily-gain streak, a badge for each skill at 99, the highest total level and total XP
// marks, and the achievement the owner pinned. All of it is worked out from the achievements the server already sends
// (nothing extra is stored), so a badge is always something the profile has really earned.

/** The streak chip: a live streak of two days or more, otherwise the best one if it was worth a mention, otherwise nothing. */
export function streakFlair(streak) {
  const current = Number(streak?.current) || 0
  const longest = Math.max(Number(streak?.longest) || 0, current)
  const days = (n) => `${n.toLocaleString('en-US')}-day`
  if (current >= 2) return { kind: 'live', text: `${days(current)} streak`, current, longest, best: longest > current ? longest : null, hint: longest > current ? `Longest streak: ${longest.toLocaleString('en-US')} days` : 'This is their longest streak so far' }
  if (longest >= 3) return { kind: 'best', text: `Best streak ${longest.toLocaleString('en-US')} days`, current, longest, best: null, hint: 'The most days in a row with XP gained' }
  return null
}

const earned = (a) => a.completed === true

/**
 * The badges for a profile. `capes` is one entry per skill at 99 (flagged when it has reached 200M XP), and the highest total
 * level and total XP marks come with the title the achievement list uses.
 */
export function flairBadges(achievements) {
  const list = Array.isArray(achievements) ? achievements : []
  const done = list.filter(earned)
  const topOf = (type) => done.filter((a) => a.type === type).sort((a, b) => b.value - a.value)[0] || null
  const twoHundred = new Set(done.filter((a) => a.type === 'skill_xp' && a.value >= 200_000_000).map((a) => a.skill))
  const capes = done
    .filter((a) => a.type === 'skill_level' && a.value === 99)
    .map((a) => ({ skill: a.skill, max: twoHundred.has(a.skill) }))
    // 200M first, then the order the skills are listed in.
    .sort((a, b) => Number(b.max) - Number(a.max))
  const level = topOf('total_level')
  const xp = topOf('total_xp')
  return {
    capes,
    totalLevel: level ? { value: level.value, title: level.title } : null,
    totalXp: xp ? { value: xp.value, title: xp.title } : null,
    earned: done.length,
    total: list.length,
  }
}

/** The pinned achievement, as the full achievement, but only when it has really been earned. */
export function pinnedAchievement(achievements, key) {
  if (!key || !Array.isArray(achievements)) return null
  const a = achievements.find((x) => x.key === key)
  return a && earned(a) ? a : null
}

/** Earned achievements grouped by category, for the owner's pin picker. The biggest marks in a group come first. */
export function pinOptions(achievements) {
  const groups = new Map()
  for (const a of Array.isArray(achievements) ? achievements : []) {
    if (!earned(a)) continue
    if (!groups.has(a.category)) groups.set(a.category, [])
    groups.get(a.category).push(a)
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items: items.sort((a, b) => b.value - a.value) }))
}
