// The official OSRS xp table and the level maths on it. Kept apart from planner.js so the data files (which need it to work out
// rates over a level range) can use it without importing the planner, which imports them.
export const MAX_VIRTUAL_LEVEL = 126

// Built once with integer-only math (level 126 = 188,884,740).
const XP_TABLE = (() => {
  const table = [0, 0]
  let points = 0
  for (let lvl = 1; lvl < MAX_VIRTUAL_LEVEL; lvl++) {
    points += Math.floor(lvl + 300 * 2 ** (lvl / 7))
    table[lvl + 1] = Math.floor(points / 4)
  }
  return table
})()

export function xpAtLevel(level) {
  const l = Math.min(Math.max(Math.floor(level), 1), MAX_VIRTUAL_LEVEL)
  return XP_TABLE[l]
}

/** Level for an xp amount; virtual levels (100-126) when allowVirtual. */
export function levelAtXp(xp, allowVirtual = false) {
  const cap = allowVirtual ? MAX_VIRTUAL_LEVEL : 99
  let level = 1
  while (level < cap && xp >= XP_TABLE[level + 1]) level++
  return level
}
