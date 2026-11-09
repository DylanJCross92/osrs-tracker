// Skill-specific outputs for the calculators, only where reliable per-action data exists.
// Everything else simply shows xp, time and gp (and the materials list when the method has one).

// Rooftop and course xp per lap, and the wiki's marks of grace per hour (low, high) where the course drops them.
const AGILITY_COURSES = {
  'agility-gnome': { name: 'Gnome Stronghold Course', xpPerLap: 86.5 },
  'agility-draynor': { name: 'Draynor Village Rooftop', xpPerLap: 120, marks: [11, 12.4] },
  'agility-al-kharid': { name: 'Al Kharid Rooftop', xpPerLap: 180, marks: [10.4, 11.4] },
  'agility-varrock': { name: 'Varrock Rooftop', xpPerLap: 238, marks: [8.4, 10.8] },
  'agility-canifis': { name: 'Canifis Rooftop', xpPerLap: 240, marks: [12.8, 15.5] },
  'agility-falador': { name: 'Falador Rooftop', xpPerLap: 440, marks: [9.7, 11.3] },
  'agility-seers': { name: "Seers' Village Rooftop", xpPerLap: 570, marks: [11.8, 16] },
  'agility-pollnivneach': { name: 'Pollnivneach Rooftop', xpPerLap: 890, marks: [13, 18] },
  'agility-rellekka': { name: 'Rellekka Rooftop', xpPerLap: 780, marks: [13, 19.5] },
  'agility-ardougne': { name: 'Ardougne Rooftop', xpPerLap: 793, marks: [16.8, 22.1] },
  'agility-wilderness': { name: 'Wilderness Agility Course', xpPerLap: 571 },
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
