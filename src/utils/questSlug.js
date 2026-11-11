// One way to turn a quest name into an id fragment, shared by the quest tracker, the quest shortcuts and method
// requirements, so "Monkey Madness II" is the same quest everywhere. "Eagles' Peak" -> "eagles'-peak".
export const questSlug = (name) =>
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9 ']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ /g, '-')

export const questId = (name) => `quest:${questSlug(name)}`
