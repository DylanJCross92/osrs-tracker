<template>
  <div class="home">
    <!-- 1. Hero -->
    <section class="home-hero" id="start">
      <h1>Your OSRS Journey. <span class="home-accent">Tracked.</span></h1>
      <p class="home-sub">Track every XP gain, explore your history, and plan your next 99.</p>

      <div class="suggest-wrap home-suggest-wrap">
      <form class="home-search" @submit.prevent="submitAdd">
        <!-- Decoy fields so Firefox/Chrome's login-manager autofill (which
             ignores autocomplete="off" on a field it suspects is a login
             username) latches onto these instead of the real RSN input. -->
        <input type="text" name="username" autocomplete="username" class="autofill-decoy" tabindex="-1" aria-hidden="true" />
        <input type="password" name="password" autocomplete="current-password" class="autofill-decoy" tabindex="-1" aria-hidden="true" />
        <input
          ref="searchInput"
          v-model="newUsername"
          type="text"
          placeholder="Enter your OSRS username"
          :disabled="adding"
          autocomplete="off"
          maxlength="12"
          name="rsn"
          aria-label="OSRS username"
          data-1p-ignore
          data-lpignore="true"
          @focus="searchFocused = true"
          @blur="searchFocused = false"
        />
        <button v-if="newUsername.trim() || adding" class="btn btn-primary" type="submit" :disabled="adding || !newUsername.trim()">
          {{ adding ? 'Adding…' : 'Start Tracking' }}
        </button>
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

      <ul class="home-benefits">
        <li><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12v8H4v-8M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 100-5C13 2 12 7 12 7z" /></svg>Free to use</li>
        <li><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5" /></svg>Automatic XP updates</li>
        <li><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>Historical XP imports</li>
      </ul>
      <p class="home-nosignup">No registration required, just enter your RSN.</p>
    </section>

    <!-- Live community ticker -->
    <section v-if="liveEvents.length" class="home-live" aria-label="Live community activity">
      <div class="home-live-head">
        <span class="disc-live-dot" />
        <b>Live from the community</b>
        <span class="home-live-count">{{ formatCount(community?.totalPlayers) }} players tracked</span>
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

    <!-- 2. Feature showcase -->
    <section id="features" class="home-section">
      <div class="home-features">
        <RouterLink v-for="f in features" :key="f.title" :to="f.to" class="card home-feature" @click="track('home_feature', { feature: f.key })">
          <div class="home-feature-top">
            <span class="home-feature-icon" v-html="f.icon" />
            <FeatureArt :kind="f.key" />
          </div>
          <h3>{{ f.title }}</h3>
          <p>{{ f.text }}</p>
          <span class="home-feature-link">{{ f.cta }}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
        </RouterLink>
      </div>
    </section>

    <!-- 3. Profile preview -->
    <section class="home-section">
      <h2 class="home-h2">See what you get</h2>
      <div v-if="loading" class="card"><p class="empty-hint">Loading an example profile…</p></div>
      <div v-else-if="example" class="card home-preview">
        <div class="home-preview-main">
          <div class="home-preview-head">
            <span class="home-preview-avatar"><PlayerAvatar :name="example.username || example.displayName" /></span>
            <div>
              <span class="home-preview-label">Example profile</span>
              <h3>{{ example.displayName }}<PlayerBadge :label="example.badge" :claimed="example.claimed" /></h3>
            </div>
          </div>
          <div class="home-preview-stats">
            <div><span>Overall</span><b>{{ example.overallLevel?.toLocaleString('en-US') }}</b></div>
            <div v-if="example.weekXp"><span>Gained · 7 days</span><b class="stat-gain">+{{ example.weekXp.toLocaleString('en-US') }}</b></div>
            <div class="wide"><span>Total XP</span><b>{{ example.overallXp?.toLocaleString('en-US') }}</b></div>
          </div>
          <div v-if="example.recentSkills.length" class="home-preview-gains">
            <span class="home-preview-label">Recent XP gains</span>
            <ul>
              <li v-for="s in example.recentSkills" :key="s.skill"><img :src="skillIconSrc(s.skill)" :alt="s.skill" width="20" height="20" />{{ s.skill }}<b class="stat-gain">+{{ formatXp(s.xp) }}</b></li>
            </ul>
          </div>
          <div v-if="example.featured || example.highest" class="home-preview-featured">
            <span class="home-preview-label">{{ example.featured ? 'Featured achievement' : 'Highest skill' }}</span>
            <span class="home-preview-feat">
              <img :src="skillIconSrc(example.featured?.skill || example.highest.skill)" alt="" width="22" height="22" />
              {{ example.featured ? example.featured.title : `${example.highest.skill} ${example.highest.level}` }}
            </span>
          </div>
          <RouterLink :to="{ name: 'playerDetail', params: { username: example.username } }" class="btn btn-primary" @click="track('home_example_profile')">View Example Profile</RouterLink>
        </div>
        <div class="home-preview-chart">
          <span class="home-preview-label">XP progression</span>
          <XpLineChart v-if="chartPoints.length > 1" :points="chartPoints" aria-label="Example player's total experience over time" />
          <p v-else class="empty-hint">History builds up as snapshots are saved.</p>
        </div>
      </div>
      <div v-else class="card"><p class="empty-hint">Track a player above and your profile will look like this, charts, milestones and gains.</p></div>
    </section>

    <!-- 4. How it works -->
    <section id="how-it-works" class="home-section">
      <h2 class="home-h2">How it works</h2>
      <ol class="home-steps">
        <li v-for="(s, i) in steps" :key="s.title" class="card">
          <span class="home-step-n">{{ i + 1 }}</span>
          <h3>{{ s.title }}</h3>
          <p>{{ s.text }}</p>
        </li>
      </ol>
    </section>

    <!-- 5. Community activity -->
    <section class="home-section">
      <div class="home-community-head">
        <h2 class="home-h2">Community activity</h2>
        <RouterLink to="/discover" class="btn btn-ghost" @click="track('home_view_discover')">View Discover →</RouterLink>
      </div>
      <div v-if="loading" class="card"><p class="empty-hint">Loading community activity…</p></div>
      <p v-else-if="error" class="card empty-hint">Community activity isn't available right now.</p>
      <template v-else-if="community && community.totalPlayers">
        <div class="home-tiles">
          <div class="card home-tile"><span>Players tracked</span><b>{{ community.totalPlayers.toLocaleString('en-US') }}</b></div>
          <div class="card home-tile"><span>XP gained {{ community.xpToday ? 'today' : 'this week' }}</span><b class="stat-gain">+{{ formatXp(community.xpToday || community.xpWeek) }}</b></div>
        </div>
        <div class="home-community">
          <div class="card">
            <h3>Top gainers {{ community.gainersPeriod === 'day' ? 'today' : 'this week' }}</h3>
            <ol v-if="community.topGainers.length" class="home-list">
              <li v-for="(g, i) in community.topGainers" :key="g.username">
                <RouterLink :to="{ name: 'playerDetail', params: { username: g.username } }">
                  <span class="disc-rank" :class="`r${i + 1}`">{{ i + 1 }}</span>
                  <span class="home-list-name">{{ g.displayName }}<PlayerBadge :label="g.badge" :claimed="g.claimed" /></span>
                  <span class="stat-gain">+{{ formatXp(g.xp) }}</span>
                </RouterLink>
              </li>
            </ol>
            <p v-else class="empty-hint">No XP gained yet, check back after the next update.</p>
          </div>
          <div class="card">
            <h3>Most trained skills this week</h3>
            <ul v-if="community.topSkills.length" class="home-list">
              <li v-for="s in community.topSkills" :key="s.skill">
                <span class="home-list-row">
                  <img :src="skillIconSrc(s.skill)" :alt="s.skill" width="22" height="22" />
                  <span class="home-list-name">{{ s.skill }}</span>
                  <small>{{ s.players.toLocaleString('en-US') }} player{{ s.players === 1 ? '' : 's' }}</small>
                  <span class="stat-gain">+{{ formatXp(s.xp) }}</span>
                </span>
              </li>
            </ul>
            <p v-else class="empty-hint">Skill activity shows up after the first updates.</p>
          </div>
          <div class="card">
            <h3>Recent milestones</h3>
            <ul v-if="community.recentMilestones.length" class="home-list">
              <li v-for="m in community.recentMilestones" :key="m.key">
                <RouterLink :to="{ name: 'playerDetail', params: { username: m.username } }">
                  <img v-if="m.skill" :src="skillIconSrc(m.skill)" :alt="m.skill" width="22" height="22" />
                  <span v-else class="disc-glyph">★</span>
                  <span class="home-list-name"><b>{{ m.displayName }}</b> {{ m.title }}</span>
                  <small>{{ formatRelative(m.detectedAt) }}</small>
                </RouterLink>
              </li>
            </ul>
            <p v-else class="empty-hint">Big milestones, 99s, 100M XP, appear here as they're detected.</p>
          </div>
        </div>
      </template>
      <div v-else class="card"><p class="empty-hint">Be the first, track a player above and the community activity starts here.</p></div>
    </section>

    <!-- 6. Stay in the loop -->
    <section v-if="showNews" class="card home-news" aria-label="Email updates">
      <EmailSignup source="home" variant="card" heading="Be first to hear what's next" blurb="New features are on the way, including claiming your profile. Leave your email and we'll let you know when they land." />
    </section>

    <!-- 7. Final CTA -->
    <section class="card home-final">
      <h2>Ready to Track Your Next 99?</h2>
      <p>Free, no sign-up, just your RSN.</p>
      <button class="btn btn-primary" type="button" @click="focusSearch">Start Tracking Your Player</button>
    </section>
  </div>
</template>

<script setup>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayersStore } from '@/stores/players'
import { useToast } from '@/composables/useToast'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'
import { ApiError } from '@/api/client'
import { setPageMeta } from '@/utils/pageMeta'
import PlayerBadge from '@/components/PlayerBadge.vue'
import { useAuth } from '@/composables/useAuth'
import PlayerSuggestRow from '@/components/PlayerSuggestRow.vue'
import RecentPlayers from '@/components/RecentPlayers.vue'
import { recordRecent } from '@/composables/useRecentPlayers'
import XpLineChart from '@/components/XpLineChart.vue'
import { playersApi } from '@/api/players'
import { api } from '@/api/client'
import { track } from '@/utils/analytics'
import CheerPill from '@/components/CheerPill.vue'
import EmailSignup from '@/components/EmailSignup.vue'
import FeatureArt from '@/components/home/FeatureArt.vue'

const router = useRouter()
// The email sign-up card is for visitors without an account; signed-in accounts already gave us their email.
const { ready: authReady, loggedIn } = useAuth()
const showNews = computed(() => authReady.value && !loggedIn.value)
const store = usePlayersStore()
const { showToast } = useToast()

setPageMeta({
  title: 'OSRS XP Tracker & Hiscores History',
  description:
    'Free OSRS XP tracker. Track XP gains, hiscores history and level progress for any Old School RuneScape player, no sign-up. Import Wise Old Man history and plan your next 99.',
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
const formatCount = (n) => (n == null ? '' : n.toLocaleString('en-US'))
const community = computed(() => home.value?.community || null)
const example = computed(() => home.value?.example || null)
const chartPoints = computed(() => (example.value?.series || []).map((p) => ({ x: p.t, y: p.xp })))

// --- features / steps ---
const exampleTo = (tab) =>
  example.value ? { name: 'playerDetail', params: { username: example.value.username }, query: tab ? { tab } : {} } : { path: '/discover' }
const svg = (d) => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
const features = computed(() => [
  { key: 'tracking', title: 'Automatic XP Tracking', text: 'Track skill XP, levels, and progress with automatic updates every hour while a player is active.', cta: 'See a live profile', to: exampleTo('stats'), icon: svg('<path d="M3 17l6-6 4 4 8-9" /><path d="M15 6h6v6" />') },
  { key: 'history', title: 'Historical XP Data', text: 'Import available Wise Old Man history to view previous progress.', cta: 'Browse history', to: exampleTo('history'), icon: svg('<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />') },
  { key: 'planner', title: 'Account Planner', text: 'Calculate XP requirements, training methods, and estimated hours to reach goals.', cta: 'Plan a goal', to: { path: '/planner' }, icon: svg('<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" />') },
  { key: 'calculators', title: 'Skill Calculators', text: 'Quick XP, time and gp calculators for every skill, with training methods and shareable links.', cta: 'Open calculators', to: { path: '/calculators' }, icon: svg('<rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h2M12 11h2M8 15h2M12 15h2" />') },
  { key: 'discover', title: 'Player Discovery', text: 'Explore leaderboards, player achievements, and recent activity.', cta: 'Open Discover', to: { path: '/discover' }, icon: svg('<circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />') },
])
const steps = [
  { title: 'Enter Your RSN', text: 'Search for your OSRS character.' },
  { title: 'Track Automatically', text: 'TickGains records XP snapshots every hour (daily when a player is inactive) and imports available historical data.' },
  { title: 'Explore Your Progress', text: 'View charts, milestones, and plan future goals.' },
]

// --- tracking (unchanged behaviour) ---
const trackedPlayer = computed(() => (trackedName.value ? store.players.find((p) => p.username.toLowerCase() === trackedName.value.toLowerCase()) : null))
const importing = computed(() => ['pending', 'running'].includes(trackedPlayer.value?.womImportStatus))

async function submitAdd() {
  const username = newUsername.value.trim()
  if (!username) return
  adding.value = true
  track('player_search', { source: 'home', username_length: username.length })
  try {
    await store.addPlayer(username)
    // A 201 from the API means this name was not tracked on the site before.
    track('player_added', { source: 'home', is_new_player: true, player_name: username })
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
