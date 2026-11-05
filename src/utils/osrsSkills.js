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
]

// Same 23 skills, reordered to match the in-game skills panel's 3-column
// layout (read left-to-right, top-to-bottom) — "Overall" isn't a tile there
// either, it's the total shown separately, so it's left out here too.
export const SKILL_GRID_ORDER = [
  'Attack', 'Hitpoints', 'Mining',
  'Strength', 'Agility', 'Smithing',
  'Defence', 'Herblore', 'Fishing',
  'Ranged', 'Thieving', 'Cooking',
  'Prayer', 'Crafting', 'Firemaking',
  'Magic', 'Fletching', 'Woodcutting',
  'Runecraft', 'Slayer', 'Farming',
  'Construction', 'Hunter',
]

// Decorative only — plain Unicode emoji, not game assets.
export const SKILL_ICONS = {
  Overall: '⭐',
  Attack: '⚔️',
  Defence: '🛡️',
  Strength: '💪',
  Hitpoints: '❤️',
  Ranged: '🏹',
  Prayer: '🙏',
  Magic: '🔮',
  Cooking: '🍳',
  Woodcutting: '🪓',
  Fletching: '🪶',
  Fishing: '🎣',
  Firemaking: '🔥',
  Crafting: '💎',
  Smithing: '🔨',
  Mining: '⛏️',
  Herblore: '🧪',
  Agility: '🏃',
  Thieving: '🕵️',
  Slayer: '💀',
  Farming: '🌾',
  Runecraft: '🌀',
  Hunter: '🐾',
  Construction: '🏠',
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

export function rankForSkill(snapshot, skill) {
  if (skill === 'Overall') return snapshot.overallRank
  return snapshot.skills?.[skill]?.rank ?? null
}

const PERIODS = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
}

/**
 * XP gained over a trailing window, using the oldest snapshot still inside
 * the window as the baseline (or the very first snapshot, if the player
 * hasn't been tracked that long yet).
 */
export function xpGain(snapshots, skill, period) {
  if (!snapshots.length) return 0
  const latest = snapshots[snapshots.length - 1]
  if (period === 'all') return xpForSkill(latest, skill) - xpForSkill(snapshots[0], skill)

  const cutoff = Date.now() - PERIODS[period]
  const baseline = snapshots.find((s) => new Date(s.capturedAt).getTime() >= cutoff) ?? snapshots[0]
  return xpForSkill(latest, skill) - xpForSkill(baseline, skill)
}

/**
 * The most recent nonzero xp gain between two consecutive checks for a
 * skill — "gained since last check", or, if the last check (or several in a
 * row) came back flat, the last time it actually moved before that. Returns
 * null if the skill has never gained xp across the tracked history.
 */
export function lastXpGain(snapshots, skill) {
  for (let i = snapshots.length - 1; i > 0; i--) {
    const amount = xpForSkill(snapshots[i], skill) - xpForSkill(snapshots[i - 1], skill)
    if (amount > 0) {
      return { amount, capturedAt: snapshots[i].capturedAt }
    }
  }
  return null
}
