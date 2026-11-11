import { ref, watch } from 'vue'

// "Rivals" without accounts: your own RSN and the players you follow live in this browser's localStorage. Nothing
// is sent to the server, so there is nothing to sign up for and nothing to lose track of.
const ME_KEY = 'tickgains:me'
const RIVALS_KEY = 'tickgains:rivals'
export const MAX_RIVALS = 25

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    // Storage unavailable (private browsing, blocked, etc.), just don't persist.
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore write failures (private browsing, storage full, etc.)
  }
}

// Module-level so every caller shares the same refs, like useGainPeriod.
const loadedMe = read(ME_KEY, '')
const loadedRivals = read(RIVALS_KEY, [])
const me = ref(typeof loadedMe === 'string' ? loadedMe : '')
const rivals = ref(Array.isArray(loadedRivals) ? loadedRivals.filter((n) => typeof n === 'string').slice(0, MAX_RIVALS) : [])

watch(me, (v) => write(ME_KEY, v))
watch(rivals, (v) => write(RIVALS_KEY, v), { deep: true })

const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase()

export function useRivals() {
  const isMe = (name) => !!me.value && same(me.value, name)
  const isRival = (name) => rivals.value.some((r) => same(r, name))

  function setMe(name) {
    me.value = String(name || '').trim()
    // You are not your own rival.
    rivals.value = rivals.value.filter((r) => !same(r, me.value))
  }
  function clearMe() {
    me.value = ''
  }
  function addRival(name) {
    const n = String(name || '').trim()
    if (!n || isMe(n) || isRival(n)) return false
    if (rivals.value.length >= MAX_RIVALS) return false
    rivals.value = [...rivals.value, n]
    return true
  }
  function removeRival(name) {
    rivals.value = rivals.value.filter((r) => !same(r, name))
  }

  return { me, rivals, isMe, isRival, setMe, clearMe, addRival, removeRival }
}
