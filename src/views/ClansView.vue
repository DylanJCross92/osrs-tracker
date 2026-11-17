<template>
  <div class="clan clans-hub">
    <header class="card clan-head">
      <div class="clan-head-main">
        <h1>Clans</h1>
        <p class="clan-desc">Team up with your clan or friends, run XP competitions, and see who is leading this week.</p>
      </div>
      <div class="clan-head-actions">
        <RouterLink v-if="loggedIn" class="btn btn-ghost" :to="{ name: 'myClans' }">My clans</RouterLink>
        <RouterLink class="btn btn-primary" :to="loggedIn ? { name: 'clanNew' } : { name: 'login', query: { next: '/clans/new' } }">Start a clan</RouterLink>
      </div>
    </header>

    <PageSkeleton v-if="loading" kind="clans" />

    <template v-else>
      <!-- Clans that were started recently -->
      <section v-if="fresh.length" class="card clan-card" aria-labelledby="clans-new-h">
        <header class="dash-card-head"><h2 id="clans-new-h">New clans</h2><span class="dash-hint">recently started</span></header>
        <ul class="clans-grid">
          <li v-for="c in fresh" :key="c.slug"><ClanListCard :clan="c" /></li>
        </ul>
      </section>

      <!-- The directory -->
      <section class="card clan-card" aria-labelledby="clans-dir-h">
        <header class="dash-card-head">
          <h2 id="clans-dir-h">All clans</h2>
          <div class="clans-tools">
            <div class="clans-sort" role="group" aria-label="Sort clans">
              <button v-for="o in SORTS" :key="o.key" type="button" class="clans-sort-btn" :class="{ on: sort === o.key }" :aria-pressed="sort === o.key" @click="sort = o.key">{{ o.label }}</button>
            </div>
            <input v-model.trim="query" class="clans-search" type="search" placeholder="Find a clan" aria-label="Find a clan" autocomplete="off" data-1p-ignore />
          </div>
        </header>

        <div v-if="!everyClan.length" class="clans-empty">
          <p><b>No clans yet.</b> Start the first one and it shows up here for everyone.</p>
          <RouterLink class="btn btn-primary" :to="loggedIn ? { name: 'clanNew' } : { name: 'login', query: { next: '/clans/new' } }">Start a clan</RouterLink>
        </div>
        <p v-else-if="!shown.length" class="dash-empty">No clan matches "{{ query }}".</p>

        <ul v-else class="clans-grid">
          <li v-for="c in shown" :key="c.slug"><ClanListCard :clan="c" /></li>
        </ul>
      </section>

      <!-- What a clan is -->
      <section class="card clan-card" aria-labelledby="clans-how-h">
        <h2 id="clans-how-h">How clans work</h2>
        <ol class="clans-how">
          <li><b>Start a clan</b><span>Sign in, name your clan and send the invite link. Anyone can ask to join with their RuneScape name, no account needed, and you approve each request.</span></li>
          <li><b>Run a competition</b><span>Pick a skill or overall XP and a start and end date. Everyone's gain is measured from a fresh hiscores check at the start.</span></li>
          <li><b>See who wins</b><span>A live leaderboard while it runs, and a result when it ends. Every clan shows up on this page.</span></li>
        </ol>
      </section>
    </template>
  </div>
</template>

<script setup>
import PageSkeleton from '@/components/PageSkeleton.vue'
import { computed, onMounted, ref } from 'vue'
import ClanListCard from '@/components/clans/ClanListCard.vue'
import { clansApi } from '@/api/clans'
import { useAuth } from '@/composables/useAuth'
import { setPageMeta } from '@/utils/pageMeta'

setPageMeta({ title: 'Clans', description: 'OSRS clans on TickGains: XP competitions, weekly leaders and who is on top. Start a clan and invite your friends.', path: '/clans' })

const FRESH_SHOWN = 4

const { loggedIn } = useAuth()
const data = ref(null)
const mine = ref([])
const loading = ref(true)

const SORTS = [
  { key: 'active', label: 'Most active' },
  { key: 'members', label: 'Biggest' },
  { key: 'new', label: 'Newest' },
]
const sort = ref('active')
const query = ref('')

onMounted(async () => {
  const [list, own] = await Promise.allSettled([clansApi.list(), loggedIn.value ? clansApi.mine() : Promise.resolve({ clans: [] })])
  data.value = list.status === 'fulfilled' ? list.value : null
  mine.value = own.status === 'fulfilled' ? own.value.clans : []
  loading.value = false
})

// Every clan, with your own marked as yours.
const everyClan = computed(() => {
  const mineBySlug = new Map(mine.value.map((c) => [c.slug, c]))
  const list = (data.value?.clans || []).map((c) => (mineBySlug.has(c.slug) ? mineBySlug.get(c.slug) : c))
  const listed = new Set(list.map((c) => c.slug))
  return [...list, ...mine.value.filter((c) => !listed.has(c.slug))]
})
const byNewest = computed(() => [...everyClan.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
// New clans only get their own list when there are more clans than it would show, so the two lists are never the same.
const fresh = computed(() => (byNewest.value.length > FRESH_SHOWN ? byNewest.value.slice(0, FRESH_SHOWN) : []))

const shown = computed(() => {
  const q = query.value.toLowerCase()
  const list = everyClan.value.filter((c) => !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
  // The server sends them most active first; the other orders are applied here.
  if (sort.value === 'members') return [...list].sort((a, b) => b.memberCount - a.memberCount || b.weekGain - a.weekGain)
  if (sort.value === 'new') return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return list
})
</script>
