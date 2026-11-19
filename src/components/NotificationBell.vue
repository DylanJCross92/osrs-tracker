<template>
  <div ref="rootEl" class="bell">
    <button type="button" class="bell-btn" :aria-expanded="open" aria-haspopup="true" :aria-label="total > 0 ? `Notifications, ${total} new` : 'Notifications'" @click="toggle" @keydown.esc="open = false">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0112 0c0 7 3 8.5 3 8.5H3S6 15 6 8" /><path d="M10.3 20a1.9 1.9 0 003.4 0" /></svg>
      <span v-if="total > 0" class="acct-badge bell-badge" aria-hidden="true">{{ total > 9 ? '9+' : total }}</span>
    </button>

    <div v-if="open" class="bell-menu" role="dialog" aria-label="Notifications">
      <header class="bell-head">
        <div class="bell-title">
          <b>Notifications</b>
          <span v-if="unread" class="bell-count">{{ unread }} new</span>
        </div>
        <button v-if="unread" class="btn-text" type="button" @click="readAll">Mark all read</button>
      </header>

      <div class="bell-scroll">
        <!-- Things waiting on you -->
        <section v-if="notifications.items.length" class="bell-sec" aria-label="Needs your attention">
          <h3 class="bell-label">Needs your attention</h3>
          <RouterLink v-for="n in notifications.items" :key="n.id" class="bell-item is-live" :to="n.to" @click="open = false">
            <span class="bell-av" :class="`tone-${kind(n.type).tone}`" aria-hidden="true">
              <PlayerAvatar v-if="n.subject" :name="n.subject" />
              <svg v-else class="bell-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-for="d in kind(n.type).paths" :key="d" :d="d" /></svg>
              <span v-if="n.subject" class="bell-badge-ico" :class="`tone-${kind(n.type).tone}`"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path v-for="d in kind(n.type).paths" :key="d" :d="d" /></svg></span>
            </span>
            <span class="bell-text"><span class="bell-line">{{ n.text }}</span><small v-if="n.createdAt">{{ ago(n.createdAt) }}</small></span>
            <span v-if="kind(n.type).action" class="bell-act">{{ kind(n.type).action }}</span>
          </RouterLink>
        </section>

        <p v-if="loading && !inbox.length" class="bell-empty">Loading…</p>

        <!-- Everything else, by day -->
        <section v-for="sec in sections" :key="sec.label" class="bell-sec" :aria-label="sec.label">
          <h3 class="bell-label">{{ sec.label }}</h3>
          <div v-for="r in sec.rows" :key="r.n.id" class="bell-row" :class="{ 'is-child': r.child }">
            <a class="bell-item" :class="{ 'is-unread': !r.n.read }" :href="r.n.link || undefined" @click.prevent="go(r.n)">
              <i class="bell-dot" aria-hidden="true" />
              <span class="bell-av" :class="`tone-${kind(r.n.type).tone}`" aria-hidden="true">
                <PlayerAvatar v-if="r.n.subject" :name="r.n.subject" />
                <svg v-else class="bell-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-for="d in kind(r.n.type).paths" :key="d" :d="d" /></svg>
                <span v-if="r.n.subject" class="bell-badge-ico" :class="`tone-${kind(r.n.type).tone}`"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path v-for="d in kind(r.n.type).paths" :key="d" :d="d" /></svg></span>
              </span>
              <span class="bell-text"><span class="bell-line">{{ r.n.text }}</span><small>{{ ago(r.n.createdAt) }}</small></span>
            </a>
            <button v-if="!r.n.read" class="bell-read" type="button" aria-label="Mark as read" title="Mark as read" @click.stop="readOne(r.n)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </button>
            <button v-if="r.more" class="bell-fold" type="button" :aria-expanded="r.more.open" @click="toggleRun(r.runKey)">
              {{ r.more.open ? 'Show fewer' : `Show ${r.more.count} earlier like this` }}
            </button>
          </div>
        </section>

        <div v-if="!loading && !notifications.items.length && !inbox.length" class="bell-empty">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0112 0c0 7 3 8.5 3 8.5H3S6 15 6 8" /><path d="M10.3 20a1.9 1.9 0 003.4 0" /></svg>
          <b>You're all caught up</b>
          <span>Records, goals, milestones, congratulations and claim updates show up here.</span>
        </div>
      </div>

      <RouterLink class="bell-foot" :to="{ name: 'account', query: { tab: 'notifications' } }" @click="open = false">All notifications and settings</RouterLink>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { notificationsApi } from '@/api/notifications'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { usePlayersStore } from '@/stores/players'
import { bellTotal, foldRuns, loadSeen, noticeKind, saveSeen, sectionsByDay, seenNow } from '@/utils/noticeView'
import { refreshNotifications, useAuth } from '@/composables/useAuth'

const { notifications, user } = useAuth()
const router = useRouter()
const store = usePlayersStore()
const rootEl = ref(null)
const open = ref(false)
const loading = ref(false)
const inbox = ref([])

// Claim lines the site owner has already looked at no longer count towards the bell's red number.
const seen = ref(loadSeen(user.value?.id))
const total = computed(() => bellTotal(notifications.value, seen.value))
const unread = computed(() => inbox.value.filter((n) => !n.read).length)
const kind = noticeKind
// Runs of the same kind of notice (daily record notices, say) the person has opened up.
const openRuns = ref(new Set())
const sections = computed(() => sectionsByDay(foldRuns(inbox.value, openRuns.value)))
function toggleRun(key) {
  const next = new Set(openRuns.value)
  if (!next.delete(key)) next.add(key)
  openRuns.value = next
}

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  loading.value = true
  refreshNotifications().then(() => {
    if (!open.value) return
    seen.value = seenNow(notifications.value.items)
    saveSeen(user.value?.id, seen.value)
  })
  // Pictures come from the player list, so make sure it is loaded.
  if (!store.loaded) store.loadPlayers().catch(() => {})
  try {
    inbox.value = (await notificationsApi.inbox()).items
  } catch {
    inbox.value = []
  } finally {
    loading.value = false
  }
}

function ago(iso) {
  const mins = Math.max(Math.floor((Date.now() - new Date(iso).getTime()) / 60_000), 0)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

async function go(n) {
  open.value = false
  if (!n.read) {
    n.read = true
    try {
      await notificationsApi.markRead([n.id])
    } finally {
      refreshNotifications()
    }
  }
  if (n.link) router.push(n.link)
}

async function readOne(n) {
  n.read = true
  try {
    await notificationsApi.markRead([n.id])
  } finally {
    refreshNotifications()
  }
}

async function readAll() {
  inbox.value.forEach((n) => (n.read = true))
  try {
    await notificationsApi.markAllRead()
  } finally {
    refreshNotifications()
  }
}

const onDoc = (e) => {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('click', onDoc))
onBeforeUnmount(() => document.removeEventListener('click', onDoc))
</script>
