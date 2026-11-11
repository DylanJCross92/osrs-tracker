// Turns each training method's plain-text requirements ("Monkey Madness II (partial), 75 Attack") into structured items
// the planner can check, show and let the player confirm.
//
// kind:
//   skill      a level in a skill, checked against the player's tracked levels
//   quest      a quest (optionally partial progress), confirmed by the player
//   diary      an achievement diary, confirmed by the player
//   equipment  gear, items or supplies, confirmed by the player
//   unlock     an area, spellbook, guild, technique or other unlock, confirmed by the player
//   note       a recommendation or detail that is shown but not confirmable
import { SKILL_NAMES } from '@/utils/osrsSkills'

const QUEST_NAMES = [
  'Children of the Sun', 'Monkey Madness II', 'Monkey Madness I', 'Ghosts Ahoy', 'Dwarf Cannon', 'Perilous Moons', 'Sins of the Father',
  'Bone Voyage', 'Troubled Tortugans', 'The Blood Moon Rises', 'Barbarian Training', 'Swan Song', 'Tai Bwo Wannai Trio', 'Regicide',
  'Pandemonium', "Eagles' Peak", 'Song of the Elves', 'A Kingdom Divided', 'Lunar Diplomacy', 'Sleeping Giants', 'Dragon Slayer II',
  'Temple of the Eye', 'Lost City', 'Troll Stronghold', 'Creature of Fenkenstrain', 'Death to the Dorgeshuun', 'Dream Mentor',
  'Druidic Ritual', 'Fishing Contest', 'Vale Totems',
]
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ']/g, ' ').replace(/\s+/g, ' ').trim()
const QUEST_LOOKUP = new Map(QUEST_NAMES.map((n) => [norm(n), n]))

const SKILL_RE = SKILL_NAMES.join('|')
const LEVEL_FIRST = new RegExp(`^(\\d{1,3}) (${SKILL_RE})\\b`, 'i')
const SKILL_FIRST = new RegExp(`^(${SKILL_RE}) (?:level )?(\\d{1,3})\\b`, 'i')
const EQUIPMENT_RE = /\b(mace|hammer|blowpipe|bow|halberd|sceptre|robes?|pendant|gauntlets|gloves|rod|fire cape|ring|shards?|bones|tar|herb|ingredients|pouch(es)?|catalyst|hull|greegree|hat|cape|weapon|coins|bolts?|rune|protection)\b/i
const UNLOCK_RE = /(access|guild|spellbook|ancient magicks|tick manipulation|player-owned house|gilded altar|superior garden|demon butler|altar|patch|library|slayer master|protect from|spell\b|teleport|zeah|karamja|varlamore|desert|favour|kitchen)/i

const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const slug = (s) => norm(s).replace(/ /g, '-')

function skillName(raw) {
  return SKILL_NAMES.find((n) => n.toLowerCase() === String(raw).toLowerCase())
}

function parseToken(raw) {
  let t = raw.trim().replace(/\.$/, '')
  if (!t) return null

  if (/recommended|\bvisit$|\bcoins entry$/i.test(t)) return { id: `note:${slug(t)}`, kind: 'note', label: titleCase(t) }

  let m = t.match(LEVEL_FIRST)
  if (m) return { id: `skill:${skillName(m[2]).toLowerCase()}:${m[1]}`, kind: 'skill', skill: skillName(m[2]), level: Number(m[1]), label: `${m[1]} ${skillName(m[2])}` }
  m = t.match(SKILL_FIRST)
  if (m) return { id: `skill:${skillName(m[1]).toLowerCase()}:${m[2]}`, kind: 'skill', skill: skillName(m[1]), level: Number(m[2]), label: `${m[2]} ${skillName(m[1])}` }

  // Partial progress on a quest: "Monkey Madness II (partial)", "partial Eagles' Peak", "Regicide partial", "Started Perilous Moons".
  let partial = false
  let core = t
  if (/\(partial\)/i.test(core)) { partial = true; core = core.replace(/\s*\(partial\)/i, '') }
  if (/^(partial|started) /i.test(core)) { partial = true; core = core.replace(/^(partial|started) /i, '') }
  if (/ partial$/i.test(core)) { partial = true; core = core.replace(/ partial$/i, '') }
  core = core.replace(/\s*\([^)]*\)\s*$/, '').replace(/ (mini)?quest$/i, '').replace(/ for (easiest|best) (access|rates)$/i, '').replace(/ \(gives your first level\)$/i, '').trim()

  const questName = QUEST_LOOKUP.get(norm(core))
  if (questName) {
    return { id: `quest:${slug(questName)}${partial ? ':partial' : ''}`, kind: 'quest', label: partial ? `${questName} (partial)` : questName, partial }
  }
  if (/^(NMZ quests|Quest requirements for NMZ access)$/i.test(core)) {
    return { id: 'quest:nmz-quests', kind: 'quest', label: 'Nightmare Zone quests', partial: false }
  }
  if (/\bdiary\b|achievement diary/i.test(core)) return { id: `diary:${slug(core)}`, kind: 'diary', label: titleCase(core) }
  // Words like "Hosidius kitchen" or "Elite" lean to unlock; gear words to equipment. Access wins over a gear word in "Fishing Guild".
  if (UNLOCK_RE.test(core) && !/\b(pendant|rod|hat|ring|cape|robes?)\b/i.test(core)) return { id: `unlock:${slug(core)}`, kind: 'unlock', label: titleCase(core) }
  if (EQUIPMENT_RE.test(core)) return { id: `equipment:${slug(core)}`, kind: 'equipment', label: titleCase(core) }
  if (UNLOCK_RE.test(core)) return { id: `unlock:${slug(core)}`, kind: 'unlock', label: titleCase(core) }
  return { id: `unlock:${slug(core)}`, kind: 'unlock', label: titleCase(core) }
}

/** Structured requirements from a method's text. A skill level in the method's own skill that its minimum level already covers is dropped. */
export function parseRequirementText(text, ownSkill = '', minLevel = 0) {
  if (!text) return []
  const out = []
  const seen = new Set()
  for (const part of String(text).split(/,|\band\b/)) {
    const req = parseToken(part)
    if (!req || seen.has(req.id)) continue
    if (req.kind === 'skill' && req.skill === ownSkill && req.level <= minLevel) continue
    seen.add(req.id)
    out.push(req)
  }
  return out
}

const cache = new Map()
/** Requirements for a catalog method (cached). */
export function requirementsFor(method) {
  if (!method) return []
  if (cache.has(method.id)) return cache.get(method.id)
  const reqs = parseRequirementText(method.requirements, method.skill, method.minLevel)
  cache.set(method.id, reqs)
  return reqs
}
