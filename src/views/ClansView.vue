<template>
  <div class="clan clans-hub">
    <header class="pgh">
      <div class="pgh-title">
        <h1>Clans</h1>
        <p class="pgh-sub">Team up with your clan or friends, run XP competitions, and see who is leading this week.</p>
      </div>
    </header>

    <PageSkeleton v-if="loading" kind="clans" />

    <template v-else>
      <!-- The directory: find, sort, browse -->
      <section class="cl-sec" aria-label="All clans">
        <div v-if="everyClan.length" class="clans-tools">
          <input v-model.trim="query" class="clans-search" type="search" placeholder="Find a clan" aria-label="Find a clan" autocomplete="off" data-1p-ignore />
          <div class="clans-sort" role="group" aria-label="Sort clans">
            <button v-for="o in SORTS" :key="o.key" type="button" class="clans-sort-btn" :class="{ on: sort === o.key }" :aria-pressed="sort === o.key" @click="sort = o.key">{{ o.label }}</button>
          </div>
          <button class="btn btn-primary clans-start" type="button" @click="startClan">Start a clan</button>
        </div>

        <div v-if="!everyClan.length" class="clans-empty">
          <p><b>No clans yet.</b> Start the first one and it shows up here for everyone.</p>
          <button class="btn btn-primary" type="button" @click="startClan">Start a clan</button>
        </div>
        <p v-else-if="!shown.length" class="dash-empty">No clan matches "{{ query }}".</p>

        <ul v-else class="clans-grid">
          <li v-for="c in shown" :key="c.slug"><ClanListCard :clan="c" /></li>
        </ul>
      </section>

      <!-- What a clan is -->
      <section class="cl-sec" aria-labelledby="clans-how-h">
        <header class="cl-sec-head"><h2 id="clans-how-h">How clans work</h2></header>
        <ol class="clans-how">
          <li><b>Start a clan</b><span>Sign in, name your clan and send the invite link. Anyone can ask to join with their RuneScape name, no account needed, and you approve each request.</span></li>
          <li><b>Run a competition</b><span>Pick a skill or overall XP and a start and end date. Everyone's gain is measured from a fresh hiscores check at the start.</span></li>
          <li><b>See who wins</b><span>A live leaderboard while it runs, and a result when it ends. Every clan shows up on this page.</span></li>
        </ol>
      </section>
    </template>

    <ClanCreateModal v-if="createOpen" @close="createOpen = false" />
  </div>
</template>

<script setup>
import PageSkeleton from '@/components/PageSkeleton.vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ClanListCard from '@/components/clans/ClanListCard.vue'
import ClanCreateModal from '@/components/clans/ClanCreateModal.vue'
import { clansApi } from '@/api/clans'
import { useAuth, waitForAuth } from '@/composables/useAuth'
import { setPageMeta } from '@/utils/pageMeta'

setPageMeta({ title: 'Clans', description: 'OSRS clans on TickGains: XP competitions, weekly leaders and who is on top. Start a clan and invite your friends.', path: '/clans' })

const { loggedIn } = useAuth()
const route = useRoute()
const router = useRouter()
const createOpen = ref(false)
// Starting a clan needs an account: signed out, sign in first and come back to this window.
function startClan() {
  if (loggedIn.value) createOpen.value = true
  else router.push({ name: 'login', query: { next: '/clans?new=1' } })
}
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
  // /clans?new=1 (and the old /clans/new address) opens the Start a clan window.
  if (route.query.new) {
    await waitForAuth()
    router.replace({ name: 'clans' })
    startClan()
  }
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
const shown = computed(() => {
  const q = query.value.toLowerCase()
  const list = everyClan.value.filter((c) => !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
  // The server sends them most active first; the other orders are applied here.
  if (sort.value === 'members') return [...list].sort((a, b) => b.memberCount - a.memberCount || b.weekGain - a.weekGain)
  if (sort.value === 'new') return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return list
})
</script>
