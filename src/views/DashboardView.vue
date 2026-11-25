<template>
  <div class="dash">
    <!-- Until the page knows whose it is: the same layout as skeletons, so nothing jumps when it fills in -->
    <template v-if="booting">
      <DashSkeleton kind="head" />
      <div class="dash-grid">
        <div class="dash-main">
          <DashSkeleton kind="week" />
          <DashSkeleton kind="clans" />
          <DashSkeleton kind="plans" />
          <DashSkeleton kind="next" />
        </div>
        <aside class="dash-side">
          <DashSkeleton kind="following" />
          <DashSkeleton kind="milestones" />
          <DashSkeleton kind="goals" />
        </aside>
      </div>
    </template>

    <!-- Signed up but no profile yet: a page that points at the one thing to do -->
    <DashWelcome v-else-if="!current" />

    <template v-else>
      <header class="card dash-head">
        <div class="dash-who">
          <div v-if="current" class="dash-avatar-wrap">
            <RouterLink class="dash-avatar" :to="profileRoute" :aria-label="`Open ${current.displayName}'s profile`"><PlayerAvatar :name="current.username" /></RouterLink>
            <CombatBadge :skills="player?.latest?.skills" />
          </div>
          <div class="dash-who-text">
            <p class="dash-hi">Welcome back</p>
            <h1>
              <RouterLink v-if="current" class="dash-name" :to="profileRoute">{{ current.displayName }}</RouterLink>
              <template v-else>Your dashboard</template>
            </h1>
            <p v-if="player?.latest" class="dash-sub">
              <OverallLevel :level="player.latest.overallLevel" /> · {{ formatXp(player.latest.overallXp) }} XP · updated {{ formatRelative(player.latest.capturedAt) }}
            </p>
            <p v-else-if="!current" class="dash-sub">Your week, goals and plans in one place.</p>
          </div>
        </div>
        <div class="dash-head-actions">
          <div v-if="choices.length > 1" class="dash-switch" role="group" aria-label="Which profile">
            <button v-for="c in choices" :key="c.username" type="button" class="dash-switch-btn" :class="{ on: current?.username === c.username }" :aria-pressed="current?.username === c.username" @click="pick(c.username)">{{ c.displayName }}</button>
          </div>
          <button v-if="!profiles.length && me" class="btn-text dash-notme" type="button" title="Forget this player in this browser" @click="notMe">Not you?</button>
          <button v-if="player" class="dash-refresh" :class="{ 'is-busy': refreshing, 'is-done': synced }" type="button" :disabled="refreshing" title="Pull your latest hiscores" @click="refresh">
            <svg v-if="synced" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
            <svg v-else class="dash-refresh-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
            <span aria-live="polite">{{ refreshing ? 'Syncing' : synced ? 'Updated' : 'Refresh' }}</span>
          </button>
        </div>
      </header>

      <!-- A player nobody owns yet: what claiming gives, and the way to do it -->
      <ClaimTeaser v-if="!profiles.length && current" :username="current.username" :display-name="current.displayName" variant="card" />

      <div class="dash-grid">
        <div class="dash-main">
          <!-- Your week -->
          <template v-if="current">
            <p v-if="!player" class="card dash-note">{{ current.displayName }} is not being tracked yet. Open the profile to start tracking.</p>
            <OverviewWeek v-else-if="weekDays.length" :days="weekDays" :streak-info="streak" :month-gain="monthGain" :usual="usual" hide-challenge @day="(d) => (recapDay = d)" />
            <DashSkeleton v-else-if="firstLoad" kind="week" />
            <p v-else class="card dash-note">No XP tracked this week yet. Play a session and come back, your week fills in here.</p>

          </template>


          <!-- Your clans -->
          <DashClans />

          <!-- Plans -->
          <section class="card dash-card is-compact" aria-labelledby="dash-plans-h">
            <header class="dash-card-head">
              <h2 id="dash-plans-h">Your plans</h2>
              <RouterLink class="dash-more" :to="{ name: 'planner' }">{{ plans.length > planRows.length ? `All ${plans.length} plans →` : 'All plans →' }}</RouterLink>
            </header>
            <div v-if="!planRows.length" class="dash-empty dash-empty-row">
              <span>No saved plans yet.</span>
              <RouterLink class="dash-more" :to="{ name: 'planner' }">New plan →</RouterLink>
              <RouterLink class="dash-more" :to="{ name: 'planGuides' }">Plan guides →</RouterLink>
            </div>
            <ul v-else class="dash-plans">
              <li v-for="r in planRows" :key="r.plan.id" class="dash-plan">
                <div class="dash-plan-top">
                  <RouterLink class="dash-plan-name" :to="{ name: 'planner', query: { plan: r.plan.id } }">{{ r.plan.name }}</RouterLink>
                  <span class="dash-plan-right">
                    <span v-if="r.badge" class="dash-badge" :class="`is-${r.badge.kind}`">{{ r.badge.text }}</span>
                    <span v-else-if="r.status.tracked && r.status.progress.complete" class="dash-badge is-ahead">Complete</span>
                    <b v-if="r.status.tracked" class="dash-plan-pct">{{ r.pct }}%</b>
                  </span>
                </div>
                <template v-if="r.status.tracked">
                  <div class="dash-bar is-thin" role="progressbar" :aria-valuenow="r.pct" aria-valuemin="0" aria-valuemax="100" :aria-label="`${r.plan.name} progress`"><i :style="{ width: r.pct + '%' }" /></div>
                  <p class="dash-plan-meta is-muted">
                    <span>{{ r.status.progress.completedGoals }} of {{ r.status.progress.goalCount }} goal{{ r.status.progress.goalCount === 1 ? '' : 's' }}</span>
                    <span v-if="r.status.next" class="dash-now"><img :src="skillIconSrc(r.status.next.skill)" alt="" width="14" height="14" />{{ r.status.next.skill }} {{ r.status.next.liveLevel }} to {{ r.status.next.targetLevel }}</span>
                    <span v-if="!r.status.progress.complete">about {{ formatHours(r.status.hoursLeft) }} to go</span>
                    <span v-if="r.finish">finish {{ r.finish }}</span>
                  </p>
                </template>
                <p v-else class="dash-plan-meta is-muted">
                  <span>{{ r.plan.goals.length }} goal{{ r.plan.goals.length === 1 ? '' : 's' }}</span>
                  <span>{{ formatHours(r.status.summary.totalHours) }}</span>
                  <span>{{ r.plan.player?.rsn ? `${r.plan.player.rsn} is not tracked yet` : 'Open it and enter a username to start tracking' }}</span>
                </p>
              </li>
            </ul>
          </section>

          <template v-if="current">
            <DashSkeleton v-if="firstLoad" kind="next" />
            <DashNext v-else :items="nextItems" />
          </template>

          <!-- The quest tracker and what to do next in it: in the wide column, so the sidebar stays short -->
          <TrackerLink place="dashboard" :pick="questPick" />
        </div>

        <aside class="dash-side">
          <FollowingStrip v-if="following.length" />
          <section v-else class="card dash-card">
            <h2>Following</h2>
            <p class="dash-empty">Follow players to see their gains and milestones here. Open any profile and press Follow<template v-if="!loggedIn"> (it needs a free account: <RouterLink :to="{ name: 'signup', query: { next: '/' } }">create one</RouterLink> or <RouterLink :to="{ name: 'login', query: { next: '/' } }">log in</RouterLink>)</template>.</p>
            <RouterLink class="btn btn-ghost" :to="{ name: 'discover' }">Find players</RouterLink>
          </section>
          <DashWatchlist />
          <DashSkeleton v-if="current && firstLoad" kind="milestones" />
          <DashMilestones v-else-if="current" :events="milestones" :to="{ name: 'playerDetail', params: { username: current.username }, query: { tab: 'achievements' } }" />
          <!-- Goals -->
          <DashSkeleton v-if="current && firstLoad" kind="goals" />
          <!-- Goals come from a plan shown on a claimed profile: for anyone else the card is there, locked, saying what unlocks it -->
          <section v-else-if="current && profiles.length" class="card dash-card" aria-labelledby="dash-goals-h">
            <header class="dash-card-head">
              <h2 id="dash-goals-h">Goals</h2>
              <RouterLink v-if="shownGoals.length" class="dash-more" :to="{ name: 'playerDetail', params: { username: current.username }, query: { tab: 'goals' } }">All goals →</RouterLink>
              <RouterLink v-else class="dash-more" :to="{ name: 'planner', query: { u: current.username } }">Plan a goal →</RouterLink>
            </header>
            <p v-if="goalPlan" class="dash-goal-plan"><b>{{ goalPlan.name }}</b> · {{ goalPlan.percent }}% · {{ goalPlan.reached }} of {{ goalPlan.count }} reached</p>
            <p v-if="!shownGoals.length" class="dash-empty">No goal yet. In the planner, open your plan's Plan settings and turn on Show this plan on my profile, and its progress shows up here.</p>
            <ul v-else class="dash-goals">
              <li v-for="g in shownGoals" :key="g.id" class="dash-goal" :class="{ 'is-done': g.reached }">
                <img :src="skillIconSrc(g.skill)" alt="" width="26" height="26" />
                <div class="dash-goal-main">
                  <div class="dash-goal-top">
                    <b>{{ g.title }}</b>
                    <span v-if="g.pinned" class="dash-pin" title="Pinned goal">Pinned</span>
                    <span class="dash-goal-pct">{{ g.reached ? 'Done' : `${g.percent}%` }}</span>
                  </div>
                  <div class="dash-bar" role="progressbar" :aria-valuenow="g.percent" aria-valuemin="0" aria-valuemax="100" :aria-label="`${g.title} progress`"><i :style="{ width: Math.min(g.percent, 100) + '%' }" /></div>
                  <small v-if="!g.reached">{{ formatXp(g.remainingXp) }} XP to go</small>
                  <small v-else>Reached{{ g.reachedAt ? ` ${formatRelative(g.reachedAt)}` : '' }}</small>
                </div>
              </li>
            </ul>
          </section>
          <ClaimTeaser v-else-if="current" class="card dash-card" :username="current.username" :display-name="current.displayName" variant="goals" />
        </aside>
      </div>
    </template>

    <!-- The same day recap as on the profile. -->
    <DayRecapModal v-if="recapDay && current" :day="recapDay" :days="weekDays" :username="current.username" :display-name="current.displayName" @close="recapDay = null" @records="goRecords" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DashClans from '@/components/dashboard/DashClans.vue'
import FollowingStrip from '@/components/home/FollowingStrip.vue'
import TrackerLink from '@/components/planner/TrackerLink.vue'
import ClaimTeaser from '@/components/dashboard/ClaimTeaser.vue'
import CombatBadge from '@/components/CombatBadge.vue'
import DashWatchlist from '@/components/dashboard/DashWatchlist.vue'
import OverallLevel from '@/components/OverallLevel.vue'
import DashWelcome from '@/components/dashboard/DashWelcome.vue'
import DashMilestones from '@/components/dashboard/DashMilestones.vue'
import DashSkeleton from '@/components/dashboard/DashSkeleton.vue'
import DashNext from '@/components/dashboard/DashNext.vue'
import DayRecapModal from '@/components/profile/DayRecapModal.vue'
import OverviewWeek from '@/components/profile/OverviewWeek.vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { goalsApi } from '@/api/goals'
import { playersApi } from '@/api/players'
import { recordsApi } from '@/api/records'
import { useAuth } from '@/composables/useAuth'
import { useFollowing } from '@/composables/useFollowing'
import { useToast } from '@/composables/useToast'
import { useRequirements } from '@/composables/useRequirements'
import { useAccountType } from '@/composables/useAccountType'
import { useRivals } from '@/composables/useRivals'
import { usePlayersStore } from '@/stores/players'
import { SYNCED_EVENT } from '@/utils/accountData'
import { dailyXp, trackedSnapshots } from '@/utils/compare'
import { dashboardGoals, finishDays, planBadge, planStatus, recentMilestones, whatsNext } from '@/utils/dashboard'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { setPageMeta } from '@/utils/pageMeta'
import { formatHours } from '@/utils/planner'
import { listSavedPlans } from '@/utils/plannerTools'
import { trackerPick } from '@/utils/trackerPick'
import { formatRelative } from '@/utils/time'
import { paceRates, paceSpanDays, weekDaysFrom } from '@/utils/weekDays'
import { usualByNow } from '@/utils/usualPace'

setPageMeta({ title: 'Your dashboard', description: 'Your week, goals and plans on TickGains.', path: '/' })

const router = useRouter()
const store = usePlayersStore()
const { profiles, profilesReady, loggedIn } = useAuth()
const { me, clearMe } = useRivals()
const { following } = useFollowing()
const { confirmations, respect } = useRequirements()
const { members, build } = useAccountType()

// "Not you?": forget the saved player in this browser (the home page goes back to the welcome page).
function notMe() {
  clearMe()
  track('dashboard_not_me')
}
const sameName = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()
onMounted(() => {
  if (!store.loaded) store.loadPlayers().catch(() => {})
})
const booting = computed(() => !profilesReady.value || !store.loaded)

// The profile this page is about: one the account owns, or failing that the name saved as "me".
const choices = computed(() => {
  if (profiles.value.length) return profiles.value
  const mine = store.players.find((p) => sameName(p.username, me.value))
  return mine ? [{ username: mine.username, displayName: mine.displayName }] : []
})
const KEY = 'tickgains-dashboard-profile'
const picked = ref('')
try {
  picked.value = localStorage.getItem(KEY) || ''
} catch {
  /* storage unavailable */
}
const current = computed(() => choices.value.find((c) => sameName(c.username, picked.value)) || choices.value[0] || null)
function pick(username) {
  picked.value = username
  try {
    localStorage.setItem(KEY, username)
  } catch {
    /* storage unavailable */
  }
}
const player = computed(() => (current.value ? store.players.find((p) => sameName(p.username, current.value.username)) || null : null))

// This profile's history, streak and goals.
const snaps = ref([])
const streak = ref(null)
const goals = ref([])
// The plan shown on the profile as its goal, if any ({ name, percent, reached, count }).
const goalPlan = ref(null)
// The achievements, timeline and congratulations from the profile, and its records.
const profileData = ref(null)
const records = ref([])
const loadingMine = ref(false)
// True only until the first load for this profile finishes; later refreshes keep showing what is already there.
const firstLoad = computed(() => loadingMine.value && !snaps.value.length && !profileData.value)
let stamp = 0
async function loadMine() {
  const p = player.value
  const id = ++stamp
  if (!p) {
    snaps.value = []
    streak.value = null
    goals.value = []
    goalPlan.value = null
    profileData.value = null
    records.value = []
    return
  }
  loadingMine.value = true
  const [s, pr, g, rec] = await Promise.allSettled([playersApi.snapshots(p.id), playersApi.profile(p.id), goalsApi.list(p.username), recordsApi.get(p.username)])
  if (id !== stamp) return
  snaps.value = s.status === 'fulfilled' ? s.value : []
  profileData.value = pr.status === 'fulfilled' ? pr.value : null
  streak.value = profileData.value?.streak || null
  goals.value = g.status === 'fulfilled' ? g.value.goals : []
  goalPlan.value = g.status === 'fulfilled' ? g.value.plan : null
  records.value = rec.status === 'fulfilled' ? rec.value.records : []
  loadingMine.value = false
}
watch(() => [player.value?.id, player.value?.latest?.capturedAt], loadMine, { immediate: true })

const tracked = computed(() => trackedSnapshots(player.value, snaps.value))
const weekDays = computed(() => weekDaysFrom(tracked.value))
const usual = computed(() => usualByNow(tracked.value))
const monthGain = computed(() => dailyXp(tracked.value, 30).reduce((sum, d) => sum + d.xp, 0))
const shownGoals = computed(() => dashboardGoals(goals.value, 4))
const nextItems = computed(() => whatsNext({ latest: player.value?.latest, achievements: profileData.value?.achievements || [], days: weekDays.value, spanDays: paceSpanDays(tracked.value) ?? undefined, pace: paceRates(tracked.value) }))
const milestones = computed(() => recentMilestones({ timeline: profileData.value?.timeline || [], celebrations: profileData.value?.celebrations || [], days: weekDays.value, records: records.value }))

// Pulls this profile's latest hiscores, then reloads the week and goals built from them.
const { showToast } = useToast()
const refreshing = ref(false)
const synced = ref(false)
let syncedTimer = 0
async function refresh() {
  const p = player.value
  if (!p || refreshing.value) return
  refreshing.value = true
  synced.value = false
  try {
    await store.refreshPlayer(p.id)
    await loadMine()
    synced.value = true
    clearTimeout(syncedTimer)
    syncedTimer = setTimeout(() => (synced.value = false), 2500)
  } catch {
    showToast('Could not refresh right now. Try again in a moment.')
  } finally {
    refreshing.value = false
  }
}
onBeforeUnmount(() => clearTimeout(syncedTimer))

const profileRoute = computed(() => ({ name: 'playerDetail', params: { username: current.value?.username || '' } }))
// A day tapped in the week chart opens its recap; "See records" in the recap goes on to the profile's Records tab.
const recapDay = ref(null)
function goRecords() {
  recapDay.value = null
  if (current.value) router.push({ name: 'playerDetail', params: { username: current.value.username }, query: { tab: 'records' } })
}

// Saved plans (kept in this browser and in the account), each measured against the player's own stats.
const plans = ref(listSavedPlans())
const refreshPlans = () => (plans.value = listSavedPlans())
onMounted(() => window.addEventListener(SYNCED_EVENT, refreshPlans))
onBeforeUnmount(() => window.removeEventListener(SYNCED_EVENT, refreshPlans))

const histories = reactive({})
const owner = (plan) => store.players.find((p) => sameName(p.username, plan.player?.rsn)) || null
watch(
  [plans, () => store.players, snaps],
  () => {
    if (player.value && snaps.value.length) histories[player.value.id] = snaps.value
    // Pace needs each plan's player history; fetch it once per player (the first few) so plans can be ordered by finish.
    let fetched = 0
    for (const plan of plans.value) {
      const p = owner(plan)
      if (!p || histories[p.id] || fetched >= 6) continue
      fetched++
      histories[p.id] = []
      playersApi.snapshots(p.id).then((rows) => (histories[p.id] = rows)).catch(() => {})
    }
  },
  { immediate: true },
)

const finishText = (projection) => {
  if (!projection || projection.status === 'none' || !projection.projected) return ''
  return projection.daysLeft > 365 * 5 ? 'more than 5 years away' : projection.projected.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
// Every plan measured, then the three that finish soonest (finished plans last).
const allPlanRows = computed(() =>
  plans.value.map((plan) => {
    const p = owner(plan)
    const status = planStatus(plan, { latest: p?.latest || null, history: p ? histories[p.id] : null, confirmations: confirmations.value, respect: respect.value })
    return {
      plan,
      status,
      badge: planBadge(status),
      pct: status.tracked ? (status.progress.complete ? 100 : Math.floor(status.progress.timePct * 100)) : 0,
      finish: status.tracked ? finishText(status.projection) : '',
      soon: finishDays(plan, status),
      latest: p?.latest || null,
    }
  }),
)
const planRows = computed(() => [...allPlanRows.value].sort((a, b) => a.soon - b.soon).slice(0, 3))
// The next quest: one that helps the plan being worked on (the one finishing soonest), or else the best thing to do next.
const questPick = computed(() => trackerPick({ rows: [...allPlanRows.value].sort((a, b) => a.soon - b.soon), latest: player.value?.latest || null, confirmations: confirmations.value, respect: respect.value, members: members.value, build: build.value }))
</script>
