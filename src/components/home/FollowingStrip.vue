<template>
  <DashSkeleton v-if="shown && loading && !players.length" kind="following" />
  <section v-else-if="shown" class="card fol" aria-label="Players you follow">
    <header class="fol-head">
      <h2>Following</h2>
      <RouterLink class="fol-more" :to="{ name: 'compare' }">Compare players →</RouterLink>
    </header>

    <!-- A returning visitor (signed in or not): what changed for these players since they last looked -->
    <div v-if="since && !gotIt" class="fol-since">
      <div class="fol-since-head">
        <div class="fol-since-title">
          <b>Since you were last here</b>
          <small>{{ awayText(since.since) }}</small>
        </div>
        <button class="fol-since-x" type="button" aria-label="Dismiss" title="Dismiss" @click="gotIt = true">×</button>
      </div>
      <ul>
        <li v-for="r in since.rows.slice(0, 4)" :key="r.username">
          <RouterLink :to="{ name: 'playerDetail', params: { username: r.username } }">{{ r.displayName }}</RouterLink>
          <span v-if="r.gain" class="fol-since-gain">+{{ formatXp(r.gain) }} XP</span>
          <em v-for="m in r.milestones" :key="m">{{ m }}</em>
        </li>
      </ul>
    </div>

    <p v-if="!players.length" class="fol-empty">None of the players you follow have data yet.</p>

    <ul v-else class="fol-list">
      <li v-for="p in shownPlayers" :key="p.username">
        <RouterLink class="fol-card" :to="{ name: 'playerDetail', params: { username: p.username } }">
          <span class="cb-wrap"><span class="fol-avatar" aria-hidden="true"><PlayerAvatar :name="p.username" /></span><CombatBadge :level="p.combatLevel || 0" size="sm" /></span>
          <span class="fol-main">
            <span class="fol-name">{{ p.displayName }}<PlayerBadge :label="p.badge" :claimed="p.claimed" /></span>
            <small v-if="p.latest" class="fol-event">{{ p.latest.title }} · {{ ago(p.latest.at) }}</small>
            <small v-else-if="p.topSkill && p.weekGain" class="fol-event">Mostly {{ p.topSkill }} this week</small>
            <small v-else class="fol-event"><OverallLevel :level="p.overallLevel" empty="Overall ?" /></small>
          </span>
          <span class="fol-gain" :class="{ 'is-up': p.dayGain > 0 }">
            <b>{{ p.dayGain > 0 ? `+${formatXp(p.dayGain)}` : p.weekGain > 0 ? `+${formatXp(p.weekGain)}` : '-' }}</b>
            <small>{{ p.dayGain > 0 ? 'today' : p.weekGain > 0 ? 'this week' : 'no gain' }}</small>
          </span>
        </RouterLink>
      </li>
    </ul>
    <button v-if="players.length > LIMIT" class="btn-text fol-toggle" type="button" @click="showAll = !showAll">{{ showAll ? 'Show fewer' : `Show all ${players.length}` }}</button>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DashSkeleton from '@/components/dashboard/DashSkeleton.vue'
import CombatBadge from '@/components/CombatBadge.vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import OverallLevel from '@/components/OverallLevel.vue'
import PlayerBadge from '@/components/PlayerBadge.vue'
import { followsApi } from '@/api/follows'
import { useFollowing } from '@/composables/useFollowing'
import { formatXp } from '@/utils/osrsSkills'
import { awayText, readVisit, sinceLastVisit, writeVisit, xpMap } from '@/utils/lastVisit'

// The players you follow, with today's gain and their latest milestone. Hidden until you follow someone.
const { following } = useFollowing()
const players = ref([])
const events = ref([])
// Starts loading when there is anyone to load, so the skeleton shows from the first paint.
const loading = ref(following.value.length > 0)
const shown = computed(() => following.value.length > 0)
// Many follows would make a very long strip, so only the first few show until you ask for all.
const LIMIT = 6
const showAll = ref(false)
const shownPlayers = computed(() => (showAll.value ? players.value : players.value.slice(0, LIMIT)))

// What the visitor saw last time, read once when the page opens (before this visit overwrites it), so "since you were last here" is measured from then.
// The same baseline holds for the whole visit, even if the page is reloaded in it (the stored time moves on with every look).
const BASE_KEY = 'tickgains-visit-baseline'
function baseline() {
  try {
    const kept = JSON.parse(sessionStorage.getItem(BASE_KEY) || 'null')
    if (kept) return kept
    const fresh = readVisit()
    if (fresh) sessionStorage.setItem(BASE_KEY, JSON.stringify(fresh))
    return fresh
  } catch {
    return readVisit()
  }
}
const earlier = baseline()
const remember = (list) => {
  writeVisit({ at: Date.now(), xp: xpMap(list) })
}
const gotIt = ref(false)
const since = computed(() => sinceLastVisit(earlier, players.value, events.value))

let stamp = 0
// quiet: a refresh of what is already shown, so no loading state.
async function load({ quiet = false } = {}) {
  const names = following.value.slice(-200)
  if (!names.length) {
    players.value = []
    return
  }
  const id = ++stamp
  if (!quiet) loading.value = true
  try {
    const res = await followsApi.feed(names)
    if (id === stamp) {
      players.value = res.players
      events.value = res.events || []
      remember(res.players)
    }
  } catch {
    // The strip simply stays as it was.
  } finally {
    if (id === stamp) loading.value = false
  }
}
// The strip stays right while the page is open: the gains are read again every minute (and when the tab is shown again), so it never lags behind the
// figures on the rest of the site, which are read fresh each time.
const REFRESH_MS = 60_000
let refreshTimer = null
const refreshIfVisible = () => {
  if (document.visibilityState === 'visible' && following.value.length) load({ quiet: true })
}
onMounted(() => {
  load()
  refreshTimer = setInterval(refreshIfVisible, REFRESH_MS)
  document.addEventListener('visibilitychange', refreshIfVisible)
})
onBeforeUnmount(() => {
  clearInterval(refreshTimer)
  document.removeEventListener('visibilitychange', refreshIfVisible)
})
watch(() => following.value.join('|'), () => load())

function ago(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  return days === 1 ? 'yesterday' : `${days} days ago`
}
</script>
