<template>
  <div class="hub-stack">
    <section class="card hub-card">
      <div class="hub-card-head">
        <div>
          <h2>Notifications</h2>
          <p class="acc-note">Everything we have told you about, newest first.</p>
        </div>
        <button v-if="unread" class="btn btn-ghost" type="button" @click="readAll">Mark all read</button>
      </div>
      <p v-if="loading" class="acc-empty">Loading…</p>
      <p v-else-if="!items.length" class="acc-empty">Nothing yet. You will hear about records, goals, milestones and the players you follow.</p>
      <ul v-else class="hn-list">
        <li v-for="n in items" :key="n.id">
          <a class="hn-item" :class="{ unread: !n.read }" :href="n.link || undefined" @click.prevent="go(n)">
            <i class="bell-dot" aria-hidden="true" />
            <span class="hn-text">{{ n.text }}</span>
            <small>{{ formatRelative(n.createdAt) }}</small>
          </a>
        </li>
      </ul>
    </section>

    <section class="card hub-card">
      <div class="acc-title">
        <h2>Notification settings</h2>
        <span class="acc-status" :class="`is-${state}`" role="status">{{ stateText }}</span>
      </div>
      <p class="acc-note">Choose what you want to hear about. Claim updates always arrive.</p>
      <label v-for="g in GROUPS" :key="g.id" class="hn-pref">
        <input type="checkbox" :checked="!muted.includes(g.id)" :disabled="state === 'saving'" @change="toggle(g.id, $event.target.checked)" />
        <span><b>{{ g.label }}</b><small>{{ g.hint }}</small></span>
      </label>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '@/api/auth'
import { notificationsApi } from '@/api/notifications'
import { refreshNotifications, useAuth } from '@/composables/useAuth'
import { formatRelative } from '@/utils/time'

const emit = defineEmits(['unread'])
const router = useRouter()
const { user } = useAuth()

const GROUPS = [
  { id: 'records', label: 'My personal records', hint: 'One notice a day when you beat a record.' },
  { id: 'mine', label: 'My goals and milestones', hint: 'When you reach a goal you set, or a milestone like a new 99.' },
  { id: 'following', label: 'Players I follow', hint: 'When someone you follow reaches a goal or milestone.' },
  { id: 'social', label: 'Followers and challenges', hint: 'When someone follows you or accepts your challenge.' },
]

const items = ref([])
const loading = ref(true)
const unread = computed(() => items.value.filter((n) => !n.read).length)
onMounted(async () => {
  try {
    items.value = (await notificationsApi.inbox()).items
  } catch {
    items.value = []
  } finally {
    loading.value = false
    emit('unread', unread.value)
  }
})

async function go(n) {
  if (!n.read) {
    n.read = true
    emit('unread', unread.value)
    try {
      await notificationsApi.markRead([n.id])
    } finally {
      refreshNotifications()
    }
  }
  if (n.link) router.push(n.link)
}
async function readAll() {
  items.value.forEach((n) => (n.read = true))
  emit('unread', 0)
  try {
    await notificationsApi.markAllRead()
  } finally {
    refreshNotifications()
  }
}

// --- settings ---------------------------------------------------------------------------------------------------------
const muted = ref([...(user.value?.settings?.muteNotices || [])])
const state = ref('idle')
const stateText = computed(() => ({ idle: '', saving: 'Saving…', saved: 'Saved to your account', error: 'Could not save, check your connection' })[state.value])
async function toggle(id, on) {
  const before = [...muted.value]
  muted.value = on ? muted.value.filter((m) => m !== id) : [...muted.value, id]
  state.value = 'saving'
  try {
    await authApi.saveSettings({ muteNotices: muted.value })
    if (user.value) user.value.settings = { ...(user.value.settings || {}), muteNotices: [...muted.value] }
    state.value = 'saved'
  } catch {
    muted.value = before
    state.value = 'error'
  }
}
</script>
