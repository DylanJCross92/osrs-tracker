<template>
  <div class="shared-plan">
    <section v-if="loading" class="card"><p class="empty-hint">Loading the plan…</p></section>

    <section v-else-if="error" class="card">
      <h1>Plan not found</h1>
      <p class="empty-hint">{{ error }}</p>
      <RouterLink class="btn btn-primary" to="/planner">Build your own plan</RouterLink>
    </section>

    <template v-else-if="share">
      <section class="card sp-head">
        <div class="sp-head-main">
          <p class="sp-kicker">
            Training plan
            <span class="sp-mode" :class="{ live: share.mode === 'live' }">{{ share.mode === 'live' ? 'Live progress' : 'Static plan' }}</span>
          </p>
          <h1>{{ share.name }}</h1>
          <p class="sp-by">
            <template v-if="share.rsn">by <RouterLink :to="{ name: 'playerDetail', params: { username: share.rsn } }">{{ share.rsn }}</RouterLink> · </template>
            Updated {{ fmtDate(share.updatedAt) }}
          </p>
        </div>
        <div class="sp-head-actions">
          <button class="btn btn-primary" type="button" @click="useThisPlan">Use this plan</button>
          <button class="btn btn-ghost" type="button" @click="copyLink">Copy link</button>
        </div>
      </section>

      <section class="card sp-body">
        <div class="plan-tiles">
          <div class="plan-tile"><span>Training time</span><b>{{ formatHours(totals.totalHours) }}</b><small>{{ totals.days == null ? '' : `${totals.days.toLocaleString('en-US')} day${totals.days === 1 ? '' : 's'} at ${plan.hoursPerDay} h/day` }}</small></div>
          <div class="plan-tile">
            <span>Net GP</span>
            <b :class="gpClass(totals.netGp)">{{ totals.netGp == null ? 'No GP data' : formatGp(totals.netGp) }}</b>
            <small>{{ totals.netGp == null ? '' : totals.netGp >= 0 ? 'estimated profit' : 'estimated cost' }}</small>
          </div>
          <div class="plan-tile"><span>XP to gain</span><b>{{ formatNum(totals.totalXp) }}</b><small>{{ plan.goals.length }} skill{{ plan.goals.length === 1 ? '' : 's' }}</small></div>
        </div>

        <PlannerProgress v-if="progress" readonly :progress="progress" :updated-at="player?.latest?.capturedAt || ''" :baseline-at="plan.statsAt || ''" :entries="timeline.entries" />
        <p v-else-if="share.mode === 'live'" class="planner-hint">Live progress needs {{ share.rsn }} to be tracked on TickGains. Showing the plan as it was made.</p>

        <h2 class="sp-goals-title">Goals, in training order</h2>
        <ol class="sp-goals">
          <li v-for="(g, i) in plan.goals" :key="g.skill" class="sp-goal" :class="{ done: progress?.per[i]?.done }">
            <div class="sp-goal-head">
              <span class="sp-order">{{ i + 1 }}</span>
              <img :src="skillIconSrc(g.skill)" :alt="g.skill" width="28" height="28" />
              <span class="sp-goal-title">
                <b>{{ g.skill }}</b>
                <em>{{ levelAtXp(g.currentXp, true) }} → {{ levelAtXp(g.targetXp, true) }}</em>
              </span>
              <span class="sp-goal-method">{{ methodText(g, shown[i]) }}</span>
              <span class="sp-goal-nums">
                <span><small>Time</small>{{ shown[i].remainingXp === 0 ? 'Done' : formatHours(shown[i].hours) }}</span>
                <span><small>Net GP</small><b :class="gpClass(shown[i].netGp)">{{ shown[i].netGp == null ? '-' : formatGp(shown[i].netGp) }}</b></span>
                <span v-if="timeline.entries[i]?.endDate"><small>Done by</small>{{ fmtDate(timeline.entries[i].endDate) }}</span>
              </span>
            </div>
            <span v-if="progress" class="sp-goal-bar" aria-hidden="true"><i :style="{ width: progress.per[i].pct * 100 + '%' }" /></span>
            <details v-if="shown[i].segments.length" class="sp-steps">
              <summary>Steps</summary>
              <PlannerRoute :segments="shown[i].segments" />
            </details>
          </li>
        </ol>
        <p class="planner-hint">Estimates only. GP and time figures are approximate, from community rates, and assume the plan owner's choices. Visitors cannot change this plan.</p>
      </section>

      <section class="card sp-cta">
        <div>
          <h2>Want this plan for your account?</h2>
          <p class="empty-hint">Use it as a starting point. Enter your RSN and every goal is recalculated from your own stats. Nothing of {{ share.rsn || 'the owner' }}'s progress is copied.</p>
        </div>
        <button class="btn btn-primary" type="button" @click="useThisPlan">Use this plan</button>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PlannerProgress from '@/components/planner/PlannerProgress.vue'
import PlannerRoute from '@/components/planner/PlannerRoute.vue'
import { sharedPlansApi } from '@/api/sharedPlans'
import { usePlayersStore } from '@/stores/players'
import { useToast } from '@/composables/useToast'
import { getMethod } from '@/data/trainingMethods'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatGp, formatHours, formatNum, isAuto, levelAtXp, planGoal, planTotals } from '@/utils/planner'
import { STRATEGY_LABELS, buildProgress, buildTimeline, liveGoalFor, resolveGoal } from '@/utils/plannerTools'
import { setPageMeta } from '@/utils/pageMeta'
import { track } from '@/utils/analytics'

const route = useRoute()
const router = useRouter()
const store = usePlayersStore()
const { showToast } = useToast()

const share = ref(null)
const loading = ref(true)
const error = ref('')

setPageMeta({ title: 'Training plan', description: 'A shared Old School RuneScape training plan on TickGains.', path: route.path, noindex: true })

onMounted(async () => {
  try {
    share.value = (await sharedPlansApi.get(route.params.slug)).plan
    setPageMeta({ title: `${share.value.name}${share.value.rsn ? ` by ${share.value.rsn}` : ''}`, description: `A shared Old School RuneScape training plan on TickGains.`, path: route.path, noindex: true })
    track('shared_plan_viewed', { mode: share.value.mode })
    if (share.value.mode === 'live' && !store.loaded) await store.loadPlayers().catch(() => {})
  } catch (err) {
    error.value = err?.status === 404 ? 'That plan is not shared, or the owner has turned sharing off.' : 'Could not load that plan right now. Please try again.'
  } finally {
    loading.value = false
  }
})

const plan = computed(() => share.value.plan)
const resolve = (g) => resolveGoal(g, plan.value.globalStrategy, plan.value.gpValue)
const originalPlans = computed(() => plan.value.goals.map((g) => planGoal(resolve(g))))

// Live progress: the owner's tracked XP (public hiscores data) moves each goal's start up, exactly as in the planner.
const player = computed(() => (share.value?.rsn ? store.players.find((p) => p.username.toLowerCase() === share.value.rsn.toLowerCase()) : null))
const tracking = computed(() => share.value?.mode === 'live' && !!player.value?.latest && !!plan.value.statsAt)
const liveGoals = computed(() => plan.value.goals.map((g) => (tracking.value ? liveGoalFor(g, player.value.latest.skills?.[g.skill]?.xp) : g)))
const shown = computed(() => (tracking.value ? liveGoals.value.map((g) => planGoal(resolve(g))) : originalPlans.value))
const totals = computed(() => planTotals(originalPlans.value, plan.value.hoursPerDay))
const progress = computed(() => (tracking.value ? buildProgress(plan.value.goals, liveGoals.value, originalPlans.value, shown.value, plan.value.hoursPerDay, plan.value.statsAt) : null))
// Dates only make sense when the plan is being followed from today (live); a static plan shows durations.
const timeline = computed(() => (tracking.value ? buildTimeline(liveGoals.value, shown.value, plan.value.hoursPerDay) : { entries: [] }))

function methodText(g, p) {
  const id = g.methodId === 'global' ? plan.value.globalStrategy : g.methodId
  if (id === 'custom') return 'Custom rate'
  if (isAuto(id)) return `${STRATEGY_LABELS[id]} route`
  return getMethod(id)?.name || p.method?.name || 'Chosen method'
}

const gpClass = (gp) => (gp == null ? '' : gp >= 0 ? 'planner-gain' : 'planner-cost')
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

function useThisPlan() {
  track('shared_plan_used', { mode: share.value.mode, goals: plan.value.goals.length })
  router.push({ name: 'planner', query: { template: route.params.slug } })
}
async function copyLink() {
  track('shared_plan_link_copied')
  try {
    await navigator.clipboard.writeText(window.location.href)
    showToast('Link copied!')
  } catch {
    showToast('Could not copy the link.')
  }
}
</script>
