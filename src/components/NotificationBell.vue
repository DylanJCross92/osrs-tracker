<template>
  <div ref="rootEl" class="bell">
    <button type="button" class="bell-btn" :aria-expanded="open" aria-haspopup="true" :aria-label="total > 0 ? `Notifications, ${total} new` : 'Notifications'" @click="toggle" @keydown.esc="open = false">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0112 0c0 7 3 8.5 3 8.5H3S6 15 6 8" /><path d="M10.3 20a1.9 1.9 0 003.4 0" /></svg>
      <span v-if="total > 0" class="acct-badge bell-badge" aria-hidden="true">{{ total > 9 ? '9+' : total }}</span>
    </button>

    <div v-if="open" class="bell-menu" role="dialog" aria-label="Notifications">
      <header class="bell-head">
        <b>Notifications</b>
        <button v-if="unread" class="btn-text" type="button" @click="readAll">Mark all read</button>
      </header>

      <div class="bell-scroll">
        <RouterLink v-for="n in notifications.items" :key="n.id" class="bell-item is-live" :to="n.to" @click="open = false">
          <i class="bell-dot" aria-hidden="true" />
          <span class="bell-text">{{ n.text }}</span>
        </RouterLink>

        <p v-if="loading && !inbox.length" class="bell-empty">Loading…</p>
        <a v-for="n in inbox" :key="n.id" class="bell-item" :class="{ 'is-unread': !n.read }" :href="n.link || undefined" @click.prevent="go(n)">
          <i class="bell-dot" aria-hidden="true" />
          <span class="bell-av" aria-hidden="true">
            <PlayerAvatar v-if="n.subject" :name="n.subject" />
            <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6" /><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" /></svg>
          </span>
          <span class="bell-text">{{ n.text }}<small>{{ ago(n.createdAt) }}</small></span>
        </a>

        <p v-if="!loading && !notifications.items.length && !inbox.length" class="bell-empty">You're all caught up. You will hear about claims, records and the players you follow.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { notificationsApi } from '@/api/notifications'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { usePlayersStore } from '@/stores/players'
import { refreshNotifications, useAuth } from '@/composables/useAuth'

const { notifications } = useAuth()
const router = useRouter()
const store = usePlayersStore()
const rootEl = ref(null)
const open = ref(false)
const loading = ref(false)
const inbox = ref([])

const total = computed(() => notifications.value.total)
const unread = computed(() => inbox.value.filter((n) => !n.read).length)

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  loading.value = true
  refreshNotifications()
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
