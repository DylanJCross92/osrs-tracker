// Mirrors server/src/services/osrsHiscores.service.js's SKILL_NAMES.
export const SKILL_NAMES = [
  'Attack',
  'Defence',
  'Strength',
  'Hitpoints',
  'Ranged',
  'Prayer',
  'Magic',
  'Cooking',
  'Woodcutting',
  'Fletching',
  'Fishing',
  'Firemaking',
  'Crafting',
  'Smithing',
  'Mining',
  'Herblore',
  'Agility',
  'Thieving',
  'Slayer',
  'Farming',
  'Runecraft',
  'Hunter',
  'Construction',
  'Sailing',
]

// Same 24 skills, reordered to match the in-game skills panel's 3-column
// layout (read left-to-right, top-to-bottom), "Overall" isn't a tile there
// either, it's the total shown separately, so it's left out here too.
// Sailing is tacked on at the end, same as it appears in-game.
export const SKILL_GRID_ORDER = [
  'Attack', 'Hitpoints', 'Mining',
  'Strength', 'Agility', 'Smithing',
  'Defence', 'Herblore', 'Fishing',
  'Ranged', 'Thieving', 'Cooking',
  'Prayer', 'Crafting', 'Firemaking',
  'Magic', 'Fletching', 'Woodcutting',
  'Runecraft', 'Slayer', 'Farming',
  'Construction', 'Hunter', 'Sailing',
]

// File names (under public/icons/skills/) for the real skill icons used on
// the official hiscores page, keyed by skill name.
export const SKILL_ICON_FILES = {
  Overall: 'overall',
  Attack: 'attack',
  Defence: 'defence',
  Strength: 'strength',
  Hitpoints: 'hitpoints',
  Ranged: 'ranged',
  Prayer: 'prayer',
  Magic: 'magic',
  Cooking: 'cooking',
  Woodcutting: 'woodcutting',
  Fletching: 'fletching',
  Fishing: 'fishing',
  Firemaking: 'firemaking',
  Crafting: 'crafting',
  Smithing: 'smithing',
  Mining: 'mining',
  Herblore: 'herblore',
  Agility: 'agility',
  Thieving: 'thieving',
  Slayer: 'slayer',
  Farming: 'farming',
  Runecraft: 'runecraft',
  Hunter: 'hunter',
  Construction: 'construction',
  Sailing: 'sailing',
}

export function skillIconSrc(skill) {
  return `/icons/skills/${SKILL_ICON_FILES[skill]}.gif`
}

/** 4_200_000 -> "4.2M", 12_000 -> "12K", 850 -> "850". Trailing zeros are dropped. */
export function formatXp(xp) {
  const n = Number(xp) || 0
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${parseFloat((n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2))}M`
  if (abs >= 1_000) return `${parseFloat((n / 1_000).toFixed(1))}K`
  return String(n)
}

/** Same compacting as formatXp, but with an explicit +/- sign for a gain/loss delta. */
export function formatSignedXp(xp) {
  const n = Number(xp) || 0
  if (n === 0) return '0'
  return `${n > 0 ? '+' : '-'}${formatXp(Math.abs(n))}`
}

export function xpForSkill(snapshot, skill) {
  if (skill === 'Overall') return snapshot.overallXp
  return snapshot.skills?.[skill]?.xp ?? 0
}

export function levelForSkill(snapshot, skill) {
  if (skill === 'Overall') return snapshot.overallLevel
  return snapshot.skills?.[skill]?.level ?? 1
}

const xpForLevelCache = [0, 0]
/** Total xp required to reach a given level (1-99), via the game's own formula. */
export function xpForLevel(level) {
  if (xpForLevelCache[level] != null) return xpForLevelCache[level]
  let points = 0
  let xp = 0
  for (let lvl = 1; lvl < level; lvl++) {
    points += Math.floor(lvl + 300 * 2 ** (lvl / 7))
    xp = Math.floor(points / 4)
    if (xpForLevelCache[lvl + 1] == null) xpForLevelCache[lvl + 1] = xp
  }
  return xp
}

export function rankForSkill(snapshot, skill) {
  if (skill === 'Overall') return snapshot.overallRank
  return snapshot.skills?.[skill]?.rank ?? null
}

const PERIODS = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
}

/** Midnight today in the browser's own local timezone. */
function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * Baseline snapshot for a trailing window, the newest snapshot from before
 * it began, or the very first snapshot if the player hasn't been tracked
 * that long yet. "day" is pinned to local midnight (the calendar day), not
 * a rolling 24h window, "week"/"month" are plain rolling windows.
 */
function baselineSnapshot(snapshots, period) {
  if (period === 'all') return snapshots[0]
  const cutoff = period === 'day' ? startOfToday() : Date.now() - PERIODS[period]
  // Use the last snapshot taken before the cutoff, so xp earned between that
  // snapshot and the first one inside the window still counts. If the player
  // has no snapshot that old, fall back to their first one.
  let baseline = snapshots[0]
  for (const s of snapshots) {
    if (new Date(s.capturedAt).getTime() < cutoff) baseline = s
    else break
  }
  return baseline
}

/** Change in some per-snapshot stat over a trailing window. */
function gainBetween(snapshots, skill, period, accessor) {
  if (!snapshots.length) return 0
  const latest = snapshots[snapshots.length - 1]
  return accessor(latest, skill) - accessor(baselineSnapshot(snapshots, period), skill)
}

/** XP gained over a trailing window. */
export function xpGain(snapshots, skill, period) {
  return gainBetween(snapshots, skill, period, xpForSkill)
}

/** Levels gained over a trailing window. */
export function levelGain(snapshots, skill, period) {
  return gainBetween(snapshots, skill, period, levelForSkill)
}

/**
 * Leaderboard positions climbed over a trailing window, a lower rank
 * number is better, so this is baseline rank minus latest rank. Null if
 * either end is unranked, since rank movement isn't meaningful without
 * both points.
 */
export function rankGain(snapshots, skill, period) {
  if (!snapshots.length) return null
  const latest = snapshots[snapshots.length - 1]
  const latestRank = rankForSkill(latest, skill)
  if (latestRank == null) return null
  const baselineRank = rankForSkill(baselineSnapshot(snapshots, period), skill)
  if (baselineRank == null) return null
  return baselineRank - latestRank
}
