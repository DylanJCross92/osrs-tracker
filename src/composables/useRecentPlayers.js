import { computed, ref, watch } from 'vue'
import { usePlayersStore } from '@/stores/players'
import { highestSkill } from '@/utils/profile'

// The players you looked at last, kept in this browser's localStorage (no account needed). Search boxes show the
// latest few when you focus them, so getting back to a player is one tap.
const KEY = 'tickgains:recent-players'
// Stored a little deeper than shown, so a name that no longer exists on the site can drop out without leaving the
// list short.
const KEEP = 10
export const SHOW_RECENT = 3

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw == null ? [] : JSON.parse(raw)
    return Array.isArray(list) ? list.filter((r) => r && typeof r.username === 'string').slice(0, KEEP) : []
  } catch {
    return []
  }
}

// Module-level so every search box shares one list, like useRivals.
const recent = ref(read())
watch(
  recent,
  (v) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(v))
    } catch {
      // Storage unavailable (private browsing, full), the list just lasts for this visit.
    }
  },
  { deep: true },
)

const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase()

/** Remember a player that exists on the site (call it only with a real, tracked player). */
export function recordRecent(player) {
  if (!player?.username) return
  const entry = { username: player.username, displayName: player.displayName || player.username }
  recent.value = [entry, ...recent.value.filter((r) => !same(r.username, entry.username))].slice(0, KEEP)
}

export function removeRecent(username) {
  recent.value = recent.value.filter((r) => !same(r.username, username))
}

/** The list as suggestion rows, filled in from the live player list so only players that still exist are shown. */
export function useRecentPlayers() {
  const store = usePlayersStore()
  const options = computed(() => {
    if (!store.loaded) return []
    const rows = []
    for (const r of recent.value) {
      const p = store.players.find((x) => same(x.username, r.username))
      if (!p) continue
      rows.push({
        username: p.username,
        displayName: p.displayName || p.username,
        badge: p.badge ?? null,
        overallLevel: p.latest?.overallLevel ?? null,
        overallXp: p.latest?.overallXp ?? null,
        topSkill: p.latest ? highestSkill(p.latest)?.skill ?? null : null,
        weekGain: p.gains?.week?.xp ?? 0,
        recent: true,
      })
      if (rows.length === SHOW_RECENT) break
    }
    return rows
  })
  const ensureLoaded = () => {
    if (!store.loaded) store.loadPlayers().catch(() => {})
  }
  return { options, ensureLoaded, remove: removeRecent }
}
