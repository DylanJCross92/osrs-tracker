<template>
  <section v-if="shown" class="card fol" aria-label="Players you follow">
    <header class="fol-head">
      <h2>Following</h2>
      <RouterLink class="fol-more" :to="{ name: 'compare' }">Compare players →</RouterLink>
    </header>

    <p v-if="loading && !players.length" class="fol-empty">Loading…</p>
    <p v-else-if="!players.length" class="fol-empty">None of the players you follow have data yet.</p>

    <ul v-else class="fol-list">
      <li v-for="p in players" :key="p.username">
        <RouterLink class="fol-card" :to="{ name: 'playerDetail', params: { username: p.username } }">
          <span class="fol-avatar" aria-hidden="true"><PlayerAvatar :name="p.username" /></span>
          <span class="fol-main">
            <span class="fol-name">{{ p.displayName }}<PlayerBadge :label="p.badge" :claimed="p.claimed" /></span>
            <small v-if="p.latest" class="fol-event">{{ p.latest.title }} · {{ ago(p.latest.at) }}</small>
            <small v-else-if="p.topSkill && p.weekGain" class="fol-event">Mostly {{ p.topSkill }} this week</small>
            <small v-else class="fol-event">Level {{ p.overallLevel?.toLocaleString('en-US') ?? '?' }}</small>
          </span>
          <span class="fol-gain" :class="{ 'is-up': p.dayGain > 0 }">
            <b>{{ p.dayGain > 0 ? `+${formatXp(p.dayGain)}` : p.weekGain > 0 ? `+${formatXp(p.weekGain)}` : '-' }}</b>
            <small>{{ p.dayGain > 0 ? 'today' : p.weekGain > 0 ? 'this week' : 'no gain' }}</small>
          </span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import PlayerBadge from '@/components/PlayerBadge.vue'
import { followsApi } from '@/api/follows'
import { useFollowing } from '@/composables/useFollowing'
import { formatXp } from '@/utils/osrsSkills'

// The players you follow, with today's gain and their latest milestone. Hidden until you follow someone.
const { following } = useFollowing()
const players = ref([])
const loading = ref(false)
const shown = computed(() => following.value.length > 0)

let stamp = 0
async function load() {
  const names = [...following.value]
  if (!names.length) {
    players.value = []
    return
  }
  const id = ++stamp
  loading.value = true
  try {
    const res = await followsApi.feed(names)
    if (id === stamp) players.value = res.players
  } catch {
    // The strip simply stays as it was.
  } finally {
    if (id === stamp) loading.value = false
  }
}
onMounted(load)
watch(() => following.value.join('|'), load)

function ago(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  return days === 1 ? 'yesterday' : `${days} days ago`
}
</script>
