// Quests and training methods that were added lately, so the site can mark them "New" for a week.
//
// To mark something: add its id and the date it was added (YYYY-MM-DD, Eastern time). The tag shows from midnight Eastern that day until
// midnight Eastern seven days later and then disappears by itself; an old line here does nothing and can be deleted whenever.
//   quests    the quest's slug ('the-graveyard'; a 'quest:' prefix is fine too)
//   methods   the method's id ('agility-prison-of-raun')
export const NEW_DAYS = 7
export const NEW_CONTENT = {
  'the-graveyard': '2026-11-25',
  'agility-prison-of-raun': '2026-11-25',
}

const DAY_MS = 86_400_000
// Midnight Eastern in winter (UTC-5). Every date here falls in standard time or is close enough that a one-hour drift does not matter.
const startOf = (date) => Date.parse(`${date}T05:00:00Z`)

/** True from the day something was added until NEW_DAYS days later. `id` may carry a 'quest:' prefix. */
export function isNewContent(id, now = Date.now(), list = NEW_CONTENT) {
  const added = list[String(id ?? '').replace(/^quest:/, '')]
  if (!added) return false
  const start = startOf(added)
  return Number.isFinite(start) && now >= start && now < start + NEW_DAYS * DAY_MS
}
