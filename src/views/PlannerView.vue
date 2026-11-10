<template>
  <div class="planner">
    <!-- 1. Player selection -->
    <section class="card planner-top">
      <a v-if="backName" href="#" class="btn-text planner-back" @click.prevent="goBack">← Back to {{ backName }}'s profile</a>
      <h1>OSRS Account Planner</h1>

      <div v-if="player && !editingPlayer" class="planner-player planner-player-compact">
        <b>{{ player.displayName }}</b>
        <span>Total level {{ player.latest.overallLevel.toLocaleString('en-US') }}</span>
        <span>{{ formatNum(player.latest.overallXp) }} XP</span>
        <span>Updated {{ formatRelative(player.latest.capturedAt) }}</span>
        <RouterLink :to="{ name: 'playerDetail', params: { username: player.username } }">TickGains profile →</RouterLink>
        <button class="btn-text" type="button" @click="startChangePlayer">Change player</button>
      </div>
      <template v-else>
        <p class="planner-intro">Load your stats by username (or enter them by hand), then add skill goals and compare ways to reach them. Only need one skill? Try the <RouterLink to="/calculators">skill calculators</RouterLink>.</p>
        <div class="suggest-wrap">
          <form class="add-player-form" @submit.prevent="loadPlayer">
            <input type="text" name="username" autocomplete="username" class="autofill-decoy" tabindex="-1" aria-hidden="true" />
            <input type="password" name="password" autocomplete="current-password" class="autofill-decoy" tabindex="-1" aria-hidden="true" />
            <input v-model="username" type="text" name="rsn" placeholder="OSRS username (optional)" autocomplete="off" maxlength="12" :disabled="lookingUp" data-1p-ignore data-lpignore="true" @focus="searchFocused = true" @blur="searchFocused = false" />
            <button class="btn btn-primary" type="submit" :disabled="lookingUp || !username.trim()">{{ lookingUp ? 'Finding…' : 'Find Player' }}</button>
            <button v-if="player" class="btn btn-ghost" type="button" @click="editingPlayer = false">Cancel</button>
          </form>
          <RecentPlayers v-if="searchFocused && !username.trim()" @pick="pickSuggestion" />
          <ul v-if="suggestions.length" class="search-suggest">
            <li class="suggest-head">Already tracked</li>
            <li v-for="sg in suggestions" :key="sg.username">
              <a href="#" class="suggest-row" @click.prevent="pickSuggestion(sg)"><PlayerSuggestRow :player="sg" /></a>
            </li>
          </ul>
        </div>
        <p v-if="lookupError" class="planner-error">{{ lookupError }} You can still plan manually.</p>
        <p v-else-if="!player" class="planner-hint">No username? Skip this and enter your current level or XP when you add a goal.</p>
      </template>
    </section>

    <!-- 2. Plan overview -->
    <section class="card planner-overview" aria-label="Plan overview">
      <div class="planner-overview-head">
        <h2>Plan overview</h2>
        <span v-if="goals.length" class="planner-calc">Calculated {{ formatRelative(calcAt.toISOString()) }}</span>
      </div>

      <div v-if="staleCount > 0" class="planner-notice">
        Newer player stats are available for {{ staleCount }} skill{{ staleCount === 1 ? '' : 's' }}. Your goals still start from the stats they were created with.
        <button class="btn btn-ghost" type="button" @click="refreshFromPlayer">Refresh from player stats</button>
      </div>

      <div v-if="goals.length" class="plan-tiles">
        <div class="plan-tile"><span>XP remaining</span><b>{{ formatNum(totals.totalXp) }}</b><small>{{ goals.length }} skill{{ goals.length === 1 ? '' : 's' }}</small></div>
        <div class="plan-tile"><span>Training time</span><b>{{ formatHours(totals.totalHours) }}</b><small>at the planned playtime</small></div>
        <div class="plan-tile">
          <span>Net GP</span>
          <b :class="gpClass(totals.netGp)">{{ totals.netGp == null ? 'No GP data' : formatGp(totals.netGp) }}</b>
          <small v-if="totals.gpIncomplete && totals.netGp != null" class="gp-incomplete">Incomplete: some steps are unpriced</small>
          <small v-else-if="totals.netGp != null">{{ totals.netGp >= 0 ? 'estimated profit' : 'estimated cost' }}</small>
        </div>
        <div class="plan-tile plan-tile-finish">
          <span>Completion</span>
          <b>{{ totals.days == null ? '-' : `${totals.days.toLocaleString('en-US')} day${totals.days === 1 ? '' : 's'}` }}</b>
          <small v-if="totals.completionDate">≈ {{ totals.completionDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }} at {{ hoursPerDay }} h/day</small>
        </div>
      </div>
      <p v-else class="empty-hint">No goals yet. Add a skill goal below and the totals will appear here.</p>

      <label class="planner-playtime">
        <span>Daily playtime: <b>{{ hoursPerDay }} h</b></span>
        <input type="range" min="0.5" max="12" step="0.5" v-model.number="hoursPerDay" aria-label="Daily playtime in hours" />
      </label>
    </section>

    <!-- 3. Training goals -->
    <section id="add-goal" class="card planner-goals-card">
      <div class="planner-goals-head">
        <h2>Training goals</h2>
        <button class="btn btn-primary" type="button" @click="openAdd">+ Add Skill Goal</button>
      </div>

      <div class="strategy-bar" role="group" aria-label="Global training strategy">
        <div class="strategy-main">
          <span class="strategy-label">Strategy for all goals</span>
          <div class="range-tabs strategy-tabs">
            <button v-for="s in GLOBAL_STRATEGIES" :key="s" type="button" :class="{ active: globalStrategy === s }" :title="STRATEGY_HINTS[s]" @click="setGlobalStrategy(s)">{{ STRATEGY_LABELS[s] }}</button>
          </div>
        </div>
        <p class="strategy-hint">{{ STRATEGY_HINTS[globalStrategy] }}</p>
        <p v-if="overrideCount" class="strategy-overrides">
          {{ overrideCount }} goal{{ overrideCount === 1 ? '' : 's' }} override{{ overrideCount === 1 ? 's' : '' }} this strategy.
          <button class="btn-text" type="button" @click="resetAllOverrides">Reset all to global</button>
        </p>
      </div>

      <div v-if="goals.length" class="goal-list">
        <PlannerGoalCard
          v-for="(g, i) in goals"
          :key="g.skill"
          :goal="g"
          :plan="plans[i]"
          :compare="compares[i]"
          :global-strategy="globalStrategy"
          :gp-value="gpValue"
          :hours-per-day="hoursPerDay"
          :expanded="expanded.has(g.skill)"
          :index="i"
          :count="goals.length"
          :stale-xp="staleXpFor(g)"
          @toggle="toggleExpanded(g.skill)"
          @remove="removeGoal(i)"
          @move="(dir) => moveGoal(i, dir)"
          @patch="(patch) => patchGoal(i, patch)"
          @pick="(id) => pickRoute(i, id)"
          @refresh="refreshGoal(i)"
        />
      </div>
      <button v-if="goals.length" class="goal-add-bottom" type="button" @click="openAdd">+ Add another skill</button>
      <div v-if="!goals.length" class="planner-empty">
        <p class="empty-hint">Add your first skill goal to start a plan.</p>
        <button class="btn btn-primary" type="button" @click="openAdd">+ Add Skill Goal</button>
      </div>
    </section>

    <template v-if="goals.length">
      <!-- 4. Whole-plan strategy comparison + budget -->
      <section class="card">
        <div v-if="planStrategies" class="planner-compare">
          <div class="planner-compare-head">
            <b>Whole plan by strategy</b>
            <span>{{ strategyVerdict }}</span>
          </div>
          <div class="planner-table-scroll">
            <table class="planner-table">
              <thead><tr><th>Everything on the...</th><th class="num">Hours</th><th class="num">Net GP</th></tr></thead>
              <tbody>
                <tr v-for="row in strategyRows" :key="row.id">
                  <td>{{ row.label }}</td>
                  <td class="num">{{ formatHours(row.totals.totalHours) }}</td>
                  <td class="num" :class="gpClass(row.totals.netGp)">{{ row.totals.netGp == null ? '-' : formatGp(row.totals.netGp) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <PlannerBudget v-model:budget="budget" :result="budgetResult" :start-needed="budgetStartNeeded" @apply="applyBudget" />
      </section>

      <!-- 5. Timeline -->
      <section class="card">
        <PlannerTimeline :timeline="timeline" :hours-per-day="hoursPerDay" />
        <details class="planner-all-methods">
          <summary>Itemised steps and costs</summary>
          <div v-for="(g, i) in goals" :key="g.skill" class="receipt-items">
            <h3><img :src="skillIconSrc(g.skill)" :alt="g.skill" width="18" height="18" /> {{ g.skill }}</h3>
            <PlannerRoute :segments="plans[i].segments" />
          </div>
        </details>
        <p class="planner-hint">GP and time figures are rough estimates from approximate community rates, not guarantees. GP is net per hour of training, so it already nets out supplies and any loot.</p>
        <div class="planner-share">
          <button class="btn btn-primary" type="button" @click="copyLink">Copy plan link</button>
          <button class="btn btn-ghost" type="button" @click="copySummary">Copy text summary</button>
        </div>
      </section>
    </template>

    <!-- 6. Saved plans -->
    <section class="card">
      <PlannerSavedPlans
        :plans="savedPlans"
        :current-id="currentPlanId"
        :current-name="currentPlanName"
        :has-goals="goals.length > 0"
        :import-result="importResult"
        @save="(n) => saveCurrent(n, false)"
        @save-new="(n) => saveCurrent(n, true)"
        @load="loadSaved"
        @duplicate="duplicateSaved"
        @export="exportSaved"
        @delete="deleteSaved"
        @rename="renameSaved"
        @import="importSaved"
      />
    </section>

    <PlannerAddGoal v-if="showAdd" :player="player" :existing-skills="goals.map((g) => g.skill)" :global-strategy="globalStrategy" :gp-value="gpValue" @add="addGoal" @close="showAdd = false" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PlannerRoute from '@/components/planner/PlannerRoute.vue'
import PlannerGoalCard from '@/components/planner/PlannerGoalCard.vue'
import PlannerAddGoal from '@/components/planner/PlannerAddGoal.vue'
import PlannerBudget from '@/components/planner/PlannerBudget.vue'
import PlannerTimeline from '@/components/planner/PlannerTimeline.vue'
import PlannerSavedPlans from '@/components/planner/PlannerSavedPlans.vue'
import { usePlayersStore } from '@/stores/players'
import { playersApi } from '@/api/players'
import PlayerSuggestRow from '@/components/PlayerSuggestRow.vue'
import RecentPlayers from '@/components/RecentPlayers.vue'
import { recordRecent } from '@/composables/useRecentPlayers'
import { useToast } from '@/composables/useToast'
import { setPageMeta } from '@/utils/pageMeta'
import { track } from '@/utils/analytics'
import { SKILL_NAMES, skillIconSrc } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'
import {
  planGoal,
  planTotals,
  compareStrategies,
  profitableMethods,
  levelAtXp,
  tradeoff,
  tradeoffText,
  AUTO_FAST,
  AUTO_CHEAP,
  AUTO_BALANCED,
  AUTO_PROFIT,
  GLOBAL_STRATEGY,
  GLOBAL_STRATEGIES,
  DEFAULT_GP_VALUE,
  formatNum,
  formatHours,
  formatGp,
  encodePlan,
  decodePlan,
} from '@/utils/planner'
import {
  STRATEGY_LABELS,
  resolveGoal,
  optimiseBudget,
  startingGpNeeded,
  buildTimeline,
  listSavedPlans,
  snapshotPlan,
  savePlan,
  deletePlan,
  renamePlan,
  duplicatePlan,
  exportPlan,
  importPlan,
  validatePlan,
} from '@/utils/plannerTools'

const store = usePlayersStore()
const route = useRoute()
const router = useRouter()
const { showToast } = useToast()

setPageMeta({
  title: 'OSRS Account Planner & XP Calculator',
  description:
    'Plan your Old School RuneScape skill goals. Calculate XP remaining, training hours, and GP costs using your OSRS username. Free OSRS account planner.',
  path: '/planner',
})

const STORAGE_KEY = 'tickgains-planner-v1'
const STRATEGY_HINTS = {
  [AUTO_FAST]: 'Minimises training time, whatever it costs.',
  [AUTO_CHEAP]: 'Minimises net gp spent, even if it is slower.',
  [AUTO_BALANCED]: 'A middle ground between speed and cost: not the slowest route, not the most expensive.',
}

// --- Player -----------------------------------------------------------------
const username = ref('')
const player = ref(null)
const editingPlayer = ref(false)
const lookingUp = ref(false)
const lookupError = ref('')

// A way back to the profile you came from: the loaded player, or ?u= from a profile link.
const cameFromProfile = typeof window !== 'undefined' && String(window.history.state?.back || '').startsWith('/player/')
const backName = computed(() => player.value?.displayName || (typeof route.query.u === 'string' ? route.query.u : ''))
function goBack() {
  if (cameFromProfile) return router.back()
  const target = player.value?.username || route.query.u
  router.push({ name: 'playerDetail', params: { username: target } })
}

function startChangePlayer() {
  editingPlayer.value = true
  username.value = ''
  lookupError.value = ''
}

const searchFocused = ref(false)
// Typeahead: partial, case-insensitive matches among already-tracked players.
const suggestions = ref([])
let suggestTimer = null
watch(username, (q) => {
  clearTimeout(suggestTimer)
  const term = (q || '').trim()
  if (term.length < 2 || (player.value && term.toLowerCase() === player.value.displayName.toLowerCase())) {
    suggestions.value = []
    return
  }
  suggestTimer = setTimeout(async () => {
    try {
      const rows = await playersApi.search(term)
      if ((username.value || '').trim() === term) suggestions.value = rows
    } catch {
      suggestions.value = []
    }
  }, 250)
})
function pickSuggestion(sg) {
  track('search_suggestion_selected', { source: 'planner' })
  suggestions.value = []
  username.value = sg.displayName
  loadPlayer()
}

async function loadPlayer() {
  suggestions.value = []
  const name = username.value.trim()
  if (!name) return
  // OSRS names: 1-12 letters, digits, spaces, hyphens or underscores.
  if (!/^[A-Za-z0-9 _-]{1,12}$/.test(name)) {
    lookupError.value = 'Usernames are 1–12 characters: letters, numbers, spaces, hyphens or underscores.'
    return
  }
  lookingUp.value = true
  lookupError.value = ''
  track('player_search', { source: 'planner', username_length: name.length })
  try {
    if (!store.loaded) await store.loadPlayers()
    const find = () => store.players.find((p) => p.username.toLowerCase() === name.toLowerCase())
    // Existing TickGains players load straight from the database; unknown ones are added through the
    // normal tracking flow (Hiscores lookup + history import), so searching here also starts tracking them.
    const wasNew = !find()
    if (wasNew) {
      await store.addPlayer(name)
      track('player_added', { source: 'planner', is_new_player: true })
    }
    const found = find()
    track('planner_player_loaded', { result: wasNew ? 'new' : 'existing' })
    if (!found?.latest) throw new Error('No stats found for that player yet.')
    player.value = found
    recordRecent(found)
    username.value = found.displayName
    editingPlayer.value = false
    // Goals keep the stats they were created with. Newer stats are offered through "Refresh from player stats".
    if (!goals.value.length) statsAt.value = found.latest.capturedAt
  } catch (err) {
    lookupError.value = err?.message || 'Could not find that player on the OSRS Hiscores.'
    track('player_search_result', { source: 'planner', result: 'error' })
  } finally {
    lookingUp.value = false
  }
}

const playerXp = (skill) => player.value?.latest?.skills?.[skill]?.xp ?? null

// --- Plan state ---------------------------------------------------------------
const goals = ref([])
const hoursPerDay = ref(2)
const globalStrategy = ref(AUTO_FAST)
const gpValue = ref(DEFAULT_GP_VALUE)
const budget = ref(null)
const statsAt = ref(null)
const calcAt = ref(new Date())
const expanded = ref(new Set())
const showAdd = ref(false)

const overrideCount = computed(() => goals.value.filter((g) => g.methodId !== GLOBAL_STRATEGY).length)

const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches

// Goals (with the global strategy applied) and their results. Results are cached by inputs so a change only
// recalculates the goals it touches.
const resolved = computed(() => goals.value.map((g) => resolveGoal(g, globalStrategy.value, gpValue.value)))
const planCache = new Map()
const compareCache = new Map()
function memo(cache, key, fn) {
  if (cache.has(key)) return cache.get(key)
  const value = fn()
  if (cache.size > 300) cache.clear()
  cache.set(key, value)
  return value
}
const goalKey = (g, withMethod) => JSON.stringify([g.skill, g.currentXp, g.targetXp, withMethod ? g.methodId : '', withMethod ? g.customXpPerHour : '', g.quests, g.gpValuePerHour, g.allowedMethodIds || null])
const plans = computed(() => resolved.value.map((g) => memo(planCache, goalKey(g, true), () => planGoal(g))))
const compares = computed(() => resolved.value.map((g) => memo(compareCache, goalKey(g, false), () => compareStrategies(g))))
const totals = computed(() => planTotals(plans.value, hoursPerDay.value))

const strategyTotals = (key) => planTotals(compares.value.map((c) => c[key]), hoursPerDay.value)
const planStrategies = computed(() => (goals.value.length ? { fast: strategyTotals('fast'), cheap: strategyTotals('cheap'), balanced: strategyTotals('balanced'), profit: strategyTotals('profit') } : null))
const strategyRows = computed(() => {
  const st = planStrategies.value
  if (!st) return []
  const rows = [
    { id: AUTO_FAST, label: 'Fastest routes', totals: st.fast },
    { id: AUTO_CHEAP, label: 'Cheapest routes', totals: st.cheap },
    { id: AUTO_BALANCED, label: 'Balanced routes', totals: st.balanced },
  ]
  if (goals.value.some((g) => profitableMethods(g.skill, levelAtXp(g.currentXp, true), levelAtXp(g.targetXp, true)).length)) rows.push({ id: AUTO_PROFIT, label: 'Most profitable routes', totals: st.profit })
  return rows
})
const strategyVerdict = computed(() => {
  const st = planStrategies.value
  if (!st) return ''
  return tradeoffText(tradeoff({ hours: st.fast.totalHours, netGp: st.fast.netGp }, { hours: st.cheap.totalHours, netGp: st.cheap.netGp }))
})

// --- Budget ---------------------------------------------------------------------
const budgetResult = computed(() => (budget.value ? optimiseBudget(resolved.value, budget.value) : null))
const budgetStartNeeded = computed(() => {
  const r = budgetResult.value
  if (!r || !r.picks.length) return 0
  const bySkill = new Map(r.picks.map((p) => [p.skill, p.option.plan]))
  return startingGpNeeded(goals.value.map((g) => bySkill.get(g.skill) || plans.value[goals.value.indexOf(g)]))
})
function applyBudget(picks) {
  for (const p of picks) {
    const g = goals.value.find((x) => x.skill === p.skill)
    if (g) g.methodId = p.option.methodId === globalStrategy.value ? GLOBAL_STRATEGY : p.option.methodId
  }
  track('planner_budget_applied', { skills: picks.length })
  showToast('Applied the budget routes to your goals.')
}
watch(budget, (b, prev) => {
  if (b && !prev) track('planner_budget_set')
})

// --- Timeline ------------------------------------------------------------------
const timeline = computed(() => buildTimeline(goals.value, plans.value, hoursPerDay.value))

// --- Goals ----------------------------------------------------------------------
function openAdd() {
  showAdd.value = true
  track('planner_add_goal_open')
}
function addGoal(goal) {
  if (goals.value.some((g) => g.skill === goal.skill)) return
  goals.value.push(goal)
  expanded.value = new Set([goal.skill])
  showAdd.value = false
  if (player.value && !statsAt.value) statsAt.value = player.value.latest.capturedAt
  track('planner_goal_added', { skill: goal.skill, method: goal.methodId })
}
function removeGoal(i) {
  track('planner_goal_removed', { skill: goals.value[i]?.skill })
  const [gone] = goals.value.splice(i, 1)
  expanded.value.delete(gone.skill)
  expanded.value = new Set(expanded.value)
}
function moveGoal(i, dir) {
  const j = i + dir
  if (j < 0 || j >= goals.value.length) return
  const next = [...goals.value]
  ;[next[i], next[j]] = [next[j], next[i]]
  goals.value = next
  track('planner_goal_reordered')
}
function patchGoal(i, patch) {
  Object.assign(goals.value[i], patch)
  if (patch.methodId) track('planner_method_changed', { skill: goals.value[i].skill, method: patch.methodId })
}
function pickRoute(i, id) {
  goals.value[i].methodId = id === globalStrategy.value ? GLOBAL_STRATEGY : id
  track('planner_route_picked', { skill: goals.value[i].skill, method: id })
}
function toggleExpanded(skill) {
  const next = new Set(expanded.value)
  if (next.has(skill)) next.delete(skill)
  else next.add(skill)
  expanded.value = next
}
function setGlobalStrategy(s) {
  globalStrategy.value = s
  track('planner_strategy_changed', { strategy: s })
}
function resetAllOverrides() {
  for (const g of goals.value) g.methodId = GLOBAL_STRATEGY
}

// --- Player stat refresh ------------------------------------------------------
// Only ever offered, never applied automatically. XP can only go up, targets and strategies are untouched.
const staleXpFor = (g) => {
  const xp = playerXp(g.skill)
  return xp != null && xp > g.currentXp ? xp : null
}
const staleCount = computed(() => goals.value.filter((g) => staleXpFor(g) != null).length)
function refreshGoal(i) {
  const xp = staleXpFor(goals.value[i])
  if (xp != null) goals.value[i].currentXp = xp
}
function refreshFromPlayer() {
  let changed = 0
  for (const g of goals.value) {
    const xp = staleXpFor(g)
    if (xp != null) {
      g.currentXp = xp
      changed++
    }
  }
  if (player.value) statsAt.value = player.value.latest.capturedAt
  track('planner_refresh_stats', { skills: changed })
  showToast(`Refreshed ${changed} skill${changed === 1 ? '' : 's'} from ${player.value?.displayName}'s stats.`)
}

// --- Helpers ----------------------------------------------------------------------
function gpClass(gp) {
  if (gp == null) return ''
  return gp >= 0 ? 'planner-gain' : 'planner-cost'
}

// --- Share ------------------------------------------------------------------------
function planState() {
  return { username: player.value?.username || username.value, hoursPerDay: hoursPerDay.value, goals: goals.value, strategy: globalStrategy.value, gpValue: gpValue.value, budget: budget.value }
}
function planUrl() {
  const params = encodePlan({ ...planState(), username: player.value?.username || '' })
  return `${window.location.origin}/planner?${params.toString()}`
}
async function copy(text, message) {
  try {
    await navigator.clipboard.writeText(text)
    showToast(message)
  } catch {
    showToast('Could not copy, select and copy manually.')
  }
}
function copyLink() {
  track('planner_share', { method: 'link', goals: goals.value.length })
  copy(planUrl(), 'Plan link copied')
}
function copySummary() {
  track('planner_share', { method: 'summary', goals: goals.value.length })
  const lines = goals.value.map((g, i) => {
    const p = plans.value[i]
    return `${g.skill} ${levelAtXp(g.currentXp, true)} → ${levelAtXp(g.targetXp, true)}: ${formatHours(p.hours)}, ${formatNum(p.remainingXp)} xp${p.netGp != null ? `, ${formatGp(p.netGp)}` : ''}`
  })
  const t = totals.value
  const text = [
    `${player.value ? player.value.displayName + "'s " : ''}OSRS plan | TickGains Account Planner`,
    ...lines,
    `Total: ${formatNum(t.totalXp)} xp · ${formatHours(t.totalHours)}${t.netGp != null ? ` · ${formatGp(t.netGp)}` : ''}${t.days != null ? ` · ~${t.days.toLocaleString('en-US')} days at ${hoursPerDay.value}h/day` : ''}`,
    planUrl(),
  ].join('\n')
  copy(text, 'Summary copied')
}

// --- Saved plans (browser storage) ---------------------------------------------------
const savedPlans = ref(listSavedPlans())
const currentPlanId = ref('')
const currentPlanName = ref('')
const importResult = ref(null)
const refreshSaved = () => (savedPlans.value = listSavedPlans())

function currentSnapshotState() {
  return {
    rsn: player.value?.displayName || username.value,
    playerId: player.value?.id ?? null,
    statsAt: statsAt.value,
    globalStrategy: globalStrategy.value,
    gpValue: gpValue.value,
    budget: budget.value,
    hoursPerDay: hoursPerDay.value,
    goals: goals.value,
  }
}
function saveCurrent(name, asNew) {
  const existing = !asNew && currentPlanId.value ? savedPlans.value.find((p) => p.id === currentPlanId.value) || {} : {}
  const plan = savePlan(snapshotPlan(currentSnapshotState(), name || currentPlanName.value, existing))
  if (!plan) return showToast('Could not save, browser storage is unavailable.')
  currentPlanId.value = plan.id
  currentPlanName.value = plan.name
  refreshSaved()
  track('planner_plan_saved', { goals: plan.goals.length })
  showToast(`Saved "${plan.name}".`)
}
function applyPlan(plan) {
  goals.value = plan.goals.map((g) => ({ ...g, quests: [...g.quests] }))
  hoursPerDay.value = plan.hoursPerDay
  globalStrategy.value = plan.globalStrategy
  gpValue.value = plan.gpValue
  budget.value = plan.budget
  statsAt.value = plan.statsAt
  expanded.value = isMobile() || !goals.value.length ? new Set() : new Set([goals.value[0].skill])
}
async function loadSaved(stored) {
  const res = validatePlan(stored)
  if (res.error) return showToast(res.error)
  applyPlan(res.plan)
  currentPlanId.value = res.plan.id
  currentPlanName.value = res.plan.name
  if (res.warnings.length) showToast(res.warnings[0])
  // Load the player so newer stats can be offered, the saved starting values stay as they were.
  if (res.plan.player.rsn) {
    username.value = res.plan.player.rsn
    await loadPlayer()
  }
  track('planner_plan_loaded', { goals: res.plan.goals.length })
  showToast(`Loaded "${res.plan.name}".`)
}
function duplicateSaved(id) {
  const copy = duplicatePlan(id)
  refreshSaved()
  if (copy) showToast(`Duplicated as "${copy.name}".`)
}
function renameSaved(id, name) {
  const p = renamePlan(id, name)
  if (p && id === currentPlanId.value) currentPlanName.value = p.name
  refreshSaved()
}
function deleteSaved(id) {
  deletePlan(id)
  if (id === currentPlanId.value) currentPlanId.value = ''
  refreshSaved()
}
function exportSaved(plan) {
  const blob = new Blob([exportPlan(plan)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${plan.name.replace(/[^A-Za-z0-9 _-]+/g, '').trim().replace(/\s+/g, '-') || 'tickgains-plan'}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  track('planner_plan_exported')
}
function importSaved(text) {
  importResult.value = importPlan(text)
  refreshSaved()
  if (!importResult.value.error) track('planner_plan_imported')
}

// --- Persistence ----------------------------------------------------------------------
// Keep the address bar + localStorage in sync so a refresh or a shared link restores the plan.
function setRobots(content) {
  let tag = document.querySelector('meta[name="robots"]')
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('name', 'robots')
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

watch(
  [goals, hoursPerDay, player, globalStrategy, gpValue, budget],
  () => {
    calcAt.value = new Date()
    const state = planState()
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, statsAt: statsAt.value }))
    } catch {
      /* storage unavailable, URL sharing still works */
    }
    // history.replaceState (not router.replace) so syncing the URL never triggers the router's scroll-to-top.
    const qs = goals.value.length ? `?${encodePlan(state).toString()}` : ''
    window.history.replaceState(window.history.state, '', `/planner${qs}`)
    setRobots(goals.value.length ? 'noindex, follow' : 'index, follow')
  },
  { deep: true },
)

onMounted(async () => {
  let restored = null
  if (route.query.g) restored = decodePlan(route.query, SKILL_NAMES)
  else if (typeof route.query.u === 'string') restored = { username: route.query.u, goals: [], hoursPerDay: 2 }
  else {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (saved && Array.isArray(saved.goals)) {
        // Plans stored before global strategies pinned every goal to a method; the old default now follows the global strategy.
        saved.goals = saved.goals.map((g) => ({ ...g, methodId: g.methodId === AUTO_FAST || !g.methodId ? GLOBAL_STRATEGY : g.methodId, quests: g.quests || [], customXpPerHour: g.customXpPerHour || 0 }))
        restored = saved
      }
    } catch {
      restored = null
    }
  }
  if (restored) {
    goals.value = restored.goals || []
    hoursPerDay.value = restored.hoursPerDay || 2
    username.value = restored.username || ''
    if (GLOBAL_STRATEGIES.includes(restored.strategy)) globalStrategy.value = restored.strategy
    if (restored.gpValue > 0) gpValue.value = restored.gpValue
    budget.value = restored.budget || null
    statsAt.value = restored.statsAt || null
  }
  // Only one goal card is open by default (none on phones).
  if (goals.value.length && !isMobile()) expanded.value = new Set([goals.value[0].skill])
  // Re-hydrate a previously-loaded username so the header and refresh offer reflect the latest snapshot.
  if (username.value) await loadPlayer()
})
</script>
