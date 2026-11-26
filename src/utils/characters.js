// A name can have a normal character and a Hardcore Worlds character (see the Hardcore Worlds notes in the server's schema). Every search box and player list
// that offers "this player" goes through these, so each of them behaves the same: both are listed with Main / HC Worlds tags, and the one picked is the one opened.

const lower = (v) => String(v || '').toLowerCase()

/** True when two entries are the same character: the same name and the same side (normal or Hardcore Worlds). */
export const sameCharacter = (a, b) => lower(a?.username) === lower(b?.username) && (a?.mode === 'hardcore' ? 'hardcore' : 'main') === (b?.mode === 'hardcore' ? 'hardcore' : 'main')

/** A stable v-for key for a list that can have both characters of a name. */
export const characterKey = (o) => `${o?.username}:${o?.mode === 'hardcore' ? 'hardcore' : 'main'}`

/** The route to open a character's profile: the Hardcore Worlds side is asked for only when the name also has a normal character (otherwise it is the only one). */
export function profileLocation(o) {
  return { name: 'playerDetail', params: { username: o.username }, ...(o.mode === 'hardcore' && o.hasBoth ? { query: { world: 'hardcore' } } : {}) }
}

/** A tracked player from the store, normal or Hardcore Worlds. The Hardcore Worlds list has to be loaded (see ensureHardcoreLoaded). */
export function findCharacter(store, username, mode = 'main') {
  const list = mode === 'hardcore' ? store.hardcorePlayers : store.players
  return list.find((p) => lower(p.username) === lower(username)) ?? null
}

export async function ensureHardcoreLoaded(store) {
  if (!store.hardcoreLoaded) await store.loadHardcore().catch(() => {})
}
