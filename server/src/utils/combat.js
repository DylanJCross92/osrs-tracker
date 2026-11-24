// A player's combat level from a hiscores snapshot ({ Attack: { level }, ... }). The same formula as src/utils/combat.js on the site (the server image does not
// include the site's source, so it lives in both places; tests/server/combat.spec.js keeps them equal). Returns null when none of the seven combat skills is known.
const NAMES = ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Prayer', 'Magic']

export function combatLevelFromSkills(skills) {
  if (!skills || typeof skills !== 'object') return null
  const lv = {}
  for (const n of NAMES) {
    const x = Number(skills[n]?.level)
    if (Number.isFinite(x) && x > 0) lv[n] = x
  }
  if (!Object.keys(lv).length) return null
  const l = (s, d = 1) => lv[s] ?? d
  const base = 0.25 * (l('Defence') + l('Hitpoints', 10) + Math.floor(l('Prayer') / 2))
  const melee = 0.325 * (l('Attack') + l('Strength'))
  const ranged = 0.325 * Math.floor(l('Ranged') * 1.5)
  const magic = 0.325 * Math.floor(l('Magic') * 1.5)
  return Math.floor(base + Math.max(melee, ranged, magic))
}
