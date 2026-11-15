<template>
  <div class="dash">
    <p v-if="booting" class="dash-loading">Loading your dashboard…</p>

    <template v-else>
      <header class="card dash-head">
        <div class="dash-who">
          <RouterLink v-if="current" class="dash-avatar" :to="profileRoute" :aria-label="`Open ${current.displayName}'s profile`"><PlayerAvatar :name="current.username" /></RouterLink>
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
          <RouterLink v-if="current" class="btn btn-ghost" :to="profileRoute">View profile</RouterLink>
        </div>
      </header>

      <div class="dash-grid">
        <div class="dash-main">
          <!-- Your week -->
          <template v-if="current">
            <p v-if="!player" class="card dash-note">{{ current.displayName }} is not being tracked yet. Open the profile to start tracking.</p>
            <OverviewWeek v-else-if="weekDays.length" :days="weekDays" :streak-info="streak" :month-gain="monthGain" hide-challenge @day="(d) => (recapDay = d)" />
            <p v-else-if="loadingMine" class="card dash-note">Loading your week…</p>
            <p v-else class="card dash-note">No XP tracked this week yet. Play a session and come back, your week fills in here.</p>

          </template>

          <section v-else class="card dash-card dash-claim">
            <h2>Make this page yours</h2>
            <p>Find your player with the search box at the top and press <b>Claim</b> on its profile. Once it is yours, your week, streak and goals show up here. Plans you save and the players you follow already do.</p>
            <RouterLink class="btn btn-primary" :to="{ name: 'discover' }">Browse players</RouterLink>
          </section>

          <!-- Your clans -->
          <DashClans />

          <!-- Plans -->
          <section class="card dash-card is-compact" aria-labelledby="dash-plans-h">
            <header class="dash-card-head">
              <h2 id="dash-plans-h">Your plans</h2>
              <RouterLink class="dash-more" :to="{ name: 'account', query: { tab: 'plans' } }">{{ plans.length > planRows.length ? `All ${plans.length} plans →` : 'All plans →' }}</RouterLink>
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

          <DashNext v-if="current" :items="nextItems" />
        </div>

        <aside class="dash-side">
          <DashInbox />
          <FollowingStrip v-if="following.length" />
          <section v-else class="card dash-card">
            <h2>Following</h2>
            <p class="dash-empty">Follow players to see their gains and milestones here. Open any profile and press Follow.</p>
            <RouterLink class="btn btn-ghost" :to="{ name: 'discover' }">Find players</RouterLink>
          </section>
          <DashMilestones v-if="current" :events="milestones" :to="{ name: 'playerDetail', params: { username: current.username }, query: { tab: 'achievements' } }" />
          <!-- Goals -->
          <section v-if="current" class="card dash-card" aria-labelledby="dash-goals-h">
            <header class="dash-card-head">
              <h2 id="dash-goals-h">Goals</h2>
              <RouterLink class="dash-more" :to="{ name: 'playerDetail', params: { username: current.username }, query: { tab: 'goals' } }">{{ shownGoals.length ? 'All goals →' : 'Set a goal →' }}</RouterLink>
            </header>
            <p v-if="!shownGoals.length" class="dash-empty">{{ loadingMine ? 'Loading…' : 'No goals yet. Pick a skill and a target on your profile and the progress shows up here.' }}</p>
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
import OverallLevel from '@/components/OverallLevel.vue'
import DashInbox from '@/components/dashboard/DashInbox.vue'
import DashMilestones from '@/components/dashboard/DashMilestones.vue'
import DashNext from '@/components/dashboard/DashNext.vue'
import DayRecapModal from '@/components/profile/DayRecapModal.vue'
import OverviewWeek from '@/components/profile/OverviewWeek.vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { goalsApi } from '@/api/goals'
import { playersApi } from '@/api/players'
import { recordsApi } from '@/api/records'
import { useAuth } from '@/composables/useAuth'
import { useFollowing } from '@/composables/useFollowing'
import { useRequirements } from '@/composables/useRequirements'
import { useRivals } from '@/composables/useRivals'
import { usePlayersStore } from '@/stores/players'
import { SYNCED_EVENT } from '@/utils/accountData'
import { dailyXp, trackedSnapshots } from '@/utils/compare'
import { dashboardGoals, finishDays, planBadge, planStatus, recentMilestones, whatsNext } from '@/utils/dashboard'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { setPageMeta } from '@/utils/pageMeta'
import { formatHours } from '@/utils/planner'
import { listSavedPlans } from '@/utils/plannerTools'
import { formatRelative } from '@/utils/time'
import { weekDaysFrom } from '@/utils/weekDays'

setPageMeta({ title: 'Your dashboard', description: 'Your week, goals and plans on TickGains.', path: '/' })

const router = useRouter()
const store = usePlayersStore()
const { profiles, profilesReady } = useAuth()
const { me } = useRivals()
const { following } = useFollowing()
const { confirmations, respect } = useRequirements()

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
// The achievements, timeline and congratulations from the profile, and its records.
const profileData = ref(null)
const records = ref([])
const loadingMine = ref(false)
let stamp = 0
async function loadMine() {
  const p = player.value
  const id = ++stamp
  if (!p) {
    snaps.value = []
    streak.value = null
    goals.value = []
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
  records.value = rec.status === 'fulfilled' ? rec.value.records : []
  loadingMine.value = false
}
watch(() => [player.value?.id, player.value?.latest?.capturedAt], loadMine, { immediate: true })

const tracked = computed(() => trackedSnapshots(player.value, snaps.value))
const weekDays = computed(() => weekDaysFrom(tracked.value))
const monthGain = computed(() => dailyXp(tracked.value, 30).reduce((sum, d) => sum + d.xp, 0))
const shownGoals = computed(() => dashboardGoals(goals.value, 4))
const nextItems = computed(() => whatsNext({ latest: player.value?.latest, achievements: profileData.value?.achievements || [], days: weekDays.value }))
const milestones = computed(() => recentMilestones({ timeline: profileData.value?.timeline || [], celebrations: profileData.value?.celebrations || [], days: weekDays.value, records: records.value }))

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
    }
  }),
)
const planRows = computed(() => [...allPlanRows.value].sort((a, b) => a.soon - b.soon).slice(0, 3))
</script>
