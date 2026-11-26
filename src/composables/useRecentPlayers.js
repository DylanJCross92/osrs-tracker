import { computed, ref, watch } from 'vue'
import { usePlayersStore } from '@/stores/players'
import { highestSkill } from '@/utils/profile'
import { sameCharacter } from '@/utils/characters'

// The players you searched for last, kept in this browser's localStorage (no account needed). Only names you typed
// into a search box land here, never pages you merely opened. Search boxes show the latest few when you focus them,
// so getting back to a player is one tap.
const KEY = 'tickgains:recent-searches'
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

// Sign-in (or sign-out) can change the saved list behind our back, so the list is read again when that happens.
if (typeof window !== 'undefined') window.addEventListener('tickgains:data-synced', () => (recent.value = read()))

/** Remember a player the user searched for (call it only with a real, tracked player, and only for typed searches). A name's normal and Hardcore Worlds characters are remembered separately. */
export function recordRecent(player) {
  if (!player?.username) return
  const entry = { username: player.username, displayName: player.displayName || player.username, mode: player.mode === 'hardcore' ? 'hardcore' : 'main' }
  recent.value = [entry, ...recent.value.filter((r) => !sameCharacter(r, entry))].slice(0, KEEP)
}

export function removeRecent(username, mode = 'main') {
  recent.value = recent.value.filter((r) => !sameCharacter(r, { username, mode }))
}

/** The list as suggestion rows, filled in from the live player list so only players that still exist are shown. */
export function useRecentPlayers() {
  const store = usePlayersStore()
  const options = computed(() => {
    if (!store.loaded) return []
    const rows = []
    for (const r of recent.value) {
      const mode = r.mode === 'hardcore' ? 'hardcore' : 'main'
      const p = (mode === 'hardcore' ? store.hardcorePlayers : store.players).find((x) => sameCharacter(x, r))
      if (!p) continue
      // The same name on the other side too: both are offered everywhere, so each says which one it is.
      const other = (mode === 'hardcore' ? store.players : store.hardcorePlayers).some((x) => sameCharacter(x, { username: r.username, mode: mode === 'hardcore' ? 'main' : 'hardcore' }))
      rows.push({
        username: p.username,
        displayName: p.displayName || p.username,
        mode,
        hasBoth: other,
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
    if (!store.hardcoreLoaded) store.loadHardcore().catch(() => {})
  }
  return { options, ensureLoaded, remove: removeRecent }
}
