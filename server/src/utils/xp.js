// The game's XP table on the server, one copy (it used to be copied into four files). Same formula and the same limits as the client's
// src/utils/planner.js; tests/utils/numbersAgree.spec.js checks every level against it, so the two cannot drift apart.
export const MAX_XP = 200_000_000
export const MAX_LEVEL = 126

// Integer maths, as the game does it: level 99 = 13,034,431 and level 126 = 188,884,740.
const XP_TABLE = (() => {
  const table = [0, 0]
  let points = 0
  for (let lvl = 1; lvl < MAX_LEVEL; lvl++) {
    points += Math.floor(lvl + 300 * 2 ** (lvl / 7))
    table[lvl + 1] = Math.floor(points / 4)
  }
  return table
})()

/** Total XP needed to reach a level (1 to 126; anything outside is held to that range). */
export const xpAtLevel = (level) => XP_TABLE[Math.min(Math.max(Math.floor(level), 1), MAX_LEVEL)]

/** The level an XP total is worth, to 99 (or to 126 with `virtual`). */
export function levelAtXp(xp, virtual = false) {
  const cap = virtual ? MAX_LEVEL : 99
  let level = 1
  while (level < cap && xp >= XP_TABLE[level + 1]) level++
  return level
}

export const XP_99 = XP_TABLE[99]
