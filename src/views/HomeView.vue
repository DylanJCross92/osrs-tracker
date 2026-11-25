<template>
  <div class="home">
    <!-- 1. Hero and username search -->
    <section class="home-hero" id="start">
      <h1>Track your gains. <span class="home-accent">Plan your next 99.</span></h1>
      <p class="home-sub">The free OSRS XP tracker, Account Planner and live GE prices, in one place.</p>

      <div class="suggest-wrap home-suggest-wrap">
        <form class="home-search" autocomplete="off" @submit.prevent="submitAdd">
          <input
            ref="searchInput"
            v-model="newUsername"
            type="search"
            placeholder="Enter your OSRS name"
            :disabled="adding"
            autocomplete="off"
            maxlength="12"
            name="osrs-player-lookup" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"
            aria-label="OSRS player name"
            data-1p-ignore
            data-lpignore="true"
            @focus="searchFocused = true"
            @blur="searchFocused = false"
          />
          <button class="btn btn-primary" type="submit" :disabled="adding || !newUsername.trim()">{{ adding ? 'Adding…' : 'Track Player' }}</button>
        </form>
        <RecentPlayers v-if="searchFocused && !newUsername.trim()" class="home-suggest" @pick="openRecent" />
        <ul v-if="suggestions.length" class="search-suggest home-suggest">
          <li class="suggest-head">Already tracked</li>
          <li v-for="sg in suggestions" :key="sg.username">
            <RouterLink class="suggest-row" :to="{ name: 'playerDetail', params: { username: sg.username } }" @click="track('search_suggestion_selected', { source: 'home' }); recordRecent(sg)">
              <PlayerSuggestRow :player="sg" />
            </RouterLink>
          </li>
        </ul>
      </div>

      <div v-if="trackedPlayer" class="home-tracked">
        <span><span class="check-icon">✓</span> Now tracking <b>{{ trackedPlayer.displayName }}</b></span>
        <span v-if="importing" class="home-import"><span class="spinner" /> Importing history from Wise Old Man…</span>
        <span v-else class="home-import done">History check complete</span>
        <RouterLink :to="{ name: 'playerDetail', params: { username: trackedPlayer.username } }" class="btn btn-ghost">View profile →</RouterLink>
      </div>

      <p class="hm-hero-links">
        <RouterLink :to="{ name: 'planner' }" @click="track('home_hero_link', { target: 'planner' })">Explore Account Planner <span aria-hidden="true">→</span></RouterLink>
        <RouterLink :to="{ name: 'items' }" @click="track('home_hero_link', { target: 'prices' })">Browse GE Prices <span aria-hidden="true">→</span></RouterLink>
        <RouterLink :to="{ name: 'quests' }" @click="track('home_hero_link', { target: 'quests' })">Track Quests &amp; Diaries <span aria-hidden="true">→</span></RouterLink>
      </p>
      <p class="home-nosignup">No sign-up needed to start. A <RouterLink :to="{ name: 'signup' }" @click="track('sign_up_click', { where: 'hero' })">free account</RouterLink> saves your plans, goals and alerts.</p>
    </section>

    <!-- Live community ticker -->
    <section v-if="liveEvents.length" class="home-live" aria-label="Live community activity">
      <div class="home-live-head">
        <span class="disc-live-dot" />
        <b>Live from the community</b>
        <RouterLink to="/discover" class="home-live-more" @click="track('home_view_discover')">See all activity →</RouterLink>
      </div>
      <div class="home-live-viewport">
        <div class="home-live-track" :style="{ '--dur': `${liveEvents.length * 14}s` }">
          <TransitionGroup name="live" tag="ul" class="home-live-list">
            <li v-for="e in liveEvents" :key="e.id" :class="['home-live-item', `kind-${e.kind}`, { 'is-new': newLive.has(e.id) }]">
              <RouterLink :to="{ name: 'playerDetail', params: { username: e.username } }">
                <span class="disc-event-icon">
                  <img v-if="e.skill" :src="skillIconSrc(e.skill)" :alt="e.skill" width="24" height="24" />
                  <span v-else-if="e.kind === 'gain'" class="disc-glyph">▲</span>
                  <span v-else class="disc-glyph">★</span>
                </span>
                <span class="disc-event-text">
                  <b>{{ e.displayName }}</b>
                  <template v-if="e.kind === 'max'"> hit <em class="gold">level 99 {{ e.skill }}</em></template>
                  <template v-else-if="e.kind === 'levelup'"> reached <em>{{ e.skill }} level {{ e.to }}</em></template>
                  <template v-else-if="e.kind === 'gain'"> gained <em class="stat-gain">+{{ formatXp(e.xp) }} XP</em></template>
                  <template v-else> unlocked <em class="gold">{{ e.title }}</em></template>
                </span>
                <CheerPill v-if="e.cheer" :player-id="e.playerId" :skill="e.skill || ''" :type="e.cheer.type" :value="e.cheer.value" :count="e.cheer.count || 0" />
                <span class="disc-event-time">{{ agoText(e.at) }}</span>
              </RouterLink>
            </li>
          </TransitionGroup>
          <!-- Second copy makes the slow scroll loop seamlessly. -->
          <ul class="home-live-list" aria-hidden="true">
            <li v-for="e in liveEvents" :key="e.id" :class="['home-live-item', `kind-${e.kind}`]">
              <RouterLink :to="{ name: 'playerDetail', params: { username: e.username } }" tabindex="-1">
                <span class="disc-event-icon">
                  <img v-if="e.skill" :src="skillIconSrc(e.skill)" alt="" width="24" height="24" />
                  <span v-else-if="e.kind === 'gain'" class="disc-glyph">▲</span>
                  <span v-else class="disc-glyph">★</span>
                </span>
                <span class="disc-event-text">
                  <b>{{ e.displayName }}</b>
                  <template v-if="e.kind === 'max'"> hit <em class="gold">level 99 {{ e.skill }}</em></template>
                  <template v-else-if="e.kind === 'levelup'"> reached <em>{{ e.skill }} level {{ e.to }}</em></template>
                  <template v-else-if="e.kind === 'gain'"> gained <em class="stat-gain">+{{ formatXp(e.xp) }} XP</em></template>
                  <template v-else> unlocked <em class="gold">{{ e.title }}</em></template>
                </span>
                <CheerPill v-if="e.cheer" inert :player-id="e.playerId" :skill="e.skill || ''" :type="e.cheer.type" :value="e.cheer.value" :count="e.cheer.count || 0" />
                <span class="disc-event-time">{{ agoText(e.at) }}</span>
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <FollowingStrip />

    <!-- The three main features, as tabs with a small live preview -->
    <HomePreview :example="example" :chart-points="chartPoints" :loading="loading" />


    <!-- 5. The other tools, compact -->
    <section class="home-section" aria-label="More tools">
      <h2 class="hm-h2">More tools</h2>
      <ul class="hm-tools">
        <li v-for="f in tools" :key="f.key">
          <RouterLink :to="f.to" @click="track('home_feature', { feature: f.key })">
            <span class="hm-tool-ico" v-html="f.icon" />
            <span><b>{{ f.title }}</b><small>{{ f.text }}</small></span>
          </RouterLink>
        </li>
      </ul>
    </section>

    <!-- 6. Community activity: what people are gaining and finishing, not how many there are -->
    <section class="home-section" aria-label="Community activity">
      <div class="home-community-head">
        <h2 class="hm-h2">Community activity</h2>
        <span v-if="community?.xpToday || community?.xpWeek" class="hm-xp-today"><b class="stat-gain">+{{ formatXp(community.xpToday || community.xpWeek) }} XP</b> gained {{ community.xpToday ? 'today' : 'this week' }}</span>
        <RouterLink to="/discover" class="hm-more" @click="track('home_view_discover')">View Discover →</RouterLink>
      </div>
      <PageSkeleton v-if="loading" kind="home-community" />
      <p v-else-if="error" class="empty-hint">Community activity isn't available right now.</p>
      <div v-else-if="community" class="hm-community">
        <div>
          <h3>Top gainers {{ community.gainersPeriod === 'day' ? 'today' : 'this week' }}</h3>
          <ol v-if="community.topGainers.length" class="hm-list">
            <li v-for="(g, i) in community.topGainers" :key="g.username">
              <RouterLink :to="{ name: 'playerDetail', params: { username: g.username } }">
                <span class="disc-rank" :class="`r${i + 1}`">{{ i + 1 }}</span>
                <span class="hm-list-name">{{ g.displayName }}<PlayerBadge :label="g.badge" :claimed="g.claimed" /></span>
                <span class="stat-gain">+{{ formatXp(g.xp) }}</span>
              </RouterLink>
            </li>
          </ol>
          <p v-else class="empty-hint">No XP gained yet, check back after the next update.</p>
        </div>
        <div>
          <h3>Recent achievements</h3>
          <ul v-if="community.recentMilestones.length" class="hm-list">
            <li v-for="m in community.recentMilestones" :key="m.key">
              <RouterLink :to="{ name: 'playerDetail', params: { username: m.username } }">
                <img v-if="m.skill" :src="skillIconSrc(m.skill)" :alt="m.skill" width="22" height="22" />
                <span v-else class="disc-glyph">★</span>
                <span class="hm-list-name"><b>{{ m.displayName }}</b> {{ m.title }}</span>
                <small>{{ formatRelative(m.detectedAt) }}</small>
              </RouterLink>
            </li>
          </ul>
          <p v-else class="empty-hint">99s, 100M XP and other big moments appear here as they are detected.</p>
        </div>
        <div>
          <h3>Active competitions</h3>
          <ul v-if="competitions.length" class="hm-list">
            <li v-for="c in competitions" :key="c.id">
              <RouterLink :to="{ name: 'competition', params: { id: c.id } }" @click="track('home_competition')">
                <img v-if="c.skill" :src="skillIconSrc(c.skill)" :alt="c.skill" width="22" height="22" />
                <span v-else class="disc-glyph">★</span>
                <span class="hm-list-name"><b>{{ c.title }}</b> <small>{{ c.clan.name }} · {{ c.entrants }} {{ c.entrants === 1 ? 'player' : 'players' }}</small></span>
                <small>{{ competitionTime(c) }}</small>
              </RouterLink>
            </li>
          </ul>
          <p v-else class="empty-hint">None running right now. <RouterLink to="/clans">Start one with your clan</RouterLink>.</p>
        </div>
      </div>
    </section>

    <!-- 7. How it works -->
    <section id="how-it-works" class="home-section" aria-label="How it works">
      <h2 class="hm-h2">How it works</h2>
      <ol class="hm-steps">
        <li v-for="(s, i) in steps" :key="s.title">
          <span class="hm-step-n">{{ i + 1 }}</span>
          <span><b>{{ s.title }}</b><small>{{ s.text }}</small></span>
        </li>
      </ol>
    </section>

    <!-- 8. Free account benefits -->
    <section class="home-section home-account" aria-label="Free account">
      <div class="home-account-copy">
        <h2>Make it yours with a free account</h2>
        <p>Tracking a player never needs one. An account keeps what you build and tells you what to do next.</p>
        <div class="home-account-actions">
          <RouterLink class="btn btn-primary" :to="{ name: 'signup' }" @click="track('sign_up_click', { where: 'home_band' })">Create free account</RouterLink>
          <RouterLink class="btn btn-ghost" :to="{ name: 'login' }">Log in</RouterLink>
        </div>
      </div>
      <ul class="home-account-list">
        <li v-for="b in accountBenefits" :key="b.title">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          <span><b>{{ b.title }}</b> {{ b.text }}</span>
        </li>
      </ul>
    </section>

    <!-- 9. Final CTA (the footer carries the email sign-up) -->
    <section class="home-final" aria-label="Get started">
      <h2>Ready to track your next 99?</h2>
      <div class="home-final-actions">
        <button class="btn btn-primary" type="button" @click="focusSearch">Track a player</button>
        <RouterLink class="btn btn-ghost" :to="{ name: 'signup' }" @click="track('sign_up_click', { where: 'home_final' })">Create free account</RouterLink>
      </div>
    </section>
  </div>
</template>

<script setup>
import PageSkeleton from '@/components/PageSkeleton.vue'
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayersStore } from '@/stores/players'
import { useToast } from '@/composables/useToast'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'
import { ApiError } from '@/api/client'
import { setPageMeta } from '@/utils/pageMeta'
import PlayerBadge from '@/components/PlayerBadge.vue'
import FollowingStrip from '@/components/home/FollowingStrip.vue'
import PlayerSuggestRow from '@/components/PlayerSuggestRow.vue'
import RecentPlayers from '@/components/RecentPlayers.vue'
import { recordRecent } from '@/composables/useRecentPlayers'
import { playersApi } from '@/api/players'
import { api } from '@/api/client'
import { track } from '@/utils/analytics'
import CheerPill from '@/components/CheerPill.vue'
import HomePreview from '@/components/home/HomePreview.vue'

const router = useRouter()
const store = usePlayersStore()
const { showToast } = useToast()

setPageMeta({
  title: 'OSRS XP Tracker & Hiscores History',
  description:
    'Free OSRS XP tracker: hourly updates, XP gains and hiscores history for any player, no sign-up. Plan your next 99 with the Account Planner.',
  path: '/',
})

const searchInput = ref(null)
const newUsername = ref('')
const adding = ref(false)
const trackedName = ref('')

// --- community + example data (one cached request; never waits on player updates) ---
const home = ref(null)
const loading = ref(true)
const error = ref(false)
const now = ref(Date.now())
const newLive = ref(new Set())
let seenLive = null
let pollTimer = null
let tickTimer = null
async function loadHome(initial = false) {
  try {
    const fresh = await api.get('/home')
    // Anything not seen on the previous poll slides in at the top with a glow.
    const ids = new Set((fresh.activity || []).map((e) => e.id))
    if (seenLive) newLive.value = new Set([...ids].filter((id) => !seenLive.has(id)))
    seenLive = ids
    home.value = fresh
    error.value = false
    if (newLive.value.size) setTimeout(() => (newLive.value = new Set()), 4000)
  } catch {
    if (initial) error.value = true
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  // The search box is the point of the page, so it is ready to type in. Not on touch screens, where it would raise the keyboard
  // and cover the page before anyone has looked at it.
  if (!window.matchMedia?.('(pointer: coarse)').matches) searchInput.value?.focus({ preventScroll: true })
  loadHome(true)
  // Poll while the tab is visible so the ticker keeps moving as people level up.
  pollTimer = setInterval(() => !document.hidden && loadHome(), 45_000)
  tickTimer = setInterval(() => (now.value = Date.now()), 30_000)
})
onBeforeUnmount(() => {
  clearInterval(pollTimer)
  clearInterval(tickTimer)
})
const liveEvents = computed(() => (home.value?.activity || []).slice(0, 10))
const agoText = (iso) => {
  void now.value
  return iso ? formatRelative(iso) : ''
}
const community = computed(() => home.value?.community || null)
const competitions = computed(() => community.value?.competitions || [])
// "ends in 3 d", "starts in 5 h": how long until a competition starts or ends.
function competitionTime(c) {
  void now.value
  const running = c.status === 'running'
  const ms = new Date(running ? c.endsAt : c.startsAt).getTime() - Date.now()
  const h = Math.max(1, Math.round(ms / 3_600_000))
  const span = h >= 48 ? `${Math.round(h / 24)} d` : `${h} h`
  return `${running ? 'ends in' : 'starts in'} ${span}`
}
const example = computed(() => home.value?.example || null)
const chartPoints = computed(() => (example.value?.series || []).map((p) => ({ x: p.t, y: p.xp })))

// --- features / steps ---
const exampleTo = (tab) =>
  example.value ? { name: 'playerDetail', params: { username: example.value.username }, query: tab ? { tab } : {} } : { path: '/discover' }
const svg = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
// The three main features live in HomePreview; these are the rest, in a compact list.
const tools = computed(() => [
  { key: 'tracker', title: 'Quest & Diary Tracker', text: 'Tick off what you have done; plans skip it.', to: { name: 'quests' }, icon: svg('<path d="M9 6h11M9 12h11M9 18h11" /><path d="M3.5 6l1.2 1.2L7 4.8M3.5 12l1.2 1.2L7 10.8M3.5 18l1.2 1.2L7 16.8" />') },
  { key: 'calculators', title: 'Skill Calculators', text: 'XP, time and gp for every skill.', to: { path: '/calculators' }, icon: svg('<rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h2M12 11h2M8 15h2M12 15h2" />') },
  { key: 'history', title: 'Historical XP', text: 'Imported Wise Old Man history.', to: exampleTo('history'), icon: svg('<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />') },
  { key: 'discover', title: 'Player Discovery', text: 'Leaderboards and recent activity.', to: { path: '/discover' }, icon: svg('<circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />') },
  { key: 'clans', title: 'Clans & Competitions', text: 'Run XP competitions with live boards.', to: { path: '/clans' }, icon: svg('<circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.6" /><path d="M17 14c2.8 0 5 2.2 5 5" />') },
  { key: 'compare', title: 'Compare Players', text: 'Side by side, skill by skill.', to: { path: '/compare' }, icon: svg('<path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" />') },
])
const accountBenefits = [
  { title: 'Plans and goals that stay.', text: 'Save them once and they follow you to any device.' },
  { title: 'Follow players.', text: 'Get told when a friend hits a new 99.' },
  { title: 'A dashboard for what is next.', text: 'Built from your own levels, plan and quests.' },
  { title: 'Your own profile.', text: 'Claim your RuneScape name to make it yours.' },
]
const steps = [
  { title: 'Enter your RSN', text: 'Search for your OSRS character.' },
  { title: 'Tracked automatically', text: 'Snapshots every hour (daily when inactive), plus imported history.' },
  { title: 'Explore and plan', text: 'Charts, milestones, and a plan for your next goal.' },
]

// --- tracking (unchanged behaviour) ---
const trackedPlayer = computed(() => (trackedName.value ? store.players.find((p) => p.username.toLowerCase() === trackedName.value.toLowerCase()) : null))
const importing = computed(() => ['pending', 'running'].includes(trackedPlayer.value?.womImportStatus))

async function submitAdd() {
  const username = newUsername.value.trim()
  if (!username) return
  adding.value = true
  track('player_search', { player: username, source: 'home', username_length: username.length })
  try {
    await store.addPlayer(username)
    // A 201 from the API means this name was not tracked on the site before.
    track('player_added', { source: 'home', is_new_player: true, player: username, player_name: username })
    showToast(`Now tracking ${username}, checking Wise Old Man for history in the background.`)
    trackedName.value = username
    newUsername.value = ''
    recordRecent({ username: store.players.find((x) => x.username.toLowerCase() === username.toLowerCase())?.username || username, displayName: username })
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      // Already tracked, the useful thing is to open their profile.
      track('player_search_result', { source: 'home', result: 'already_tracked' })
      showToast(`${username} is already being tracked, opening their profile.`)
      const known = store.players.find((x) => x.username.toLowerCase() === username.toLowerCase())
      if (known) recordRecent(known)
      router.push({ name: 'playerDetail', params: { username } })
    } else {
      track('player_search_result', { source: 'home', result: 'error', status: err instanceof ApiError ? err.status : 0 })
      showToast(err instanceof ApiError ? err.message : 'Could not add that player.')
    }
  } finally {
    adding.value = false
  }
}

function focusSearch() {
  track('home_final_cta')
  window.scrollTo({ top: 0, behavior: 'smooth' })
  setTimeout(() => searchInput.value?.focus({ preventScroll: true }), 350)
}

// Announce a finished Wise Old Man import once, if this page is open when it lands.
watch(
  () => store.players.map((p) => ({ id: p.id, status: p.womImportStatus, count: p.womImportedCount, name: p.displayName })),
  (current, previous) => {
    if (!previous) return
    for (const player of current) {
      const before = previous.find((p) => p.id === player.id)
      const wasImporting = before && (before.status === 'pending' || before.status === 'running')
      if (!wasImporting || player.status !== 'done') continue
      showToast(
        player.count > 0
          ? `Finished importing ${player.count.toLocaleString('en-US')} historical snapshots for ${player.name}.`
          : `${player.name} is all set, no extra history found on Wise Old Man.`,
      )
    }
  },
)

// Focusing the empty box lists the last few players you opened (see RecentPlayers).
const searchFocused = ref(false)
function openRecent(o) {
  track('search_suggestion_selected', { source: 'home_recent' })
  router.push({ name: 'playerDetail', params: { username: o.username } })
}

// Typeahead: partial, case-insensitive matches among already-tracked players.
const suggestions = ref([])
let suggestTimer = null
let typedTracked = false
watch(newUsername, (q) => {
  clearTimeout(suggestTimer)
  const term = (q || '').trim()
  if (term && !typedTracked) {
    typedTracked = true
    track('search_started', { source: 'home' })
  }
  if (term.length < 2) {
    suggestions.value = []
    return
  }
  suggestTimer = setTimeout(async () => {
    try {
      const rows = await playersApi.search(term)
      if ((newUsername.value || '').trim() === term) {
        suggestions.value = rows
        if (rows.length) track('search_suggestions_shown', { source: 'home', count: rows.length })
      }
    } catch {
      suggestions.value = []
    }
  }, 250)
})

</script>
