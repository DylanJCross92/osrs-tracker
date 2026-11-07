<template>
  <div class="card">
    <h1>Discover Players</h1>
    <p class="planner-intro">Explore tracked Old School RuneScape players — recent 99s, the biggest XP gains, and players closing in on max.</p>
  </div>
  <div v-if="loading" class="card"><p class="empty-hint">Loading players…</p></div>
  <p v-else-if="error" class="card empty-hint">{{ error }}</p>
  <template v-else>
    <section v-for="sec in sections" :key="sec.key" class="discover-section" v-show="data[sec.key]?.length">
      <h2>{{ sec.title }}</h2>
      <div class="discover-grid">
        <RouterLink v-for="p in data[sec.key]" :key="p.id" :to="{ name: 'playerDetail', params: { username: p.username } }" class="card discover-card">
          <span class="discover-card-name">{{ p.displayName }}<PlayerBadge :label="p.badge" /></span>
          <span class="discover-card-stats">
            <span>Lvl {{ p.overallLevel?.toLocaleString() }}</span>
            <span>{{ formatXp(p.overallXp) }} XP</span>
            <span v-if="p.overallRank > 0">Rank {{ p.overallRank.toLocaleString() }}</span>
          </span>
          <span v-if="p.featured" class="discover-card-featured">
            <img v-if="p.featured.skill" :src="skillIconSrc(p.featured.skill)" :alt="p.featured.skill" width="16" height="16" />
            {{ p.featured.text }}
          </span>
        </RouterLink>
      </div>
    </section>
  </template>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import PlayerBadge from '@/components/PlayerBadge.vue'
import { playersApi } from '@/api/players'
import { setPageMeta } from '@/utils/pageMeta'
import { skillIconSrc, formatXp } from '@/utils/osrsSkills'

setPageMeta({
  title: 'Discover OSRS Players',
  description: 'Discover tracked Old School RuneScape players: recent 99s, top XP gains this week and month, and players closing in on max.',
  path: '/discover',
})

const sections = [
  { key: 'recent99', title: 'Recent level 99s' },
  { key: 'topWeek', title: 'Highest XP gains this week' },
  { key: 'topMonth', title: 'Highest XP gains this month' },
  { key: 'approachingMax', title: 'Approaching max level' },
  { key: 'recentlyTracked', title: 'Recently tracked' },
]
const data = ref({})
const loading = ref(true)
const error = ref('')
onMounted(async () => {
  try {
    data.value = await playersApi.discover()
  } catch {
    error.value = 'Could not load discovery right now.'
  } finally {
    loading.value = false
  }
})
</script>
