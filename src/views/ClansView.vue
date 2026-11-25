<template>
  <div class="clan clans-hub cn">
    <!-- The same kind of opening as the home page and the GE prices: a title, one line, and the two things you can do -->
    <section class="gxh-hero cn-hero">
      <p class="gxh-eyebrow">OSRS clans and competitions</p>
      <h1>Clans</h1>
      <p class="gxh-tag">Team up with your clan or friends, race for the most XP and see who leads this week.</p>
      <div class="cn-cta">
        <button class="btn btn-primary" type="button" @click="toRace">{{ inRace ? 'See this week\'s race' : 'Join this week\'s race' }}</button>
        <button class="btn btn-ghost" type="button" @click="startClan">Start a clan</button>
      </div>
    </section>

    <div v-if="loading" class="cn-loading" aria-busy="true" aria-label="Loading the clans">
      <div class="cn-stage cn-sk"><span class="sk sk-w200 sk-tall">Weekly race</span><span class="sk sk-w140">Placeholder</span></div>
      <ul class="cn-list"><li v-for="n in 3" :key="n" class="cn-row cn-sk-row"><span class="sk sk-w200">Clan name</span><span class="sk sk-w140">Stats</span></li></ul>
    </div>

    <template v-else>
      <!-- The site's own weekly race: the one featured thing, and a way to join in one step -->
      <ClanWeekly v-if="weekly" :weekly="weekly" @joined="reload(true)" />

      <!-- Player clans -->
      <section class="cn-dir" aria-labelledby="cn-dir-h">
        <header class="cn-dir-head">
          <div>
            <h2 id="cn-dir-h">Player clans</h2>
            <p v-if="directory.length" class="cn-dir-sub">{{ directory.length }} {{ directory.length === 1 ? 'clan' : 'clans' }}, each with its own competitions</p>
          </div>
          <div v-if="directory.length" class="cn-tools">
            <input v-model.trim="query" class="clans-search" type="search" placeholder="Find a clan" aria-label="Find a clan" autocomplete="off" data-1p-ignore />
            <div class="clans-sort" role="group" aria-label="Sort clans">
              <button v-for="o in SORTS" :key="o.key" type="button" class="clans-sort-btn" :class="{ on: sort === o.key }" :aria-pressed="sort === o.key" @click="sort = o.key">{{ o.label }}</button>
            </div>
          </div>
        </header>

        <div v-if="!directory.length" class="cn-empty">
          <p><b>No player clans yet.</b> Start the first one and it shows up here for everyone, with its own competitions.</p>
          <button class="btn btn-primary" type="button" @click="startClan">Start a clan</button>
        </div>
        <p v-else-if="!shown.length" class="dash-empty">No clan matches "{{ query }}".</p>
        <ul v-else class="cn-list">
          <li v-for="c in shown" :key="c.slug"><ClanRow :clan="c" /></li>
        </ul>
      </section>

      <!-- What a clan is: three plain steps -->
      <section class="cn-how" aria-labelledby="cn-how-h">
        <h2 id="cn-how-h">How clans work</h2>
        <ol>
          <li><b>Start a clan</b><span>Sign in, name it and send the invite link. Anyone can ask to join from the clan page or the link, with their RuneScape name, and you approve each request.</span></li>
          <li><b>Run a competition</b><span>Pick a skill or overall XP and a start and end date. Everyone's gain is measured from a fresh hiscores check at the start.</span></li>
          <li><b>See who wins</b><span>A live leaderboard while it runs, and a result when it ends. Every clan is listed on this page.</span></li>
        </ol>
      </section>
    </template>

    <ClanCreateModal v-if="createOpen" @close="createOpen = false" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ClanRow from '@/components/clans/ClanRow.vue'
import ClanWeekly from '@/components/clans/ClanWeekly.vue'
import ClanCreateModal from '@/components/clans/ClanCreateModal.vue'
import { clansApi } from '@/api/clans'
import { useAuth, waitForAuth } from '@/composables/useAuth'
import { useTrackerPlayer } from '@/composables/useTrackerPlayer'
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
const weekly = ref(null)
const mine = ref([])
const loading = ref(true)

// The player loaded on this page (the visitor's own, once they have said who they are) is already racing: the button then says to look, not to join.
const { player: racer } = useTrackerPlayer()
const inRace = computed(() => Boolean(racer.value && (weekly.value?.members || []).includes(racer.value.username.toLowerCase())))

// The hero's first button scrolls to the race panel (which is also where the join box is).
function toRace() {
  document.getElementById('race')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

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
  await reload()
  loading.value = false
})

// The directory, the weekly race and your own clans. Run again after joining the race, so the board and the member counts are current.
async function reload(fresh = false) {
  const [list, own, race] = await Promise.allSettled([clansApi.list(fresh), loggedIn.value ? clansApi.mine() : Promise.resolve({ clans: [] }), clansApi.weekly(fresh)])
  data.value = list.status === 'fulfilled' ? list.value : data.value
  mine.value = own.status === 'fulfilled' ? own.value.clans : mine.value
  weekly.value = race.status === 'fulfilled' ? race.value.weekly : weekly.value
}

// Every clan, with your own marked as yours.
const everyClan = computed(() => {
  const mineBySlug = new Map(mine.value.map((c) => [c.slug, c]))
  const list = (data.value?.clans || []).map((c) => (mineBySlug.has(c.slug) ? mineBySlug.get(c.slug) : c))
  const listed = new Set(list.map((c) => c.slug))
  return [...list, ...mine.value.filter((c) => !listed.has(c.slug))]
})
// The weekly race has its own place at the top, so it is not listed again here.
const directory = computed(() => everyClan.value.filter((c) => !c.official))
const shown = computed(() => {
  const q = query.value.toLowerCase()
  const list = directory.value.filter((c) => !q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
  // The server sends them most active first; the other orders are applied here.
  if (sort.value === 'members') return [...list].sort((a, b) => b.memberCount - a.memberCount || b.weekGain - a.weekGain)
  if (sort.value === 'new') return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return list
})
</script>
