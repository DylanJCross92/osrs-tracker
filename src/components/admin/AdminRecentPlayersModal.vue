<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card adm-modal" role="dialog" aria-modal="true" aria-labelledby="adm-rp-h">
      <header class="share-modal-header">
        <div>
          <h2 id="adm-rp-h">Recently tracked players</h2>
          <p v-if="data" class="adm-sub">{{ data.total.toLocaleString('en-US') }} tracked in all, newest first</p>
        </div>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </header>

      <DailyPlayersChart v-if="daily" :days="daily" />
      <div v-else-if="!chartFailed" class="dpc dash-sk" aria-busy="true" aria-label="Loading the player chart"><div class="dxc-read"><b class="sk sk-w100">Mon, Jan 1</b></div><div class="sk dxc-sk" /></div>

      <p v-if="error" class="planner-error" role="alert">{{ error }}</p>
      <ul v-else-if="!data" class="adm-list" aria-busy="true" aria-label="Loading players">
        <li v-for="n in 6" :key="n" class="adm-row dash-sk" aria-hidden="true"><span class="sk adm-av" /><span class="adm-main"><b class="sk sk-w140">Player name</b><small class="sk sk-w100">Overall 2,376</small></span><span class="sk sk-w60">3h ago</span></li>
      </ul>
      <ul v-else class="adm-list">
        <li v-for="p in data.players" :key="p.username">
          <RouterLink class="adm-row" :to="{ name: 'playerDetail', params: { username: p.username } }" @click="$emit('close')">
            <span class="adm-av" aria-hidden="true"><PlayerAvatar :name="p.username" /></span>
            <span class="adm-main">
              <b><span class="adm-name">{{ p.displayName }}</span><PlayerBadge :label="p.badge" :claimed="p.claimed" /></b>
              <small>{{ p.level ? `Overall ${p.level.toLocaleString('en-US')} · ${formatXp(p.xp)} XP` : 'Not synced yet' }}</small>
            </span>
            <span class="adm-when" :title="new Date(p.trackedAt).toLocaleString()">{{ formatRelative(p.trackedAt) }}</span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import DailyPlayersChart from '@/components/admin/DailyPlayersChart.vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import PlayerBadge from '@/components/PlayerBadge.vue'
import { ApiError } from '@/api/client'
import { statsApi } from '@/api/stats'
import { formatXp } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'

// For admins: a chart of how many players are tracked each day, then the players added most recently. Opened from the player count on Discover.
const emit = defineEmits(['close'])
const data = ref(null)
const error = ref('')

// The day-by-day chart of how many players are tracked, above the list; if it cannot load, the list still shows.
const daily = ref(null)
const chartFailed = ref(false)
onMounted(async () => {
  statsApi
    .dailyPlayers(30)
    .then((res) => (daily.value = res.days))
    .catch(() => (chartFailed.value = true))
  try {
    data.value = await statsApi.recentPlayers(25)
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not load the players.'
  }
})

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
