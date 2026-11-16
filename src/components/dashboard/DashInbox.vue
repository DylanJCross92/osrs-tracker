<template>
  <DashSkeleton v-if="loading" kind="inbox" />
  <section v-else class="card dash-card" aria-labelledby="dash-inbox-h">
    <header class="dash-card-head">
      <h2 id="dash-inbox-h">Inbox<span v-if="unread" class="di-count" :aria-label="`${unread} unread`">{{ unread }}</span></h2>
      <RouterLink class="dash-more" :to="{ name: 'account', query: { tab: 'notifications' } }">See all →</RouterLink>
    </header>
    <p v-if="!items.length" class="dash-empty">You're all caught up. New followers, records and milestones from players you follow show up here.</p>
    <ul v-else class="di-list">
      <li v-for="n in items" :key="n.id">
        <a class="di-item" :class="{ 'is-unread': !n.read }" :href="n.link || undefined" @click.prevent="go(n)">
          <span class="di-av" aria-hidden="true">
            <PlayerAvatar v-if="n.subject" :name="n.subject" />
            <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0112 0c0 7 3 8.5 3 8.5H3S6 15 6 8" /><path d="M10.3 20a1.9 1.9 0 003.4 0" /></svg>
          </span>
          <span class="di-text">{{ n.text }}<small>{{ formatRelative(n.createdAt) }}</small></span>
        </a>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import DashSkeleton from '@/components/dashboard/DashSkeleton.vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { notificationsApi } from '@/api/notifications'
import { refreshNotifications } from '@/composables/useAuth'
import { formatRelative } from '@/utils/time'

// The three newest notices, the same ones as the bell. Opening one marks it read and goes where it points.
const router = useRouter()
const all = ref([])
const loading = ref(true)
const items = computed(() => all.value.slice(0, 3))
const unread = computed(() => all.value.filter((n) => !n.read).length)

onMounted(async () => {
  try {
    all.value = (await notificationsApi.inbox()).items
  } catch {
    all.value = []
  } finally {
    loading.value = false
  }
})

async function go(n) {
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
</script>
