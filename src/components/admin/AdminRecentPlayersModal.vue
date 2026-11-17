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

      <p v-if="error" class="planner-error" role="alert">{{ error }}</p>
      <ul v-else-if="!data" class="adm-list" aria-busy="true" aria-label="Loading players">
        <li v-for="n in 8" :key="n" class="adm-row dash-sk" aria-hidden="true"><span class="sk adm-av" /><span class="adm-main"><b class="sk sk-w140">Player name</b><small class="sk sk-w100">Overall 2,277</small></span><span class="sk sk-w60">3h ago</span></li>
      </ul>
      <ul v-else class="adm-list">
        <li v-for="p in data.players" :key="p.username">
          <RouterLink class="adm-row" :to="{ name: 'playerDetail', params: { username: p.username } }" @click="$emit('close')">
            <span class="adm-av" aria-hidden="true"><PlayerAvatar :name="p.username" /></span>
            <span class="adm-main">
              <b>{{ p.displayName }}</b>
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
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { ApiError } from '@/api/client'
import { statsApi } from '@/api/stats'
import { formatXp } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'

// For admins: the players added to the tracker most recently, opened from the player count on Discover.
const emit = defineEmits(['close'])
const data = ref(null)
const error = ref('')

onMounted(async () => {
  try {
    data.value = await statsApi.recentPlayers(50)
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not load the players.'
  }
})

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
