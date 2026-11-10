import { computed, ref, watch } from 'vue'
import { authApi } from '@/api/auth'
import { claimsApi } from '@/api/claims'
import { notificationsApi } from '@/api/notifications'
import { useRivals } from '@/composables/useRivals'
import { useGainPeriod } from '@/composables/useGainPeriod'

// Accounts keep a few preferences (your OSRS name, your rivals, the gain period) so they follow you between devices.
// Everything still works with no account: the same values live in this browser's localStorage as before. When you are
// signed in, changes are also saved to your account, and signing in on a new device brings them back.
const user = ref(null)
const ready = ref(false)
// 'idle' | 'saving' | 'saved' | 'error', for the little status line on the account page.
const syncState = ref('idle')
// Profiles this account owns (verified claims): [{ username, displayName }]. Shown in the account menu.
const profiles = ref([])
// Things that need this account's attention (see the avatar's red badge): { items, total }.
const notifications = ref({ items: [], total: 0 })

const { me, rivals } = useRivals()
const { period } = useGainPeriod()

const snapshot = () => ({ me: me.value, rivals: [...rivals.value], gainPeriod: period.value })
let lastSaved = ''
let timer = null

async function push(settings) {
  syncState.value = 'saving'
  try {
    await authApi.saveSettings(settings)
    syncState.value = 'saved'
  } catch {
    syncState.value = 'error'
  }
}

// Server values win where the account has them; anything the account does not have yet is filled from this browser,
// so someone who already set up rivals before signing up keeps them.
function reconcile(settings = {}) {
  const missing = {}
  if (typeof settings.me === 'string') me.value = settings.me
  else if (me.value) missing.me = me.value
  if (Array.isArray(settings.rivals)) rivals.value = settings.rivals
  else if (rivals.value.length) missing.rivals = [...rivals.value]
  if (['day', 'week', 'month'].includes(settings.gainPeriod)) period.value = settings.gainPeriod
  else missing.gainPeriod = period.value
  lastSaved = JSON.stringify(snapshot())
  if (Object.keys(missing).length) push(missing)
}

// Save changes made while signed in, a moment after the last one.
watch(
  [me, rivals, period],
  () => {
    if (!user.value) return
    const now = JSON.stringify(snapshot())
    if (now === lastSaved) return
    clearTimeout(timer)
    syncState.value = 'saving'
    timer = setTimeout(() => {
      lastSaved = now
      push(snapshot())
    }, 600)
  },
  { deep: true },
)

/** Reloads the list of profiles this account owns. Quiet on failure, the menu just falls back to the email. */
export async function refreshProfiles() {
  if (!user.value) {
    profiles.value = []
    return
  }
  try {
    const res = await claimsApi.mine()
    profiles.value = res.claims.filter((c) => c.status === 'verified').map((c) => c.player)
  } catch {
    // Keep whatever we had.
  }
}

/** Asks the server what needs attention. Quiet on failure: the badge just keeps its last value. */
export async function refreshNotifications() {
  if (!user.value) {
    notifications.value = { items: [], total: 0 }
    return
  }
  try {
    notifications.value = await notificationsApi.get()
  } catch {
    // Keep whatever we had.
  }
}

function setUser(u) {
  user.value = u
  if (u) {
    reconcile(u.settings)
    refreshProfiles()
    refreshNotifications()
  } else {
    profiles.value = []
    notifications.value = { items: [], total: 0 }
  }
}

/** Called once when the app starts: finds out whether this browser is already signed in. */
let starting = null
export function initAuth() {
  if (!starting) {
    starting = authApi
      .me()
      .then((res) => setUser(res?.user || null))
      .catch(() => {})
      .finally(() => (ready.value = true))
  }
  return starting
}

/** Creates the account. It does not sign anyone in: the email has to be confirmed first. Returns { email, emailSent }. */
export async function signUp({ email, password, confirmPassword, newsletter, website }) {
  return authApi.signup({ email, password, confirmPassword, newsletter, website, settings: snapshot() })
}

/** Uses the link from the confirmation email, which also signs the person in. */
export async function confirmEmail(token) {
  const res = await authApi.verify(token)
  setUser(res.user)
  return res.user
}

export async function logIn(email, password) {
  const res = await authApi.login(email, password)
  setUser(res.user)
  return res.user
}

export async function resetPassword(token, password) {
  const res = await authApi.reset(token, password)
  setUser(res.user)
  return res.user
}

export async function logOut() {
  try {
    await authApi.logout()
  } finally {
    clearTimeout(timer)
    user.value = null
    profiles.value = []
    notifications.value = { items: [], total: 0 }
    syncState.value = 'idle'
    // Leave nothing of this account behind on a shared computer: back to the defaults.
    me.value = ''
    rivals.value = []
    period.value = 'week'
    lastSaved = ''
  }
}

/** Resolves once the first "who is signed in?" answer is back, so route guards do not flash the wrong page. */
export const authReady = () => initAuth()

export function useAuth() {
  const isAdmin = computed(() => !!user.value?.roles?.some((r) => r === 'admin' || r === 'owner'))
  return { user, ready, loggedIn: computed(() => !!user.value), isAdmin, syncState, profiles, notifications }
}
