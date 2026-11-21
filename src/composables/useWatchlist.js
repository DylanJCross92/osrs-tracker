import { ref } from 'vue'
import { KEYS, SYNCED_EVENT } from '@/utils/accountData'
import { track } from '@/utils/analytics'

// The Grand Exchange items someone watches. They live in this browser (so it works signed out) and, because the key is one the
// account keeps in step (see utils/accountData.js), follow a signed-in person to their other devices. Items are kept as their page
// addresses ("dragon-bones"), in the order they were added.
export const MAX_WATCH = 100
const KEY = KEYS.watch

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((s) => typeof s === 'string').slice(0, MAX_WATCH) : []
  } catch {
    return []
  }
}

// Module level, so every place that shows the list shares one copy.
const slugs = ref(read())
const reload = () => {
  slugs.value = read()
}
if (typeof window !== 'undefined') {
  // A sign-in brings in the account's list; another tab may change it too.
  window.addEventListener(SYNCED_EVENT, reload)
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) reload()
  })
}

function save(next) {
  slugs.value = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* kept for this visit only */
  }
}

/** Test helper: reads the list from storage again. */
export const reloadWatchlist = reload

export function useWatchlist() {
  const isWatching = (slug) => slugs.value.includes(slug)
  /** Starts or stops watching an item. Returns true when it is watched afterwards, false when it is not (or the list is full). */
  function toggle(slug, source = 'item') {
    if (!slug) return false
    if (isWatching(slug)) {
      save(slugs.value.filter((s) => s !== slug))
      track('ge_unwatch', { source })
      return false
    }
    if (slugs.value.length >= MAX_WATCH) return false
    save([...slugs.value, slug])
    track('ge_watch', { source })
    return true
  }
  const remove = (slug, source = 'list') => {
    if (isWatching(slug)) toggle(slug, source)
  }
  return { slugs, isWatching, toggle, remove }
}
