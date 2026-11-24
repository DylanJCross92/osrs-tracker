// The game's combat level from a player's levels. The same formula as the game (and the Wiki): a defence, hitpoints and prayer base, plus 0.325 of whichever
// of melee, ranged or magic is strongest. `levels` is { Skill: level }; a missing skill counts as level 1 (Hitpoints as 10).
export const MAX_COMBAT_LEVEL = 126

export function combatLevel(levels) {
  const l = (s, d = 1) => levels[s] ?? d
  const base = 0.25 * (l('Defence') + l('Hitpoints', 10) + Math.floor(l('Prayer') / 2))
  const melee = 0.325 * (l('Attack') + l('Strength'))
  const ranged = 0.325 * Math.floor(l('Ranged') * 1.5)
  const magic = 0.325 * Math.floor(l('Magic') * 1.5)
  return Math.floor(base + Math.max(melee, ranged, magic))
}
