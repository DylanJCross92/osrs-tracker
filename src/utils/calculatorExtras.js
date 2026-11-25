// Skill-specific outputs for the calculators, only where reliable per-action data exists.
// Everything else simply shows xp, time and gp (and the materials list when the method has one).

// Rooftop and course xp per lap, and the wiki's marks of grace per hour (low, high) where the course drops them (data/marksOfGrace.js, the same
// figures the plans sell as amylase crystals).
import { MARKS } from '@/data/marksOfGrace'
const marksOf = (id) => [MARKS[id].low, MARKS[id].high]

const AGILITY_COURSES = {
  'agility-gnome': { name: 'Gnome Stronghold Course', xpPerLap: 86.5, marks: marksOf('agility-gnome') },
  'agility-draynor': { name: 'Draynor Village Rooftop', xpPerLap: 120, marks: marksOf('agility-draynor') },
  'agility-al-kharid': { name: 'Al Kharid Rooftop', xpPerLap: 180, marks: marksOf('agility-al-kharid') },
  'agility-varrock': { name: 'Varrock Rooftop', xpPerLap: 238, marks: marksOf('agility-varrock') },
  'agility-canifis': { name: 'Canifis Rooftop', xpPerLap: 240, marks: marksOf('agility-canifis') },
  'agility-falador': { name: 'Falador Rooftop', xpPerLap: 440, marks: marksOf('agility-falador') },
  'agility-seers': { name: "Seers' Village Rooftop", xpPerLap: 570, marks: marksOf('agility-seers') },
  'agility-pollnivneach': { name: 'Pollnivneach Rooftop', xpPerLap: 890, marks: marksOf('agility-pollnivneach') },
  'agility-rellekka': { name: 'Rellekka Rooftop', xpPerLap: 780, marks: marksOf('agility-rellekka') },
  'agility-ardougne': { name: 'Ardougne Rooftop', xpPerLap: 793, marks: marksOf('agility-ardougne') },
  'agility-wilderness': { name: 'Wilderness Agility Course', xpPerLap: 571 },
  // The slow, no-shortcut route (2,960 xp a lap on the Wiki), with Jagex's 12 to 14 marks an hour for the slower route.
  'agility-prison-of-raun': { name: 'Prison of R\u00e6un', xpPerLap: 2960, marks: marksOf('agility-prison-of-raun') },
}

/**
 * Laps and marks of grace for each step of an Agility route. Steps on courses without lap data
 * (Prifddinas, the Sepulchre, Pyramid...) are listed with no lap count, and `complete` is false so
 * callers never present a partial lap total as the whole route.
 */
export function agilityLaps(plan) {
  const rows = []
  let complete = true
  for (const seg of plan.segments || []) {
    if (!seg.method || !seg.xp) continue
    const c = AGILITY_COURSES[seg.method.id]
    const hours = seg.hours || 0
    if (!c) {
      complete = false
      rows.push({ name: seg.method.name, levels: `${seg.startLevel} → ${seg.endLevel}`, laps: null, marks: null })
      continue
    }
    rows.push({
      name: c.name,
      levels: `${seg.startLevel} → ${seg.endLevel}`,
      laps: Math.ceil(seg.xp / c.xpPerLap),
      marks: c.marks && hours ? [Math.round(hours * c.marks[0]), Math.round(hours * c.marks[1])] : null,
    })
  }
  return { rows, complete }
}

/** Quick method filters, offered next to the "methods to use" list. Each lists the method ids to keep. */
export const METHOD_PRESETS = {
  Agility: [
    {
      label: 'Rooftop courses only',
      keep: ['agility-gnome', 'agility-draynor', 'agility-al-kharid', 'agility-varrock', 'agility-canifis', 'agility-falador', 'agility-seers', 'agility-pollnivneach', 'agility-rellekka', 'agility-ardougne'],
    },
  ],
}
