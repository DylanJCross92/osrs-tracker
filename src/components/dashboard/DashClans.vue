<template>
  <section class="card dash-card dclan" aria-labelledby="dash-clans-h">
    <header class="dash-card-head">
      <h2 id="dash-clans-h">Active Clan Competitions<span v-if="allComps.length" class="dclan-count">{{ allComps.length }}</span></h2>
      <RouterLink class="dash-more" :to="{ name: clans.length ? 'myClans' : 'clans' }">{{ clans.length ? 'All my clans →' : 'Browse clans →' }}</RouterLink>
    </header>

    <p v-if="loading" class="dash-empty">Loading…</p>

    <div v-else-if="!clans.length" class="dclan-empty">
      <p class="dash-empty">Start a clan, or open an invite link from a friend, to race on XP together. Your rank in each competition shows up here.</p>
      <RouterLink class="btn btn-ghost" :to="{ name: 'clanNew' }">Start a clan</RouterLink>
    </div>

    <template v-else>
      <!-- People waiting to be let in -->
      <RouterLink v-for="c in waiting" :key="c.slug" class="dclan-alert" :to="{ name: 'clan', params: { slug: c.slug } }">
        <span class="dclan-alert-dot" aria-hidden="true" />
        <span><b>{{ c.pendingRequests }} join {{ c.pendingRequests === 1 ? 'request' : 'requests' }}</b> waiting in {{ c.name }}</span>
        <span class="dclan-alert-go">Answer →</span>
      </RouterLink>

      <!-- Competitions that are on or coming up, with where you stand -->
      <ul v-if="rows.length" class="dclan-comps">
        <li v-for="r in rows" :key="r.id">
          <RouterLink class="dclan-comp" :class="`is-${r.status}`" :to="{ name: 'competition', params: { id: r.id } }">
            <span class="dclan-ico" aria-hidden="true"><img :src="skillIconSrc(skillOf(r))" alt="" width="22" height="22" /></span>
            <span class="dclan-main">
              <b>{{ r.title }}</b>
              <small>{{ r.clanName }} · {{ clockText(r, now) }}</small>
            </span>
            <span v-if="r.my && !r.my.pending" class="dclan-rank" :class="{ 'is-first': r.my.rank === 1 }">
              <b>#{{ r.my.rank }}</b>
              <small>of {{ r.my.of }}<template v-if="r.my.gain > 0"> · +{{ formatXp(r.my.gain) }}</template></small>
            </span>
            <span v-else class="dclan-state" :class="`is-${r.status}`">{{ r.status === 'running' ? (r.my ? 'Waiting for a start' : 'Running') : 'Upcoming' }}</span>
          </RouterLink>
        </li>
      </ul>
      <p v-if="moreComps > 0" class="dclan-more"><RouterLink :to="{ name: 'myClans' }">{{ moreComps }} more {{ moreComps === 1 ? 'competition' : 'competitions' }} →</RouterLink></p>
      <p v-if="!rows.length" class="dash-empty">Nothing is running or coming up in your {{ clans.length === 1 ? 'clan' : 'clans' }} right now. Start a competition from a clan page.</p>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { clansApi } from '@/api/clans'
import { clockText } from '@/utils/competitionForm'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'

// The competitions that are on or coming up in your clans (with your rank in the running ones), plus join requests waiting
// for you. All of it comes from the same list as the My clans page.
const MAX_COMPS = 4

const clans = ref([])
const loading = ref(true)
const now = Date.now()

onMounted(async () => {
  try {
    clans.value = (await clansApi.mine()).clans
  } catch {
    clans.value = []
  } finally {
    loading.value = false
  }
})

const waiting = computed(() => clans.value.filter((c) => c.pendingRequests > 0))
const allComps = computed(() =>
  clans.value
    .flatMap((c) => c.competitions.map((k) => ({ ...k, clanName: c.name })))
    // Running ones first (the one ending soonest on top), then what starts next.
    .sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running') || (a.status === 'running' ? new Date(a.endsAt) - new Date(b.endsAt) : new Date(a.startsAt) - new Date(b.startsAt))),
)
const rows = computed(() => allComps.value.slice(0, MAX_COMPS))
const moreComps = computed(() => allComps.value.length - rows.value.length)
// The skill behind a label such as "Agility XP" (or "Overall XP"), for its icon.
const skillOf = (c) => String(c.label || '').replace(/ XP$/, '') || 'Overall'
</script>
