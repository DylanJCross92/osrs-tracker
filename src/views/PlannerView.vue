<template>
  <div class="planner">
    <!-- 1. Player selection -->
    <section class="card planner-top">
      <div class="pt-head">
        <div class="pt-title">
          <h1>Account Planner</h1>
          <p>Set skill goals, compare routes, and watch your progress.</p>
        </div>
        <a v-if="backName" href="#" class="pt-back" @click.prevent="goBack">← {{ backName }}'s profile</a>
      </div>

      <div v-if="player && !editingPlayer" class="pt-player">
        <span class="pt-avatar"><PlayerAvatar :name="player.username" /></span>
        <div class="pt-player-main">
          <b>{{ player.displayName }}</b>
          <span class="pt-stats">
            <span>Total level <i>{{ player.latest.overallLevel.toLocaleString('en-US') }}</i></span>
            <span><i>{{ formatNum(player.latest.overallXp) }}</i> XP</span>
            <span>Updated {{ formatRelative(player.latest.capturedAt) }}</span>
          </span>
        </div>
        <div class="pt-player-actions">
          <RouterLink class="pt-link" :to="{ name: 'playerDetail', params: { username: player.username } }">Profile</RouterLink>
          <button class="pt-link" type="button" @click="startChangePlayer">Change</button>
        </div>
      </div>
      <template v-else>
        <div class="suggest-wrap pt-find">
          <form class="add-player-form" autocomplete="off" @submit.prevent="loadPlayer({ typed: true })">
            <input v-model="username" type="search" name="osrs-player-lookup" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="Your OSRS name" autocomplete="off" maxlength="12" :disabled="lookingUp" data-1p-ignore data-lpignore="true" @focus="searchFocused = true" @blur="searchFocused = false" />
            <button class="btn btn-primary" type="submit" :disabled="lookingUp || !username.trim()">{{ lookingUp ? 'Finding…' : 'Find player' }}</button>
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
        <p v-else class="pt-hint">No name? Skip this and enter your level or XP when you add a goal. Only need one skill? Try the <RouterLink to="/calculators">skill calculators</RouterLink>.</p>
      </template>

      <div v-if="template" class="ps-template" role="status">
        <span>
          Using <b>{{ template.name }}</b><template v-if="template.rsn"> by {{ template.rsn }}</template>.
          <template v-if="templatePending">Enter your RSN to start every goal from your own stats.</template>
          <template v-else>Every goal now starts from your current stats. Nothing of the original player's progress was copied.</template>
        </span>
        <button class="btn-text" type="button" @click="template = null">Dismiss</button>
      </div>

    </section>


    <!-- 3. Training goals -->
    <section id="add-goal" class="card planner-goals-card">
      <div class="planner-goals-head">
        <div class="pg-title">
          <h2>Training goals</h2>
          <span v-if="goals.length" class="planner-calc">Calculated {{ formatRelative(calcAt.toISOString()) }}</span>
        </div>
        <PlannerSavedPlans
          :plans="savedPlans"
          :current-id="currentPlanId"
          :current-name="currentPlanName"
          :has-goals="goals.length > 0"
          :dirty="dirty"
          :import-result="importResult"
          @save="(n) => saveCurrent(n, false)"
          @save-new="(n) => saveCurrent(n, true)"
          @load="loadSaved"
          @duplicate="duplicateSaved"
          @export="exportSaved"
          @delete="deleteSaved"
          @rename="renameSaved"
          @import="importSaved"
          @share="openShare"
          @share-current="shareCurrent"
        />
        <button class="btn btn-primary" type="button" @click="openAdd">+ Add Skill Goal</button>
      </div>
      <SharePlanModal v-if="sharing" :plan="sharing" @close="sharing = null" />

      <PlannerProgress
        v-if="progress"
        :progress="progress"
        :updated-at="player?.latest?.capturedAt || ''"
        :baseline-at="statsAt || ''"
        :since="sinceVisit"
        :entries="timeline.entries"
        @rebase="refreshFromPlayer"
      />

      <div v-if="goals.length" class="plan-tiles">
        <div class="plan-tile"><span>XP remaining</span><b>{{ formatNum(totals.totalXp) }}</b><small>{{ goals.length }} skill{{ goals.length === 1 ? '' : 's' }}</small></div>
        <div class="plan-tile">
          <span>Training time</span>
          <b>{{ formatHours(totals.totalHours) }}</b>
          <small>{{ totals.days == null ? 'at the planned playtime' : `${totals.days.toLocaleString('en-US')} day${totals.days === 1 ? '' : 's'} at ${hoursPerDay} h/day` }}</small>
        </div>
        <div class="plan-tile">
          <span>Net GP</span>
          <b :class="gpClass(totals.netGp)">{{ totals.netGp == null ? 'No GP data' : formatGp(totals.netGp) }}</b>
          <small v-if="totals.gpIncomplete && totals.netGp != null" class="gp-incomplete">Incomplete: some steps are unpriced</small>
          <small v-else-if="totals.netGp != null">{{ totals.netGp >= 0 ? 'estimated profit' : 'estimated cost' }}</small>
        </div>
      </div>

      <!-- How long you play each day: the one number that moves every date below -->
      <div class="playtime" role="group" aria-label="Daily playtime">
        <div class="playtime-main">
          <span class="playtime-label">Hours played per day</span>
          <div class="playtime-presets">
            <button v-for="h in PLAYTIME_PRESETS" :key="h" type="button" :class="{ active: hoursPerDay === h }" :aria-pressed="hoursPerDay === h" @click="setHours(h)">{{ h }}h</button>
          </div>
          <div class="playtime-stepper">
            <button type="button" aria-label="Half an hour less" :disabled="hoursPerDay <= MIN_HOURS" @click="setHours(hoursPerDay - 0.5)">−</button>
            <input type="number" inputmode="decimal" step="0.5" :min="MIN_HOURS" :max="MAX_HOURS" :value="hoursPerDay" aria-label="Hours played per day" @change="onHoursTyped" />
            <span>h</span>
            <button type="button" aria-label="Half an hour more" :disabled="hoursPerDay >= MAX_HOURS" @click="setHours(hoursPerDay + 0.5)">+</button>
          </div>
        </div>
        <input class="playtime-slider" type="range" min="0.5" max="12" step="0.5" :value="Math.min(hoursPerDay, 12)" aria-label="Daily playtime in hours" @input="setHours(Number($event.target.value))" />
      </div>

      <PlannerTimeline v-if="goals.length" :timeline="timeline" :hours-per-day="hoursPerDay">
        <div class="strategy-pick" role="group" aria-label="Training strategy for all goals">
          <span class="strategy-label">Strategy for all goals</span>
          <div class="range-tabs strategy-tabs">
            <button v-for="s in GLOBAL_STRATEGIES" :key="s" type="button" :class="{ active: globalStrategy === s }" :aria-pressed="globalStrategy === s" :title="STRATEGY_HINTS[s]" @click="setGlobalStrategy(s)">{{ STRATEGY_LABELS[s] }}</button>
          </div>
          <button v-if="overrideCount" class="btn-text strategy-reset" type="button" @click="resetAllOverrides">Reset {{ overrideCount }} override{{ overrideCount === 1 ? '' : 's' }}</button>
        </div>
        <div class="req-summary">
          <label class="req-toggle" title="When on, the planner does not suggest methods you have said you cannot use. Methods you pick yourself are always used.">
            <input v-model="respect" type="checkbox" />
            <span>Skip methods I can't use yet</span>
          </label>
          <span v-if="routeIssues.blocked" class="req-flag is-unmet">⚠ {{ routeIssues.blocked }} goal{{ routeIssues.blocked === 1 ? '' : 's' }} use a method with a missing requirement</span>
          <span v-else-if="routeIssues.unconfirmed" class="req-flag is-unknown">? {{ routeIssues.unconfirmed }} goal{{ routeIssues.unconfirmed === 1 ? '' : 's' }} have requirements to confirm</span>
        </div>
      </PlannerTimeline>

      <div v-if="goals.length" ref="goalListEl" class="goal-list" :class="{ dragging: !!dragSkill }">
        <div v-for="(g, i) in goals" :key="g.skill" class="goal-row" :data-skill="g.skill" :class="{ dragged: dragSkill === g.skill }">
        <PlannerGoalRail :entry="timeline.entries[i]" :total-hours="timeline.totalHours" :first="i === 0" :roomy="expanded.has(g.skill)" />
        <PlannerGoalCard
          :goal="g"
          :plan="plans[i]"
          :compare="compares[i]"
          :global-strategy="globalStrategy"
          :gp-value="gpValue"
          :hours-per-day="hoursPerDay"
          :expanded="expanded.has(g.skill)"
          :index="i"
          :count="goals.length"
          :live-goal="liveGoals[i]"
          :progress="progress ? progress.per[i] : null"
          @toggle="toggleExpanded(g.skill)"
          @remove="removeGoal(i)"
          @move="(dir) => moveGoal(i, dir)"
          @drag-start="(e) => startDrag(g.skill, e)"
          @patch="(patch) => patchGoal(i, patch)"
          @pick="(id) => pickRoute(i, id)"
        />
        </div>
      </div>
      <button v-if="goals.length" class="goal-add-bottom" type="button" @click="openAdd">+ Add another skill</button>
      <div v-if="!goals.length" class="planner-empty">
        <p class="empty-hint">Add your first skill goal to start a plan.</p>
        <button class="btn btn-primary" type="button" @click="openAdd">+ Add Skill Goal</button>
      </div>
    </section>

    <template v-if="goals.length">
      <!-- 4. Whole-plan strategy comparison -->
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
      </section>

      <!-- 5. Itemised steps and sharing -->
      <section class="card">
        <h2 class="planner-itemised-title">Itemised steps and costs</h2>
        <div v-for="(g, i) in goals" :key="g.skill" class="receipt-items">
          <h3><img :src="skillIconSrc(g.skill)" :alt="g.skill" width="18" height="18" /> {{ g.skill }}</h3>
          <PlannerRoute :segments="plans[i].segments" />
        </div>
        <p class="planner-hint">GP and time figures are rough estimates from approximate community rates, not guarantees. GP is net per hour of training, so it already nets out supplies and any loot.</p>
        <div class="planner-share">
          <button class="btn btn-primary" type="button" @click="copyLink">Copy plan link</button>
          <button class="btn btn-ghost" type="button" @click="copySummary">Copy text summary</button>
        </div>
      </section>
    </template>


    <PlannerAddGoal v-if="showAdd" :player="player" :existing-skills="goals.map((g) => g.skill)" :global-strategy="globalStrategy" :gp-value="gpValue" @add="addGoal" @close="showAdd = false" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PlannerRoute from '@/components/planner/PlannerRoute.vue'
import PlannerGoalCard from '@/components/planner/PlannerGoalCard.vue'
import PlannerAddGoal from '@/components/planner/PlannerAddGoal.vue'
import PlannerTimeline from '@/components/planner/PlannerTimeline.vue'
import PlannerGoalRail from '@/components/planner/PlannerGoalRail.vue'
import PlannerProgress from '@/components/planner/PlannerProgress.vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import SharePlanModal from '@/components/planner/SharePlanModal.vue'
import { sharedPlansApi } from '@/api/sharedPlans'
import { useRivals } from '@/composables/useRivals'
import { useRequirements } from '@/composables/useRequirements'
import { plannerRequirementContext } from '@/composables/plannerRequirementContext'
import { blockedMethodIds, methodAvailability } from '@/utils/requirements'
import { TRAINING_METHODS } from '@/data/trainingMethods'
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
import { readVisit, writeVisit, gainedSince } from '@/utils/plannerVisits'
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
  buildTimeline,
  buildProgress,
  liveGoalFor,
  listSavedPlans,
  snapshotPlan,
  savePlan,
  planFingerprint,
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
  loadPlayer({ typed: true })
}

let playersFreshened = false
// `typed` is true when the user searched for this name; restoring a saved plan loads the player without it.
async function loadPlayer({ typed = false } = {}) {
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
    // Re-read the player list once per planner visit so the plan shows the newest tracked XP.
    if (!store.loaded || !playersFreshened) {
      await store.loadPlayers()
      playersFreshened = true
    }
    const find = () => store.players.find((p) => p.username.toLowerCase() === name.toLowerCase())
    // Existing TickGains players load straight from the database; unknown ones are added through the
    // normal tracking flow (Hiscores lookup + history import), so searching here also starts tracking them.
    const wasNew = !find()
    if (wasNew) {
      await store.addPlayer(name)
      track('player_added', { source: 'planner', is_new_player: true, player_name: name })
    }
    const found = find()
    track('planner_player_loaded', { result: wasNew ? 'new' : 'existing' })
    if (!found?.latest) throw new Error('No stats found for that player yet.')
    player.value = found
    if (typed) recordRecent(found)
    username.value = found.displayName
    editingPlayer.value = false
    if (templatePending.value) personalizeTemplate()
    // Goals keep the stats they were created with, and progress is measured from them.
    else if (!goals.value.length) statsAt.value = found.latest.capturedAt
    // A plan from a link that does not say when it started: if every goal starts exactly at this player's current XP, it was
    // made from these stats, so tracking can begin from them.
    else if (!statsAt.value && goals.value.every((g) => g.currentXp === found.latest.skills?.[g.skill]?.xp)) statsAt.value = found.latest.capturedAt
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
function onHoursTyped(e) {
  const raw = e.target.value
  if (raw !== '') setHours(Number(raw))
  e.target.value = hoursPerDay.value // snap the box back to the real value (also fixes blanks and out of range numbers)
}
const PLAYTIME_PRESETS = [1, 2, 3, 4, 6, 8]
const MIN_HOURS = 0.5
const MAX_HOURS = 24
// Typed, stepped or dragged: always lands on a half hour between 0.5 and 24.
function setHours(v) {
  if (!Number.isFinite(v)) return
  hoursPerDay.value = Math.min(MAX_HOURS, Math.max(MIN_HOURS, Math.round(v * 2) / 2))
}
const globalStrategy = ref(AUTO_FAST)
const gpValue = ref(DEFAULT_GP_VALUE)
const statsAt = ref(null)
const calcAt = ref(new Date())
const expanded = ref(new Set())
const showAdd = ref(false)

const overrideCount = computed(() => goals.value.filter((g) => g.methodId !== GLOBAL_STRATEGY).length)

const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches

// Goals (with the global strategy applied) and their results. Results are cached by inputs so a change only
// recalculates the goals it touches.
// Goals keep the XP they started from. Once a tracked player is loaded, estimates run from today's tracked XP instead, and
// progress is measured against the original start.
const tracking = computed(() => !!player.value?.latest && !!statsAt.value)
const liveGoals = computed(() => goals.value.map((g) => (tracking.value ? liveGoalFor(g, playerXp(g.skill)) : g)))
// Quest, gear and level requirements. Methods with a confirmed missing requirement are left out of the planner's own
// recommendations (a method the player picks by hand is always used), unless the player turns that off.
const { respect, confirmations, doneQuestIds } = useRequirements()
const reqCtx = computed(() => {
  const skills = player.value?.latest?.skills
  const levels = {}
  if (skills) for (const name of SKILL_NAMES) if (Number.isFinite(skills[name]?.level)) levels[name] = skills[name].level
  return {
    levels: skills ? levels : null,
    planned: Object.fromEntries(goals.value.map((g) => [g.skill, levelAtXp(g.targetXp, true)])),
    confirmations: confirmations.value,
  }
})
provide(plannerRequirementContext, reqCtx)
const blockedIds = computed(() => (respect.value ? blockedMethodIds(TRAINING_METHODS, reqCtx.value) : []))
const withBlocked = (g) => ({ ...g, blockedMethodIds: blockedIds.value, doneQuestIds: doneQuestIds.value })
const resolved = computed(() => liveGoals.value.map((g) => withBlocked(resolveGoal(g, globalStrategy.value, gpValue.value))))
const resolvedOriginal = computed(() => goals.value.map((g) => withBlocked(resolveGoal(g, globalStrategy.value, gpValue.value))))
const planCache = new Map()
const compareCache = new Map()
function memo(cache, key, fn) {
  if (cache.has(key)) return cache.get(key)
  const value = fn()
  if (cache.size > 300) cache.clear()
  cache.set(key, value)
  return value
}
const goalKey = (g, withMethod) => JSON.stringify([g.skill, g.currentXp, g.targetXp, withMethod ? g.methodId : '', withMethod ? g.customXpPerHour : '', g.quests, g.gpValuePerHour, g.allowedMethodIds || null, g.blockedMethodIds || null, g.doneQuestIds || null])
const plans = computed(() => resolved.value.map((g) => memo(planCache, goalKey(g, true), () => planGoal(g))))
const originalPlans = computed(() => resolvedOriginal.value.map((g) => memo(planCache, goalKey(g, true), () => planGoal(g))))
const progress = computed(() => (tracking.value && goals.value.length ? buildProgress(goals.value, liveGoals.value, originalPlans.value, plans.value, hoursPerDay.value, statsAt.value) : null))
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
  if (goals.value.some((g) => profitableMethods(g.skill, levelAtXp(g.currentXp, true), levelAtXp(g.targetXp, true)).length)) rows.push({ id: AUTO_PROFIT, label: 'Best gp per hour routes', totals: st.profit })
  return rows
})
const strategyVerdict = computed(() => {
  const st = planStrategies.value
  if (!st) return ''
  return tradeoffText(tradeoff({ hours: st.fast.totalHours, netGp: st.fast.netGp }, { hours: st.cheap.totalHours, netGp: st.cheap.netGp }))
})

// --- Timeline ------------------------------------------------------------------
// How many goals run through a method the player is missing something for, or has not confirmed yet.
const routeIssues = computed(() => {
  let blocked = 0
  let unconfirmed = 0
  plans.value.forEach((plan) => {
    const states = plan.segments.filter((seg) => seg.method?.requirements).map((seg) => methodAvailability(seg.method, reqCtx.value).state)
    if (states.includes('blocked')) blocked++
    else if (states.includes('unconfirmed')) unconfirmed++
  })
  return { blocked, unconfirmed }
})
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
// --- Drag to reorder (mouse, pen and touch) ------------------------------------
// The grip button starts a drag. The row follows the pointer and the list reorders live whenever the row's centre crosses a
// neighbour's centre, so the rails, dates and finish line update as you move.
const goalListEl = ref(null)
const dragSkill = ref('')
let drag = null
function startDrag(skill, e) {
  if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return
  const row = goalListEl.value?.querySelector(`[data-skill="${skill}"]`)
  if (!row) return
  drag = { skill, grab: e.clientY - row.getBoundingClientRect().top, y: e.clientY, timer: 0, busy: false }
  dragSkill.value = skill
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
  // Also ticks on a timer so holding the pointer near an edge keeps scrolling the page.
  drag.timer = setInterval(dragFrame, 30)
}
function onDragMove(e) {
  if (!drag) return
  drag.y = e.clientY
  dragFrame()
}
async function dragFrame() {
  if (!drag) return
  if (!drag.busy) {
    drag.busy = true
    const list = goalListEl.value
    const row = list?.querySelector(`[data-skill="${drag.skill}"]`)
    if (row) {
      // Scroll the page when the pointer is near the top or bottom edge.
      if (drag.y < 80) window.scrollBy(0, -Math.min(18, (80 - drag.y) / 3 + 4))
      else if (drag.y > window.innerHeight - 80) window.scrollBy(0, Math.min(18, (drag.y - (window.innerHeight - 80)) / 3 + 4))
      row.style.transform = ''
      const rows = [...list.children]
      const idx = rows.indexOf(row)
      const rect = row.getBoundingClientRect()
      const centre = drag.y - drag.grab + rect.height / 2
      const mid = (el) => el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2
      let swap = 0
      if (idx > 0 && centre < mid(rows[idx - 1])) swap = -1
      else if (idx < rows.length - 1 && centre > mid(rows[idx + 1])) swap = 1
      if (swap) {
        moveGoal(idx, swap)
        await nextTick()
      }
      const after = row.getBoundingClientRect()
      row.style.transform = `translateY(${drag.y - drag.grab - after.top}px)`
    }
    if (drag) drag.busy = false
  }
}
function endDrag() {
  if (!drag) return
  clearInterval(drag.timer)
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
  const row = goalListEl.value?.querySelector(`[data-skill="${drag.skill}"]`)
  if (row) row.style.transform = ''
  drag = null
  dragSkill.value = ''
}
onBeforeUnmount(endDrag)

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

// --- Restart tracking ------------------------------------------------------------
// Progress is measured from the stats a plan started with. This moves every goal's start up to today's tracked XP (and the
// start date to when those stats were captured), so progress begins again from 0%. Targets and strategies are untouched.
function refreshFromPlayer() {
  let changed = 0
  for (const g of goals.value) {
    const xp = playerXp(g.skill)
    if (xp != null && xp > g.currentXp) {
      g.currentXp = Math.min(xp, g.targetXp)
      changed++
    }
  }
  if (player.value) statsAt.value = player.value.latest.capturedAt
  track('planner_restart_progress', { skills: changed })
  showToast(`Progress restarted from ${player.value?.displayName}'s stats today.`)
}

// --- Since your last visit -----------------------------------------------------------
// The previous visit is read once per player, and today's tracked XP is stored when the page closes so the next visit can
// say what has been gained since.
const previousVisit = ref(null)
const visitFor = ref('')
watch(
  () => player.value?.username,
  (name) => {
    if (!name || name === visitFor.value) return
    visitFor.value = name
    previousVisit.value = readVisit(name)
  },
  { immediate: true },
)
const trackedXpByGoal = () => {
  const out = {}
  for (const g of goals.value) {
    const xp = playerXp(g.skill)
    if (xp != null) out[g.skill] = xp
  }
  return out
}
const sinceVisit = computed(() => (tracking.value ? gainedSince(previousVisit.value, trackedXpByGoal()) : null))
function rememberVisit() {
  if (!player.value || !goals.value.length) return
  writeVisit(player.value.username, trackedXpByGoal())
}
const onHide = () => document.visibilityState === 'hidden' && rememberVisit()
onMounted(() => document.addEventListener('visibilitychange', onHide))
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onHide)
  rememberVisit()
})

// --- Helpers ----------------------------------------------------------------------
function gpClass(gp) {
  if (gp == null) return ''
  return gp >= 0 ? 'planner-gain' : 'planner-cost'
}

// --- Share ------------------------------------------------------------------------
function planState() {
  return { username: player.value?.username || username.value, hoursPerDay: hoursPerDay.value, goals: goals.value, strategy: globalStrategy.value, gpValue: gpValue.value, budget: null, statsAt: statsAt.value }
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
    return `${g.skill} ${levelAtXp(liveGoals.value[i].currentXp, true)} → ${levelAtXp(g.targetXp, true)}: ${formatHours(p.hours)}, ${formatNum(p.remainingXp)} xp${p.netGp != null ? `, ${formatGp(p.netGp)}` : ''}`
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
    budget: null,
    hoursPerDay: hoursPerDay.value,
    goals: goals.value,
  }
}
// A saved plan keeps what was saved until it is updated: changes made since are "unsaved".
const dirty = computed(() => {
  const saved = savedPlans.value.find((p) => p.id === currentPlanId.value)
  if (!saved) return false
  return planFingerprint(saved) !== planFingerprint({ hoursPerDay: hoursPerDay.value, globalStrategy: globalStrategy.value, gpValue: gpValue.value, goals: goals.value })
})
function saveCurrent(name, asNew) {
  const wasSaved = !asNew && !!currentPlanId.value && savedPlans.value.some((p) => p.id === currentPlanId.value)
  const existing = !asNew && currentPlanId.value ? savedPlans.value.find((p) => p.id === currentPlanId.value) || {} : {}
  const plan = savePlan(snapshotPlan(currentSnapshotState(), name || currentPlanName.value, existing))
  if (!plan) return showToast('Could not save, browser storage is unavailable.')
  currentPlanId.value = plan.id
  currentPlanName.value = plan.name
  refreshSaved()
  track('planner_plan_saved', { goals: plan.goals.length })
  showToast(wasSaved ? `Updated "${plan.name}".` : `Saved "${plan.name}".`)
}
// --- Using someone else's public plan ---------------------------------------------------------
// "Use this plan" opens the planner with ?template=<slug>. The plan's goals, targets, methods, order and strategy come
// across; every goal starts from the new player's own XP, and none of the owner's progress is copied.
const template = ref(null)
const templatePending = ref(false)
const { me } = useRivals()

function personalizeTemplate() {
  if (!player.value?.latest) return
  for (const g of goals.value) {
    const xp = playerXp(g.skill) ?? 0
    g.currentXp = Math.min(xp, g.targetXp)
  }
  statsAt.value = player.value.latest.capturedAt
  templatePending.value = false
  track('planner_template_personalized', { goals: goals.value.length })
}

async function loadTemplate(slug) {
  let share
  try {
    share = (await sharedPlansApi.get(slug)).plan
  } catch {
    showToast('That plan is not shared any more.')
    return false
  }
  // Keep whatever plan was on screen: it is saved before the template replaces it.
  if (goals.value.length) {
    const kept = savePlan(snapshotPlan(currentSnapshotState(), `Plan before using "${share.name}"`.slice(0, 60)))
    if (kept) {
      refreshSaved()
      showToast('Your previous plan was saved to Saved plans.')
    }
  }
  goals.value = share.plan.goals.map((g) => ({
    skill: g.skill,
    currentXp: 0,
    targetXp: g.targetXp,
    methodId: g.methodId,
    customXpPerHour: g.customXpPerHour || 0,
    quests: [...(g.quests || [])],
  }))
  hoursPerDay.value = share.plan.hoursPerDay
  globalStrategy.value = share.plan.globalStrategy
  gpValue.value = share.plan.gpValue
  statsAt.value = null
  currentPlanId.value = ''
  currentPlanName.value = share.name.slice(0, 60)
  template.value = { slug, name: share.name, rsn: share.rsn }
  templatePending.value = true
  expanded.value = new Set()
  // Someone who has saved their own name elsewhere on the site is taken straight to their own numbers.
  if (!username.value && me.value) username.value = me.value
  track('planner_template_used', { goals: goals.value.length })
  return true
}

// --- Sharing a plan publicly ---------------------------------------------------------------
const sharing = ref(null)
function openShare(stored) {
  const res = validatePlan(stored)
  if (res.error) return showToast(res.error)
  sharing.value = res.plan
}
// Sharing the plan on screen: save it first (so the public copy matches what is shown), then open the share window.
function shareCurrent(name) {
  if (!goals.value.length) return
  saveCurrent(name, false)
  const saved = savedPlans.value.find((p) => p.id === currentPlanId.value)
  if (saved) openShare(saved)
}
function applyPlan(plan) {
  goals.value = plan.goals.map((g) => ({ ...g, quests: [...g.quests] }))
  hoursPerDay.value = plan.hoursPerDay
  globalStrategy.value = plan.globalStrategy
  gpValue.value = plan.gpValue
  statsAt.value = plan.statsAt
  expanded.value = isMobile() || !goals.value.length ? new Set() : new Set([goals.value[0].skill])
}
async function loadSaved(stored, { silent = false } = {}) {
  const res = validatePlan(stored)
  if (res.error) return silent ? undefined : showToast(res.error)
  applyPlan(res.plan)
  currentPlanId.value = res.plan.id
  currentPlanName.value = res.plan.name
  if (res.warnings.length && !silent) showToast(res.warnings[0])
  // Load the player so newer stats can be offered, the saved starting values stay as they were.
  if (res.plan.player.rsn) {
    username.value = res.plan.player.rsn
    await loadPlayer()
  }
  track(silent ? 'planner_plan_autoloaded' : 'planner_plan_loaded', { goals: res.plan.goals.length })
  if (!silent) showToast(`Loaded "${res.plan.name}".`)
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
  [goals, hoursPerDay, player, globalStrategy, gpValue, statsAt, currentPlanId],
  () => {
    calcAt.value = new Date()
    const state = planState()
    try {
      // The saved plan this working copy came from is remembered too, so coming back shows it as that plan.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, statsAt: statsAt.value, planId: currentPlanId.value, planName: currentPlanName.value }))
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
    statsAt.value = restored.statsAt || null
  }
  if (typeof route.query.template === 'string') await loadTemplate(route.query.template)
  else if (goals.value.length) {
    // Which saved plan is this? The working copy remembers it. A plan from somebody else's link, or one that matches no saved
    // plan, stays unsaved. The remembered plan is only trusted when the plan on screen is the working copy, never a link.
    let remembered = null
    try {
      remembered = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    } catch {
      remembered = null
    }
    const here = planFingerprint({ hoursPerDay: hoursPerDay.value, globalStrategy: globalStrategy.value, gpValue: gpValue.value, goals: goals.value })
    const sameAsRemembered = remembered && Array.isArray(remembered.goals) && planFingerprint({ hoursPerDay: remembered.hoursPerDay, globalStrategy: remembered.strategy, gpValue: remembered.gpValue, goals: remembered.goals }) === here
    const match = (sameAsRemembered && savedPlans.value.find((p) => p.id === remembered.planId)) || savedPlans.value.find((p) => planFingerprint(p) === here)
    if (match) {
      currentPlanId.value = match.id
      currentPlanName.value = match.name
    }
  } else if (!Object.keys(route.query).length && savedPlans.value.length) {
    // A plain visit with nothing in progress: pick up the most recently saved plan.
    await loadSaved(savedPlans.value[0], { silent: true })
  }
  // Only one goal card is open by default (none on phones).
  if (!template.value && goals.value.length && !isMobile()) expanded.value = new Set([goals.value[0].skill])
  // Re-hydrate a previously-loaded username so the header and refresh offer reflect the latest snapshot.
  if (username.value) await loadPlayer()
})
</script>
