<template>
  <div class="planner">
    <!-- /planner with plans: your plans, each linking to its own address -->
    <PlannerOverview v-if="showOverview" :plans="savedPlans" :progress="overviewProgress" :summaries="overviewSummaries" :progress-loading="progressLoading" @duplicate="duplicateSaved" @delete="deleteSaved" />

    <!-- No plan yet: the player, then a recommended plan or a skill to start from -->
    <template v-else-if="showStart">
      <section class="card planner-top is-start">
        <div class="pt-head">
          <div class="pt-title">
            <span class="pt-badge">Account Planner</span>
            <h1>How long until 99, and what will it cost?</h1>
            <p>Enter your RuneScape name: the fastest route, the time it takes and the cost, from your real stats and live Grand Exchange prices.</p>
            <GePriceBadge class="pt-live" />
          </div>
        </div>
        <PlannerPlayerBox
          v-model:username="username"
          :player="player"
          :editing="editingPlayer"
          :looking-up="lookingUp"
          :lookup-error="lookupError"
          :suggestions="suggestions"
          :show-recent="searchFocused && !username.trim()"
          @submit="loadPlayer({ typed: true })"
          @change="startChangePlayer"
          @cancel="editingPlayer = false"
          @pick="pickSuggestion"
          @focus="searchFocused = true"
          @blur="onSearchBlur"
        >
          <template #hint>
            <p class="pt-hint pt-hint-start">
              <template v-if="lookingUp">Loading stats…</template>
              <template v-else>No sign-up required · Or <a href="#ps-start" @click.prevent="scrollToStart">start without a username</a></template>
            </p>
          </template>
        </PlannerPlayerBox>
      </section>

      <PlannerStart
        :skills="player?.latest?.skills || null"
        :has-player="!!player?.latest"
        :player-label="player?.displayName || ''"
        :hours-per-day="hoursPerDay"
        :global-strategy="globalStrategy"
        :gp-value="gpValue"
        @use="startFromPlan"
        @custom="startCustom"
        @smart="startSmart"
      />
    </template>

    <!-- An address for a plan that is not on this device or account -->
    <section v-else-if="mode === 'plan' && planMissing" class="card po-missing">
      <h1>We could not find that plan</h1>
      <p>Plans are saved in this browser, or on your account when you are logged in. It may have been deleted, or it may be saved on another device.</p>
      <div class="po-missing-actions">
        <RouterLink class="btn btn-primary" :to="{ name: 'planner' }">Your plans</RouterLink>
        <RouterLink v-if="!loggedIn" class="btn btn-ghost" :to="{ name: 'login', query: { next: route.fullPath } }">Log in</RouterLink>
      </div>
    </section>
    <section v-else-if="!showPlan" class="card po-missing" aria-live="polite"><p>Loading your plan…</p></section>

    <!-- The finished plan: clean and read-only -->
    <template v-else>
      <PlannerHero :name="currentPlanName || 'My training plan'" :back-to="{ name: 'planner' }" :player="player" :strategy-label="strategyName" :hours-per-day="hoursPerDay" :goal-count="goals.length" :tailored="tailoredText" @settings="openSettings()">
        <template #actions><PlannerSavedPlans v-bind="savedPlansProps" hide-switcher v-on="savedPlansOn" /></template>
        <template #summary><PlannerFinishLine v-if="!progress" :timeline="timeline" :hours-per-day="hoursPerDay" @see-route="scrollToPath" /></template>
        <p v-if="scratch && !currentPlanId" class="ps-explore" role="status">
          <b>Not saved yet.</b> Press Save plan to keep this plan and start tracking your progress, or share the link.
        </p>
        <!-- A plan that does not know who it is for yet: say what adding a name gives you, with one clear button -->
        <div v-if="template && templatePending" class="callout" role="status">
          <div class="callout-text">
            <b>Make this plan yours</b>
            <span>Right now every skill starts at level 1. Add your RuneScape name and the plan uses your real levels, tracks your progress, and shows how long it will really take.</span>
          </div>
          <button class="btn btn-primary callout-btn" type="button" @click="openSettings(true)">Add my RuneScape name</button>
          <button class="callout-x" type="button" aria-label="Dismiss" title="Dismiss" @click="template = null">✕</button>
        </div>
        <div v-else-if="template && !template.recommendedId" class="ps-template" role="status">
          <span>Using <b>{{ template.name }}</b><template v-if="template.rsn"> by {{ template.rsn }}</template>. Every goal now starts from your current stats. Nothing of the original player's progress was copied.</span>
          <button class="btn-text" type="button" @click="template = null">Dismiss</button>
        </div>
        <!-- Once the plan is saved (in this browser) and there is no name prompt to answer: where an account would keep it -->
        <p v-if="!loggedIn && currentPlanId && !(template && templatePending)" class="ps-account" role="status">
          Saved in this browser. <RouterLink :to="{ name: 'signup', query: { next: route.fullPath } }">Create a free account</RouterLink> to keep it on every device and track your progress.
        </p>
        <p v-if="routeIssues.blocked" class="gb-alert" role="status">
          <span>⚠ {{ routeIssues.blocked }} skill{{ routeIssues.blocked === 1 ? '' : 's' }} use a method you may be missing a requirement for.</span>
          <button class="btn-text" type="button" @click="reviewRequirements">Review requirements</button>
        </p>
      </PlannerHero>

      <!-- The pace chart first, then every skill's steps -->
      <PlannerProgress
        v-if="progress"
        :progress="progress"
        :finish="finishInfo"
        :updated-at="player?.latest?.capturedAt || ''"
        :baseline-at="statsAt || ''"
        :today="gainedTodayNow"
        :hours-per-day="hoursPerDay"
        :projection="shownProjection"
        :series="series"
        :focus="focusIdx >= 0 ? focusSkill : ''"
        @focus="(skill) => (focusSkill = skill)"
        @rebase="refreshFromPlayer"
      />

      <PlannerNext :items="nextItems" :hours-per-day="hoursPerDay" />

      <div id="plan-path"><PlannerPath :goals="goals" :plans="plans" :entries="timeline.entries" :progress="progress" :strategy-label="strategyName" :plan-id="currentPlanId" :highlight="pathOpen" :edit-skill="editSkill" @remove="removeSkillFromMenu" @edit="(skill) => openSkillEditor(skill)" @patch="patchGoalBySkill" @add="openAdd()" @reorder="reorderTo" @reorder-all="applyOrder" :has-player="!!player?.latest" :player-label="player?.displayName || ''">
          <template #editor="{ goal: g, index: i }">
            <PlannerSkillEditor
              :goal="g"
              :plan="plans[i]"
              :compare="compareFor(i)"
              :global-strategy="globalStrategy"
              :gp-value="gpValue"
              :index="i"
              :count="goals.length"
              :live-goal="liveGoals[i]"
              :initial-tab="editTab"
              @patch="(patch) => patchGoal(i, patch)"
              @pick="(id) => pickRoute(i, id)"
              @remove="removeSkill(i)"
              @done="closeSkillEditor"
              @cancel="cancelSkillEditor"
            />
          </template>
          <!-- The planner's own player box inside the Smart order window: recent players, suggestions, Enter to load -->
          <template #name-box>
            <PlannerPlayerBox
              v-model:username="username"
              :player="null"
              :looking-up="lookingUp"
              :lookup-error="lookupError"
              :suggestions="suggestions"
              :show-recent="searchFocused && !username.trim()"
              @submit="smartOrderLookup"
              @pick="smartOrderPick"
              @focus="searchFocused = true"
              @blur="onSearchBlur"
            >
              <template #hint><p class="pt-hint">{{ lookingUp ? 'Loading stats…' : 'Press Enter to load your stats' }}</p></template>
            </PlannerPlayerBox>
          </template>
        </PlannerPath></div>
    </template>

    <ConfirmDelete :open="!!skillToDelete" title="Delete this skill?" :name="skillToDelete" :text="currentPlanId ? 'will be removed from this plan, with its route and quest choices. The plan saves right away, so this cannot be undone.' : 'will be removed from this plan, with its route and quest choices.'" cancel-label="Keep skill" confirm-label="Delete skill" @cancel="skillToDelete = ''" @confirm="confirmRemoveSkill" />
    <PlannerPlanSettings v-if="showSettings" :name="currentPlanName" :strategy="globalStrategy" :strategies="STRATEGY_OPTIONS" :hours-per-day="hoursPerDay" :min-hours="MIN_HOURS" :max-hours="MAX_HOURS" :profile="profileOption" @save="saveSettings" @close="closeSettings">
      <template #player>
        <PlannerPlayerBox
          v-model:username="username"
          :player="player"
          :editing="editingPlayer"
          :looking-up="lookingUp"
          :lookup-error="lookupError"
          :suggestions="suggestions"
          :show-recent="searchFocused && !username.trim()"
          @submit="loadPlayer({ typed: true })"
          @change="startChangePlayer"
          @cancel="editingPlayer = false"
          @pick="pickSuggestion"
          @focus="searchFocused = true"
          @blur="onSearchBlur"
        />
      </template>
    </PlannerPlanSettings>
    <SharePlanModal v-if="sharing" :plan="sharing" :auto-publish="sharingAuto" @close="sharing = null" />
    <PlannerAddGoal v-if="showAdd" :initial-skill="addSkill" :player="player" :existing-skills="goals.map((g) => g.skill)" :global-strategy="globalStrategy" :gp-value="gpValue" :blocked-method-ids="blockedIds" :done-quest-ids="doneQuestIds" @add="addGoal" @close="showAdd = false" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PlannerSkillEditor from '@/components/planner/PlannerSkillEditor.vue'
import PlannerNext from '@/components/planner/PlannerNext.vue'
import PlannerPlanSettings from '@/components/planner/PlannerPlanSettings.vue'
import ConfirmDelete from '@/components/ConfirmDelete.vue'
import { smartOrder, smartOrderGoals } from '@/utils/smartOrder'
import { planFromProfile } from '@/utils/smartPlanner'
import { describeProfile } from '@/utils/smartProfile'
import PlannerStart from '@/components/planner/PlannerStart.vue'
import PlannerOverview from '@/components/planner/PlannerOverview.vue'
import { SYNCED_EVENT } from '@/utils/accountData'
import PlannerHero from '@/components/planner/PlannerHero.vue'
import PlannerPath from '@/components/planner/PlannerPath.vue'
import PlannerPlayerBox from '@/components/planner/PlannerPlayerBox.vue'
import { buildSteps, withCompleted } from '@/utils/planSteps'
import { planNext } from '@/utils/planNext'
import PlannerAddGoal from '@/components/planner/PlannerAddGoal.vue'
import PlannerFinishLine from '@/components/planner/PlannerFinishLine.vue'
import PlannerProgress from '@/components/planner/PlannerProgress.vue'
import { recommendedPlans } from '@/utils/recommendedPlans'
import SharePlanModal from '@/components/planner/SharePlanModal.vue'
import { sharedPlansApi } from '@/api/sharedPlans'
import { recordPlanEvent } from '@/utils/planEvents'
import { useRivals } from '@/composables/useRivals'
import { useAuth, waitForAuth } from '@/composables/useAuth'
import { dropProfilePlan, useProfilePlan } from '@/composables/useProfilePlan'
import { useRequirements } from '@/composables/useRequirements'
import { plannerRequirementContext } from '@/composables/plannerRequirementContext'
import { blockedMethodIds, methodAvailability } from '@/utils/requirements'
import { TRAINING_METHODS } from '@/data/trainingMethods'
import PlannerSavedPlans from '@/components/planner/PlannerSavedPlans.vue'
import { usePlayersStore } from '@/stores/players'
import { playersApi } from '@/api/players'
import { recordRecent } from '@/composables/useRecentPlayers'
import { useToast } from '@/composables/useToast'
import { setPageMeta } from '@/utils/pageMeta'
import { track } from '@/utils/analytics'
import { SKILL_NAMES } from '@/utils/osrsSkills'
import {
  planGoal,
  planTotals,
  compareStrategies,
  levelAtXp,
  AUTO_FAST,
  AUTO_CHEAP,
  AUTO_BALANCED,
  GLOBAL_STRATEGY,
  GLOBAL_STRATEGIES,
  DEFAULT_GP_VALUE,
  formatNum,
  formatHours,
  formatGp,
  encodePlan,
  decodePlan,
  suggestedQuests,
} from '@/utils/planner'
import { goalsCode } from '@/utils/goalsCode'
import { referrerSource } from '@/utils/shareEvents'
import { plannedQuestReqIds } from '@/data/quests'
import {
  STRATEGY_LABELS,
  resolveGoal,
  buildTimeline,
  buildProgress,
  summarizePlan,
  projectFinish,
  paceSeries,
  gainedToday,
  liveGoalFor,
  listSavedPlans,
  snapshotPlan,
  savePlan,
  planFingerprint,
  deletePlan,
  renamePlan,
  duplicatePlan,
  validatePlan,
} from '@/utils/plannerTools'
import { useLivePrices } from '@/composables/useLivePrices'
import GePriceBadge from '@/components/GePriceBadge.vue'
import { priceVersion } from '@/utils/priceBook'


// The Grand Exchange prices behind every gp figure on this page.
useLivePrices()
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
// Leaving the box with a name in it loads that player, so stats arrive without a button. Clicking a suggestion or a plan is handled
// by its own click (a load already under way is waited for, never started twice).
function onSearchBlur() {
  searchFocused.value = false
  if (!goals.value.length && !player.value && username.value.trim().length > 1 && !suggestions.value.length) setTimeout(() => !suggestions.value.length && loadTyped(), 150)
}
function pickSuggestion(sg) {
  track('search_suggestion_selected', { source: 'planner' })
  suggestions.value = []
  username.value = sg.displayName
  loadTyped({ force: true })
}

let playersFreshened = false
const OWN_PROFILE_KEY = 'tickgains-planner-own-profile'
function rememberOwnProfile(name) {
  try {
    localStorage.setItem(OWN_PROFILE_KEY, String(name))
  } catch {
    /* storage unavailable */
  }
}
const sameName = (a, b) => String(a || '').toLowerCase().replace(/[\s_-]+/g, '') === String(b || '').toLowerCase().replace(/[\s_-]+/g, '')
// Searching for a player other than the one the plan on screen belongs to (the loaded player, or the player a saved plan was made
// for) drops that plan. Goals entered by hand with no player behind them are kept. On an empty planner, the first player searched
// for gets their own latest plan.
function shouldSwitchPlayer(previous, found) {
  if (previous && !sameName(previous.username, found.username)) return true
  if (currentPlanId.value && openPlanIsForSomeoneElse(found)) return true
  return !previous && !goals.value.length
}
function openPlanIsForSomeoneElse(found) {
  const saved = savedPlans.value.find((p) => p.id === currentPlanId.value)
  const rsn = saved?.player?.rsn
  return !!rsn && !sameName(rsn, found.username) && !sameName(rsn, found.displayName)
}
// Searching for a different player starts over for that player: the old plan is cleared (it stays in Saved plans, if it was
// saved), then that player's most recent saved plan opens, or the planner is left blank with recommended plans to start from.
async function switchPlanToPlayer(found) {
  const was = currentPlanName.value
  goals.value = []
  currentPlanId.value = ''
  currentPlanName.value = ''
  unsavedShareId.value = ''
  template.value = null
  templatePending.value = false
  expanded.value = new Set()
  statsAt.value = found.latest.capturedAt
  track('planner_player_switched', { hadPlan: !!was })
  const theirs = savedPlans.value.find((p) => p.player?.rsn && (sameName(p.player.rsn, found.username) || sameName(p.player.rsn, found.displayName)))
  if (theirs) {
    await loadSaved(theirs, { silent: true })
    showToast(`Opened "${theirs.name}" for ${found.displayName}.`)
  } else {
    showToast(`Now planning for ${found.displayName}.${was ? ` "${was}" is still in Saved plans.` : ''}`)
  }
}
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
  track('player_search', { player: name, source: 'planner', username_length: name.length })
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
      track('player_added', { source: 'planner', is_new_player: true, player: name, player_name: name })
    }
    const found = find()
    track('planner_player_loaded', { result: wasNew ? 'new' : 'existing' })
    if (!found?.latest) throw new Error('No stats found for that player yet.')
    const previous = player.value
    player.value = found
    if (ownsLoadedProfile.value) rememberOwnProfile(found.username)
    if (typed) recordRecent(found)
    username.value = found.displayName
    editingPlayer.value = false
    if (templatePending.value) personalizeTemplate()
    // Searching for a different player (or for the first player on an empty planner): start over for them.
    else if (typed && shouldSwitchPlayer(previous, found)) await switchPlanToPlayer(found)
    // Goals keep the stats they were created with, and progress is measured from them.
    else if (!goals.value.length) statsAt.value = found.latest.capturedAt
    // A saved plan only stays open for the player it was made for. Looking at anyone else (a link from their profile, say)
    // shows the goals as an unsaved plan rather than as the saved one.
    if (currentPlanId.value && openPlanIsForSomeoneElse(found)) {
      currentPlanId.value = ''
      currentPlanName.value = ''
    }
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
    plannedQuests: plannedQuestReqIds(goals.value),
    confirmations: confirmations.value,
  }
})
provide(plannerRequirementContext, reqCtx)
const blockedIds = computed(() => (respect.value ? blockedMethodIds(TRAINING_METHODS, reqCtx.value) : []))
const withBlocked = (g) => ({ ...g, blockedMethodIds: blockedIds.value, doneQuestIds: doneQuestIds.value })
// What the suggested order is worked out with: the planner's own settings and adjustments, so it matches the plans on screen.
const smartOpts = () => ({ globalStrategy: globalStrategy.value, gpValue: gpValue.value, extra: { blockedMethodIds: blockedIds.value, doneQuestIds: doneQuestIds.value } })
// A new goal starts with the short XP quests that pay off for it (or that a method on its route needs anyway).
const withSuggestedQuests = (g) => ({ ...g, quests: suggestedQuests(withBlocked(resolveGoal({ ...g, quests: [] }, globalStrategy.value, gpValue.value))) })
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
const goalKey = (g, withMethod) => JSON.stringify([g.skill, g.currentXp, g.targetXp, withMethod ? g.methodId : '', withMethod ? g.customXpPerHour : '', g.quests, g.gpValuePerHour, g.overrides || null, g.allowedMethodIds || null, g.blockedMethodIds || null, g.doneQuestIds || null, priceVersion.value])
const plans = computed(() => resolved.value.map((g) => memo(planCache, goalKey(g, true), () => planGoal(g))))
// A recommended plan stays in the suggested order until the player arranges it themselves: prices and the player's stats keep arriving
// just after it is made, and the best order follows them.
const keepSmart = ref(false)
watch(plans, (list) => {
  if (!keepSmart.value || !template.value?.recommendedId || goals.value.length < 2 || list.length !== goals.value.length) return
  const { order, changed } = smartOrder(goals.value, list)
  if (!changed) return
  const rank = new Map(order.map((skill, i) => [skill, i]))
  goals.value = [...goals.value].sort((a, b) => rank.get(a.skill) - rank.get(b.skill))
})
const originalPlans = computed(() => resolvedOriginal.value.map((g) => memo(planCache, goalKey(g, true), () => planGoal(g))))
// A plan that is just being explored (not saved to anything) is not tracked: progress only starts once it is saved.
const scratch = ref(false)
const progress = computed(() => (tracking.value && goals.value.length && !(scratch.value && !currentPlanId.value) ? buildProgress(goals.value, liveGoals.value, originalPlans.value, plans.value, hoursPerDay.value, statsAt.value) : null))
// How fast the player has really been gaining XP in these skills (their tracked daily history) and what that means for the finish date.
const history = ref({ id: null, rows: [] })
watch(
  () => [player.value?.id, player.value?.latest?.capturedAt],
  async ([id]) => {
    if (!id) {
      history.value = { id: null, rows: [] }
      return
    }
    try {
      const rows = await playersApi.snapshots(id)
      if (player.value?.id === id) history.value = { id, rows }
    } catch {
      history.value = { id, rows: [] }
    }
  },
  { immediate: true },
)
const projection = computed(() => {
  if (!progress.value || progress.value.complete || history.value.id !== player.value?.id) return null
  const hpd = Number(hoursPerDay.value)
  return projectFinish({
    snapshots: history.value.rows,
    goals: goals.value,
    remainingXp: progress.value.remainingXp,
    plannedDays: hpd > 0 ? progress.value.originalHours / hpd : null,
    baselineAt: statsAt.value,
    per: progress.value.per,
    liveHours: progress.value.liveHours,
  })
})
// The plan against the real history: the chart, and the XP a day it asks for.
// Clicking a skill in the progress bar looks at that skill's part of the plan on its own.
const focusSkill = ref('')
const focusIdx = computed(() => (progress.value && focusSkill.value ? goals.value.findIndex((g) => g.skill === focusSkill.value) : -1))
const series = computed(() => {
  if (!progress.value || progress.value.complete) return null
  return paceSeries({
    only: focusIdx.value,
    snapshots: history.value.id === player.value?.id ? history.value.rows : [],
    goals: goals.value,
    progress: progress.value,
    hoursPerDay: hoursPerDay.value,
    baselineAt: statsAt.value,
    projection: projection.value,
  })
})
// For one skill the finish date is that skill's: planned end of its stretch against when it would really finish.
const shownProjection = computed(() => {
  const pr = projection.value
  const sr = series.value
  if (focusIdx.value < 0 || !pr || pr.status === 'none' || !sr || sr.projectedDay == null) return pr
  const diff = sr.plannedDays - sr.projectedDay
  return { ...pr, diffDays: diff, status: diff > 0.5 ? 'early' : diff < -0.5 ? 'late' : 'on', projected: new Date(sr.baseline.getTime() + sr.projectedDay * 86_400_000), daysLeft: sr.projectedDay - sr.nowDay }
})
const compares = computed(() => resolved.value.map((g) => memo(compareCache, goalKey(g, false), () => compareStrategies(g))))
// One skill's route comparison, worked out only when its editor is open.
const compareFor = (i) => (resolved.value[i] ? memo(compareCache, goalKey(resolved.value[i], false), () => compareStrategies(resolved.value[i])) : {})
const totals = computed(() => planTotals(plans.value, hoursPerDay.value))

// --- Timeline ------------------------------------------------------------------
// How many goals run through a method the player is missing something for, or has not confirmed yet.
const routeIssues = computed(() => {
  let blocked = 0
  let unconfirmed = 0
  const blockedSkills = []
  plans.value.forEach((plan, i) => {
    const states = plan.segments.filter((seg) => seg.method?.requirements).map((seg) => methodAvailability(seg.method, reqCtx.value).state)
    if (states.includes('blocked')) {
      blocked++
      if (goals.value[i]) blockedSkills.push(goals.value[i].skill)
    } else if (states.includes('unconfirmed')) unconfirmed++
  })
  return { blocked, unconfirmed, blockedSkills }
})
const timeline = computed(() => buildTimeline(goals.value, plans.value, hoursPerDay.value))
// The days the plan reaches its next level, next milestone and each goal.
const nextItems = computed(() => planNext(goals.value, plans.value, timeline.value, hoursPerDay.value))
// The same plan as a list of steps, for "what to train next" and the training route checklist.
const liveSteps = computed(() => buildSteps(goals.value, plans.value, timeline.value, hoursPerDay.value))
// For a tracked player the stretches already finished are put back in (marked done) so the route reads as a checklist.
const allSteps = computed(() => withCompleted(liveSteps.value, goals.value, originalPlans.value, tracking.value ? playerXp : null))
const todoSteps = computed(() => allSteps.value.filter((s) => !s.done))

// --- Tabs ----------------------------------------------------------------------------------------
// Which part of the plan is showing. It stays put while goals and methods are edited, and goes back to the overview when a
// different plan is started or opened.
const tab = ref('overview')
const STRATEGY_OPTIONS = GLOBAL_STRATEGIES.map((value) => ({ value, label: STRATEGY_LABELS[value], hint: STRATEGY_HINTS[value] }))
// --- Skill goal filter ----------------------------------------------------------------------------
const goalFilter = ref('all')
// --- Where we are: the address decides -------------------------------------------
// /planner (overview or the start screen), /planner/new, /planner/<id>, /planner/<id>/edit, /planner/<id>/<skill>,
// /planner/<id>/edit/<skill>. A plan that is not saved (a shared link, a plan for someone else's profile) has no address of
// its own and lives at /planner/new.
const mode = computed(() => (route.name === 'planner' ? 'overview' : route.name === 'plannerNew' ? 'new' : 'plan'))
const routeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const routeSkill = computed(() => {
  const raw = typeof route.params.skill === 'string' ? route.params.skill.toLowerCase() : ''
  return SKILL_NAMES.find((n) => n.toLowerCase() === raw) || ''
})
const isEditSkillRoute = computed(() => route.name === 'plannerEditSkill')
const planMissing = ref(false)
const pathOpen = ref('')
const showOverview = computed(() => mode.value === 'overview' && savedPlans.value.length > 0)
const showStart = computed(() => (mode.value === 'overview' && !savedPlans.value.length) || (mode.value === 'new' && !goals.value.length))
const showPlan = computed(() => goals.value.length > 0 && (mode.value === 'new' || (mode.value === 'plan' && currentPlanId.value === routeId.value)))

const planLocation = (id, { edit = false, skill = '' } = {}) => ({
  name: edit ? (skill ? 'plannerEditSkill' : 'plannerEdit') : skill ? 'plannerSkill' : 'plannerPlan',
  params: { id, ...(skill ? { skill: skill.toLowerCase() } : {}) },
})

// --- Editing a skill, and the plan's settings ---------------------------------------
// There is no edit mode for the whole plan. Each skill in the training path has its own editor; the settings that belong to the
// whole plan (name, strategy, hours per day, player) are in a window. A saved plan's open editor has an address of its own.
const editSkillLocal = ref('')
const editSkill = computed(() => {
  if (mode.value === 'plan') return isEditSkillRoute.value && goals.value.some((g) => g.skill === routeSkill.value) ? routeSkill.value : ''
  return editSkillLocal.value
})
const editTab = ref('method')
function openSkillEditor(skill, tab = 'method') {
  editTab.value = tab
  track('planner_skill_edit', { skill })
  if (mode.value === 'plan' && currentPlanId.value) router.replace(planLocation(currentPlanId.value, { edit: true, skill }))
  else editSkillLocal.value = skill
  nextTick(() => document.getElementById(`path-${skill.toLowerCase()}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
// What was changed is saved (where saving is allowed) when the editor closes.
function saveIfChanged() {
  if (currentPlanId.value && dirty.value && canSavePlan.value) saveCurrent(currentPlanName.value, false)
}
function closeSkillEditor() {
  const skill = editSkill.value
  saveIfChanged()
  if (mode.value === 'plan' && currentPlanId.value) router.replace(planLocation(currentPlanId.value, { skill }))
  else editSkillLocal.value = ''
}
// The editor changes the plan as you go (so the route above it stays current), so what the skill was when the editor opened is
// kept, and Cancel puts it back. Nothing is saved on the way out.
let editSnapshot = null
watch(editSkill, (skill, before) => {
  if (!skill) editSnapshot = null
  else if (skill !== before) {
    const g = goals.value.find((x) => x.skill === skill)
    editSnapshot = g ? { skill, goal: JSON.parse(JSON.stringify(g)) } : null
  }
}, { immediate: true })
function cancelSkillEditor() {
  const skill = editSkill.value
  const i = goals.value.findIndex((g) => g.skill === skill)
  if (editSnapshot && editSnapshot.skill === skill && i >= 0) {
    const g = goals.value[i]
    for (const key of Object.keys(g)) if (!(key in editSnapshot.goal)) delete g[key]
    Object.assign(g, JSON.parse(JSON.stringify(editSnapshot.goal)))
  }
  if (mode.value === 'plan' && currentPlanId.value) router.replace(planLocation(currentPlanId.value, { skill }))
  else editSkillLocal.value = ''
}
function removeSkill(i) {
  removeGoal(i)
  if (goals.value.length) {
    if (mode.value === 'plan' && currentPlanId.value) router.replace(planLocation(currentPlanId.value))
    else editSkillLocal.value = ''
    saveIfChanged()
  }
}
// "Delete from plan" in a skill card's menu: asks first, since the plan saves as soon as the skill goes.
const skillToDelete = ref('')
function removeSkillFromMenu(skill) {
  if (goals.value.some((g) => g.skill === skill)) skillToDelete.value = skill
}
function confirmRemoveSkill() {
  const skill = skillToDelete.value
  skillToDelete.value = ''
  const i = goals.value.findIndex((g) => g.skill === skill)
  if (i >= 0) removeSkill(i)
}
// The first skill that uses a method with something missing, opened on its requirements.
function reviewRequirements() {
  const skill = routeIssues.value.blockedSkills[0]
  if (skill) openSkillEditor(skill, 'requirements')
}
const showSettings = ref(false)
function openSettings(toPlayer = false) {
  showSettings.value = true
  if (toPlayer) {
    editingPlayer.value = true
    username.value = ''
  }
}
// Closing without Save leaves the plan as it was (the player, picked inside the window, applies as soon as it is chosen).
function closeSettings() {
  showSettings.value = false
  editingPlayer.value = false
}
async function saveSettings({ name, strategy, hours, profile }) {
  closeSettings()
  if (name && name !== currentPlanName.value) {
    if (currentPlanId.value) renameSaved(currentPlanId.value, name)
    currentPlanName.value = name.slice(0, 60)
  }
  if (strategy !== globalStrategy.value) setGlobalStrategy(strategy)
  if (hours !== hoursPerDay.value) setHours(hours)
  saveIfChanged()
  if (profilePlan.available.value) await applyProfileChoice(!!profile)
}
// The "Show this plan on my profile" setting: turned on (saving the plan first if it was never saved), turned off, or kept current.
async function applyProfileChoice(on) {
  const was = profilePlan.isPublic.value
  try {
    if (on && !was) {
      if (!currentPlanId.value) {
        settingProfile = true
        saveCurrent(currentPlanName.value || (player.value ? `${player.value.displayName}'s training plan` : 'My training plan'), false)
        settingProfile = false
      }
      if (!currentPlanId.value) return
      await profilePlan.publish(planForProfile())
      track('planner_profile_plan', { on: true })
      showToast('This plan is now the goal on your profile.')
    } else if (!on && was) {
      await profilePlan.unpublish()
      track('planner_profile_plan', { on: false })
      showToast('Removed from your profile.')
    } else if (on && was) {
      await profilePlan.publish(planForProfile())
    }
  } catch (err) {
    showToast(err.message, 4000)
  }
}
// The finish line as text, for the progress card (a plan that is not tracked shows the finish line box instead).
const finishInfo = computed(() => {
  const t = timeline.value
  if (!(t.totalHours > 0) || !t.finishDate) return { dateText: 'Nothing left to train', untilText: 'Every goal is already reached.' }
  const d = t.totalDays == null ? null : Math.ceil(t.totalDays)
  return {
    dateText: t.finishDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    untilText: d == null ? '' : d <= 1 ? `Within a day at ${hoursPerDay.value} h/day` : `In about ${d.toLocaleString('en-US')} days at ${hoursPerDay.value} h/day`,
  }
})
const strategyName = computed(() => STRATEGY_LABELS[globalStrategy.value] || 'Fastest')
function scrollToPath() {
  document.getElementById('plan-path')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
// --- Goals ----------------------------------------------------------------------
const addSkill = ref('')
function openAdd(skill) {
  addSkill.value = typeof skill === 'string' ? skill : ''
  showAdd.value = true
  track('planner_add_goal_open')
}
function addGoal(goal) {
  if (goals.value.some((g) => g.skill === goal.skill)) return
  const first = !goals.value.length
  if (first) tab.value = 'overview'
  // A plan still in the suggested order stays in it when a skill is added; one the player has arranged is left alone.
  const orderOpts = smartOpts()
  const wasSmart = !first && !smartOrderGoals(goals.value, orderOpts).changed
  goals.value.push(goal)
  if (wasSmart) goals.value = smartOrderGoals(goals.value, orderOpts).goals
  expanded.value = new Set([goal.skill])
  showAdd.value = false
  if (player.value && !statsAt.value) statsAt.value = player.value.latest.capturedAt
  track('planner_goal_added', { skill: goal.skill, method: goal.methodId })
  // The first goal from the start screen makes a plan, which gets its own address.
  if (first && !currentPlanId.value) afterCreate(player.value ? `${player.value.displayName}'s training plan` : 'My training plan')
  // A skill added to a plan opens its editor, to choose how to train it.
  else if (!first) nextTick(() => openSkillEditor(goal.skill))
}
function removeGoal(i) {
  track('planner_goal_removed', { skill: goals.value[i]?.skill })
  const [gone] = goals.value.splice(i, 1)
  expanded.value.delete(gone.skill)
  expanded.value = new Set(expanded.value)
}
// The training order changed by dragging a skill card: the card at `from` goes to place `to`, and the plan is saved.
function reorderTo(from, to) {
  if (from === to || from < 0 || to < 0 || from >= goals.value.length || to >= goals.value.length) return
  const next = [...goals.value]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  goals.value = next
  keepSmart.value = false
  track('planner_goal_reordered')
  saveIfChanged()
}
// A name entered in the Smart order window (typed, or picked from the dropdown): looked up like one at the top of the planner, and the plan
// follows the player. Goals made before there was a player start at level 1; the real levels replace that (a recommended plan is already
// rebuilt by loadPlayer).
function applyNewPlayerToGoals(hadPlayer) {
  if (!hadPlayer && player.value?.latest && goals.value.length && !template.value?.recommendedId) {
    personalizeTemplate()
    saveIfChanged()
  }
}
async function smartOrderLookup() {
  const hadPlayer = !!player.value?.latest
  track('planner_smart_order_name', {})
  await loadPlayer({ typed: true })
  applyNewPlayerToGoals(hadPlayer)
}
async function smartOrderPick(sg) {
  const hadPlayer = !!player.value?.latest
  track('search_suggestion_selected', { source: 'planner' })
  suggestions.value = []
  username.value = sg.displayName
  track('planner_smart_order_name', {})
  await loadPlayer({ typed: true })
  applyNewPlayerToGoals(hadPlayer)
}
// "Use this order" in the suggested order window: the skills go in that order (a skill not named stays at the end) and the plan is saved.
function applyOrder(order) {
  const rank = new Map(order.map((skill, i) => [skill, i]))
  goals.value = [...goals.value].sort((a, b) => (rank.get(a.skill) ?? 1e6) - (rank.get(b.skill) ?? 1e6))
  saveIfChanged()
}
// A change made from the details under a skill's route (ticking a quest): applied and saved straight away, like closing the editor.
function patchGoalBySkill(skill, patch) {
  const i = goals.value.findIndex((g) => g.skill === skill)
  if (i < 0) return
  patchGoal(i, patch)
  nextTick(saveIfChanged)
}
function patchGoal(i, patch) {
  Object.assign(goals.value[i], patch)
  if (patch.methodId) track('planner_method_changed', { skill: goals.value[i].skill, method: patch.methodId })
}
function pickRoute(i, id) {
  goals.value[i].methodId = id === globalStrategy.value ? GLOBAL_STRATEGY : id
  track('planner_route_picked', { skill: goals.value[i].skill, method: id })
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

// --- XP gained today ---------------------------------------------------------------
// What the goal skills have gained since the game day began (6 AM Eastern), from the tracked snapshot history.
const gainedTodayNow = computed(() => {
  if (!tracking.value || history.value.id !== player.value?.id) return null
  const xp = {}
  for (const g of goals.value) {
    const v = playerXp(g.skill)
    if (v != null) xp[g.skill] = v
  }
  return gainedToday(history.value.rows, xp)
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
// --- Saved plans (browser storage) ---------------------------------------------------
const savedPlans = ref(listSavedPlans())
const currentPlanId = ref('')
const currentPlanName = ref('')
// A plan for a profile you own can be that profile's goal (a setting in the plan's settings window). While it is, saving the plan
// keeps the profile in step.
const profilePlan = useProfilePlan(computed(() => player.value?.username || ''), currentPlanId)
// Showing a plan on your profile is the default: a new plan for your profile goes there (unless another plan already is), and the
// settings window starts with the box ticked. Turning it off is remembered, because only a brand-new plan is put there on its own.
const profileOption = computed(() => (profilePlan.available.value ? { on: profilePlan.isPublic.value, other: profilePlan.other.value, willSave: !currentPlanId.value, byDefault: !currentPlanId.value && !profilePlan.other.value && profilePlan.ready.value } : null))
const planForProfile = () => ({ planId: currentPlanId.value, name: currentPlanName.value, goals: goals.value.map((g) => ({ skill: g.skill, targetXp: g.targetXp })) })
// A plan saved for the first time goes on the profile it is for, when that profile has no plan yet.
let settingProfile = false
async function showNewPlanOnProfile() {
  if (settingProfile || !profilePlan.available.value || !profilePlan.ready.value || profilePlan.isPublic.value || profilePlan.other.value) return
  try {
    await profilePlan.publish(planForProfile())
    showToast('Saved, and showing on your profile. You can turn that off in Plan settings.', 4200)
  } catch (err) {
    showToast(err.message)
  }
}
async function syncProfilePlan() {
  if (!profilePlan.isPublic.value || !currentPlanId.value) return
  try {
    await profilePlan.publish(planForProfile())
  } catch (err) {
    showToast(err.message)
  }
}
// A plan with nothing in it has nothing to edit.
watch(
  () => goals.value.length === 0,
  () => (editSkillLocal.value = ''),
)

const refreshSaved = () => (savedPlans.value = listSavedPlans())

// The Smart Planner answers a plan was made from (null for any other plan), kept with the plan and shown on it.
const smartProfile = ref(null)
const tailoredText = computed(() => (smartProfile.value ? describeProfile(smartProfile.value) : ''))
function currentSnapshotState() {
  return {
    rsn: player.value?.displayName || username.value,
    playerId: player.value?.id ?? null,
    statsAt: statsAt.value,
    globalStrategy: globalStrategy.value,
    gpValue: gpValue.value,
    budget: null,
    hoursPerDay: hoursPerDay.value,
    smart: smartProfile.value,
    goals: goals.value,
  }
}
// A saved plan keeps what was saved until it is updated: changes made since are "unsaved".
const dirty = computed(() => {
  const saved = savedPlans.value.find((p) => p.id === currentPlanId.value)
  if (!saved) return false
  return planFingerprint(saved) !== planFingerprint({ hoursPerDay: hoursPerDay.value, globalStrategy: globalStrategy.value, gpValue: gpValue.value, goals: goals.value })
})
// Plans can only be saved for your own profile: the one you have claimed. A plan for any other profile can still be shared,
// it just is not kept in Saved plans. A plan for no profile at all (goals entered by hand) can always be saved.
const { loggedIn, profiles, profilesReady } = useAuth()
const ownsLoadedProfile = computed(() => !!player.value && profiles.value.some((p) => sameName(p.username, player.value.username)))
// While the account's profiles are still being read, a signed-in person is not turned away.
const canSavePlan = computed(() => !player.value || ownsLoadedProfile.value || (loggedIn.value && !profilesReady.value))
const saveBlockedReason = computed(() => {
  if (canSavePlan.value || !player.value) return ''
  const who = player.value.displayName
  return loggedIn.value
    ? `Plans can only be saved for your own profile, and ${who} is not one you have claimed. You can still share this plan without saving it.`
    : `Plans can only be saved for your own profile. Log in and claim ${who} to save plans for it. You can still share this plan without saving it.`
})
// A plan shared without being saved keeps one id, so sharing it again updates the same link instead of making a new one.
const unsavedShareId = ref('')
function saveCurrent(name, asNew) {
  if (!canSavePlan.value) return showToast(saveBlockedReason.value)
  const wasSaved = !asNew && !!currentPlanId.value && savedPlans.value.some((p) => p.id === currentPlanId.value)
  const existing = !asNew && currentPlanId.value ? savedPlans.value.find((p) => p.id === currentPlanId.value) || {} : {}
  const plan = savePlan(snapshotPlan(currentSnapshotState(), name || currentPlanName.value, existing))
  if (!plan) return showToast('Could not save, browser storage is unavailable.')
  currentPlanId.value = plan.id
  currentPlanName.value = plan.name
  scratch.value = false
  refreshSaved()
  track('planner_plan_saved', { goals: plan.goals.length })
  syncProfilePlan()
  if (!wasSaved) showNewPlanOnProfile()
  showToast(wasSaved ? `Updated "${plan.name}".` : `Saved "${plan.name}".`)
  // A plan that was not saved before (or a copy) now has its own address.
  if (mode.value !== 'plan' || routeId.value !== plan.id) {
    const skill = editSkillLocal.value
    editSkillLocal.value = ''
    router.replace(planLocation(plan.id, skill ? { edit: true, skill } : {}))
  }
}
// --- Using someone else's public plan ---------------------------------------------------------
// "Use this plan" opens the planner with ?template=<slug>. The plan's goals, targets, methods, order and strategy come
// across; every goal starts from the new player's own XP, and none of the owner's progress is copied.
const template = ref(null)
const templatePending = ref(false)
const { me } = useRivals()

function personalizeTemplate() {
  if (!player.value?.latest) return
  // A recommended plan made before any player was known is rebuilt from the player's real stats (its goals depend on them).
  if (template.value?.recommendedId) {
    const rec = recommendedPlans(player.value.latest.skills).find((r) => r.id === template.value.recommendedId)
    if (rec) goals.value = smartOrderGoals(rec.goals.map(withSuggestedQuests), smartOpts()).goals
    else goals.value = []
    statsAt.value = player.value.latest.capturedAt
    templatePending.value = false
    track('planner_recommended_personalized', { goals: goals.value.length })
    return
  }
  // A Smart Planner plan made before any player was known is worked out again from the player's real levels, with the same answers.
  if (template.value?.smart) {
    goals.value = planFromProfile(template.value.smart, player.value.latest.skills).goals
    statsAt.value = player.value.latest.capturedAt
    templatePending.value = false
    track('smart_planner_personalized', { goals: goals.value.length })
    return
  }
  const orderOpts = smartOpts()
  const wasSmart = goals.value.length > 1 && !smartOrderGoals(goals.value, orderOpts).changed
  for (const g of goals.value) {
    const xp = playerXp(g.skill) ?? 0
    g.currentXp = Math.min(xp, g.targetXp)
  }
  // A plan that was in the suggested order is put in it again, now that the real levels are known.
  if (wasSmart) goals.value = smartOrderGoals(goals.value, orderOpts).goals
  statsAt.value = player.value.latest.capturedAt
  templatePending.value = false
  track('planner_template_personalized', { goals: goals.value.length })
}

// Keep whatever plan is on screen before it is replaced. A saved plan with nothing new in it is already safe; anything else
// (an unsaved plan, or changes not updated yet) is saved to Saved plans first.
// Throw away changes made since the last save and show the saved version again.
async function revertPlan() {
  const saved = savedPlans.value.find((p) => p.id === currentPlanId.value)
  if (!saved) return
  await loadSaved(saved, { silent: true })
  track('planner_plan_reverted')
  showToast(`Reverted "${saved.name}" to its last saved version.`)
}
function keepCurrentPlanBefore(name) {
  if (!goals.value.length) return
  const saved = savedPlans.value.find((p) => p.id === currentPlanId.value)
  if (saved && !dirty.value) return
  // A plan for someone else's profile is never saved, so there is nothing to keep it in.
  if (!canSavePlan.value) return
  const kept = savePlan(snapshotPlan(currentSnapshotState(), `Plan before using "${name}"`.slice(0, 60)))
  if (kept) {
    refreshSaved()
    showToast('Your previous plan was saved to Saved plans.')
  }
}

// "Use this plan" on a recommended plan: its goals come from the player's own stats, so they start from where they really are.
function useRecommended(rec) {
  keepCurrentPlanBefore(rec.title)
  unsavedShareId.value = ''
  tab.value = 'overview'
  goalFilter.value = 'all'
  // A new plan starts in the suggested order (see utils/smartOrder.js), tailored to the player's stats.
  goals.value = smartOrderGoals(rec.goals.map(withSuggestedQuests), smartOpts()).goals
  statsAt.value = player.value?.latest ? player.value.latest.capturedAt : null
  currentPlanId.value = ''
  currentPlanName.value = rec.title.slice(0, 60)
  template.value = { slug: '', name: rec.title, rsn: '', recommendedId: rec.id }
  smartProfile.value = null
  keepSmart.value = true
  templatePending.value = !player.value?.latest
  expanded.value = new Set() // goals stay collapsed; only a goal you add yourself opens
  track('planner_recommended_used', { plan: rec.id, goals: goals.value.length, hasPlayer: !!player.value?.latest })
  afterCreate(rec.title)
}

// "Start this plan" in the Smart Planner: the answers become settings, and the goals are worked out from the player's stats right now.
function useSmartPlan(plan) {
  keepCurrentPlanBefore('Smart plan')
  unsavedShareId.value = ''
  tab.value = 'overview'
  goalFilter.value = 'all'
  // The settings first: everything that works the plan out (the order, the totals) reads them.
  hoursPerDay.value = plan.hoursPerDay
  globalStrategy.value = plan.globalStrategy
  gpValue.value = plan.gpValue
  goals.value = plan.goals
  statsAt.value = player.value?.latest ? player.value.latest.capturedAt : null
  currentPlanId.value = ''
  currentPlanName.value = 'Smart plan'
  template.value = { slug: '', name: 'Smart plan', rsn: '', smart: plan.profile }
  smartProfile.value = plan.profile
  templatePending.value = !player.value?.latest
  expanded.value = new Set()
  track('planner_smart_used', { goal: plan.profile.goal, goals: goals.value.length, hasPlayer: !!player.value?.latest })
  afterCreate('Smart plan')
}
async function startSmart(profile) {
  await loadTyped()
  const plan = planFromProfile(profile, player.value?.latest?.skills || null)
  if (!plan.goals.length) return showToast('Nothing to plan for those answers. Change one and try again.')
  useSmartPlan(plan)
}

async function loadTemplate(slug) {
  let share
  try {
    share = (await sharedPlansApi.get(slug)).plan
  } catch {
    showToast('That plan is not shared any more.')
    return false
  }
  keepCurrentPlanBefore(share.name)
  tab.value = 'overview'
  scratch.value = false
  unsavedShareId.value = ''
  goals.value = share.plan.goals.map((g) => ({
    skill: g.skill,
    currentXp: 0,
    targetXp: g.targetXp,
    methodId: g.methodId,
    customXpPerHour: g.customXpPerHour || 0,
    quests: [...(g.quests || [])],
    overrides: (g.overrides || []).map((o) => ({ ...o })),
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
  recordPlanEvent(slug, 'use')
  return true
}

// --- Sharing a plan publicly ---------------------------------------------------------------
const sharing = ref(null)
const sharingAuto = ref(false)
function openShare(stored, { auto = false } = {}) {
  const res = validatePlan(stored)
  if (res.error) return showToast(res.error)
  sharingAuto.value = auto
  sharing.value = res.plan
}
// Sharing the plan on screen: the public copy is made from what is on screen, and nothing is saved or changed here. Opening the
// share window is not an edit, so the saved plan (and its "updated" date) stays exactly as it was.
function shareCurrent(name) {
  if (!goals.value.length) return
  shareWithoutSaving(name)
}
// Share the plan on screen as it is, without saving anything. A saved plan keeps its id (so its link stays the same) and its
// created date; a plan that is not saved gets one id for the visit, so sharing it again updates the same link.
function shareWithoutSaving(name) {
  const saved = currentPlanId.value ? savedPlans.value.find((p) => p.id === currentPlanId.value) : null
  const id = currentPlanId.value || unsavedShareId.value || `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
  if (!currentPlanId.value) unsavedShareId.value = id
  const plan = snapshotPlan(currentSnapshotState(), name || currentPlanName.value || 'Shared plan', saved ? { id, createdAt: saved.createdAt } : { id })
  openShare(plan)
}
function applyPlan(plan) {
  tab.value = 'overview'
  goalFilter.value = 'all'
  scratch.value = false
  unsavedShareId.value = ''
  goals.value = plan.goals.map((g) => ({ ...g, quests: [...g.quests], ...(g.overrides ? { overrides: g.overrides.map((o) => ({ ...o })) } : {}) }))
  hoursPerDay.value = plan.hoursPerDay
  globalStrategy.value = plan.globalStrategy
  gpValue.value = plan.gpValue
  statsAt.value = plan.statsAt
  expanded.value = new Set()
}
async function loadSaved(stored, { silent = false } = {}) {
  const res = validatePlan(stored)
  if (res.error) return silent ? undefined : showToast(res.error)
  applyPlan(res.plan)
  // Plans saved without a start time still track progress: the goals carry their own starting XP, so the day the plan was made stands in.
  if (!statsAt.value) statsAt.value = stored.createdAt || stored.updatedAt || null
  currentPlanId.value = res.plan.id
  currentPlanName.value = res.plan.name
  if (res.warnings.length && !silent) showToast(res.warnings[0])
  // Load the player so newer stats can be offered, the saved starting values stay as they were.
  template.value = null
  smartProfile.value = res.plan.smart || null
  templatePending.value = false
  if (res.plan.player.rsn) {
    username.value = res.plan.player.rsn
    await loadPlayer()
  } else {
    // A plan made for nobody in particular does not carry the previous plan's player along.
    player.value = null
    username.value = ''
  }
  track(silent ? 'planner_plan_autoloaded' : 'planner_plan_loaded', { goals: res.plan.goals.length })
  if (!silent) showToast(`Loaded "${res.plan.name}".`)
}
// A blank planner with no plan picked: play with the calculators, share what you put together, save it only if you want to.
function startNew() {
  goals.value = []
  currentPlanId.value = ''
  currentPlanName.value = ''
  unsavedShareId.value = ''
  template.value = null
  smartProfile.value = null
  templatePending.value = false
  expanded.value = new Set()
  statsAt.value = player.value?.latest ? player.value.latest.capturedAt : null
  scratch.value = true
  track('planner_new_plan')
}
// A new, blank plan: the start screen at /planner/new.
function goNew() {
  startNew()
  if (route.name !== 'plannerNew') router.push({ name: 'plannerNew' })
}
// A plan that was just made from the start screen: saved (where saving is allowed) so it has an address of its own. A plan that
// cannot be saved (someone else's profile) stays on /planner/new, where it can still be shared.
function afterCreate(name) {
  if (!currentPlanName.value) currentPlanName.value = name.slice(0, 60)
  if (canSavePlan.value) saveCurrent(name, true)
  else if (route.name !== 'plannerNew') router.replace({ name: 'plannerNew' })
}
function openPlan(stored) {
  router.push(planLocation(stored.id))
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
  const gone = savedPlans.value.find((p) => p.id === id)
  if (gone) dropProfilePlan(id, gone.player?.rsn)
  deletePlan(id)
  refreshSaved()
  if (id === currentPlanId.value) {
    currentPlanId.value = ''
    // Its address no longer leads anywhere: back to your plans.
    startNew()
    scratch.value = false
    router.replace({ name: 'planner' })
  }
}

// The saved-plans switcher is shown in the empty start screen (when there are saved plans) and above a plan; same props and events.
const savedPlansProps = computed(() => ({
  plans: savedPlans.value,
  currentId: currentPlanId.value,
  currentName: currentPlanName.value,
  playerName: player.value?.username || '',
  playerLabel: player.value?.displayName || '',
  hasGoals: goals.value.length > 0,
  dirty: dirty.value,
  canSave: canSavePlan.value,
  saveBlockedReason: saveBlockedReason.value,
}))
const savedPlansOn = {
  save: (n) => saveCurrent(n, false),
  'save-new': (n) => saveCurrent(n, true),
  load: openPlan,
  duplicate: duplicateSaved,
  delete: deleteSaved,
  rename: renameSaved,
  share: openShare,
  'share-current': shareCurrent,
  blocked: () => showToast(saveBlockedReason.value),
  revert: revertPlan,
  new: goNew,
}

// --- Start screen --------------------------------------------------------------------
// A name typed in the search box but not loaded yet (they went straight for a plan) is loaded first, so the plan starts from
// their own stats. With no name, or a name that cannot be found, the plan starts every skill from level 1.
let typedLoad = null
async function loadTyped({ force = false } = {}) {
  if (typedLoad) return typedLoad
  if ((player.value && !force) || !username.value.trim()) return
  typedLoad = loadPlayer({ typed: true }).finally(() => (typedLoad = null))
  return typedLoad
}
// A name typed in the search box but not loaded yet (they went straight for a plan) is loaded first, so the plan starts from
// their own stats. With no name, or a name that cannot be found, the plan starts every skill from level 1.
async function startFromPlan(rec) {
  await loadTyped()
  let plan = rec
  if (player.value?.latest) {
    plan = recommendedPlans(player.value.latest.skills).find((r) => r.id === rec.id)
    if (!plan) return showToast('That plan is already done for this player. Pick another.')
  }
  useRecommended(plan)
}
async function startCustom(skill) {
  await loadTyped()
  openAdd(skill)
}
function scrollToStart() {
  document.getElementById('ps-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
  [goals, hoursPerDay, player, globalStrategy, gpValue, statsAt, currentPlanId, unsavedShareId, scratch, loggedIn],
  () => {
    calcAt.value = new Date()
    const state = planState()
    try {
      // The saved plan this working copy came from is remembered too, so coming back shows it as that plan.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, statsAt: statsAt.value, planId: currentPlanId.value, planName: currentPlanName.value, shareId: unsavedShareId.value, scratch: scratch.value }))
    } catch {
      /* storage unavailable, URL sharing still works */
    }
    // history.replaceState (not router.replace) so syncing the URL never triggers the router's scroll-to-top.
    // A saved plan has its own address and carries nothing in it. A plan that is not saved (at /planner/new) carries itself in the
    // address while signed out, so the link can be copied; signed in, it is kept in the account and this browser instead.
    if (mode.value === 'new') {
      const qs = goals.value.length && !loggedIn.value && !currentPlanId.value ? `?${encodePlan(state).toString()}` : ''
      window.history.replaceState(window.history.state, '', `${route.path}${qs}`)
    }
    setRobots(mode.value === 'overview' || (mode.value === 'new' && !goals.value.length) ? 'index, follow' : 'noindex, follow')
  },
  { deep: true },
)

// --- Progress on each plan card (the overview) ---------------------------------------
// The same "% complete" the plan page shows: how much of the planned training time is behind the player, from their tracked XP.
const progressLoading = ref(false)
let overviewLoaded = false
async function loadOverviewPlayers() {
  if (overviewLoaded || !savedPlans.value.some((p) => p.player?.rsn)) return
  overviewLoaded = true
  progressLoading.value = true
  try {
    await store.loadPlayers()
    playersFreshened = true
  } catch {
    /* no progress shown without the players */
  } finally {
    progressLoading.value = false
  }
}
watch(showOverview, (on) => on && loadOverviewPlayers(), { immediate: true })
// The player behind a saved plan (if tracked) and the methods the planner skips for them, worked out the way the plan page does it,
// so a card and the plan it opens agree.
function cardContext(p) {
  const rsn = p.player?.rsn
  const found = rsn ? store.players.find((x) => sameName(x.username, rsn) || sameName(x.displayName, rsn)) : null
  const skills = found?.latest?.skills
  const levels = {}
  if (skills) for (const name of SKILL_NAMES) if (Number.isFinite(skills[name]?.level)) levels[name] = skills[name].level
  const ctx = { levels: skills ? levels : null, planned: Object.fromEntries((p.goals || []).map((g) => [g.skill, levelAtXp(g.targetXp, true)])), plannedQuests: plannedQuestReqIds(p.goals || []), confirmations: confirmations.value }
  const blocked = respect.value ? blockedMethodIds(TRAINING_METHODS, ctx) : []
  return { skills, blocked, prep: (g) => ({ ...resolveGoal(g, p.globalStrategy, p.gpValue), blockedMethodIds: blocked, doneQuestIds: doneQuestIds.value }) }
}
function cardProgress(p) {
  const { skills, prep } = cardContext(p)
  const baseline = p.statsAt || p.createdAt || p.updatedAt
  if (!skills || !baseline || !p.goals?.length) return null
  const live = p.goals.map((g) => liveGoalFor(g, skills[g.skill]?.xp))
  const original = p.goals.map((g) => planGoal(prep(g)))
  const now = live.map((g) => planGoal(prep(g)))
  const prog = buildProgress(p.goals, live, original, now, p.hoursPerDay, baseline)
  // What is still to train, worked out the way the plan page does: the card also shows it beside the plan's whole time.
  const left = planTotals(now, p.hoursPerDay)
  return { pct: prog.timePct, done: prog.per.filter((x) => x.done).length, total: p.goals.length, hoursLeft: left.totalHours, daysLeft: left.days }
}
// Time and gp for each card, from the plan's own start, skipping methods the player cannot use (as the plan page does).
const overviewSummaries = computed(() => {
  if (!showOverview.value) return {}
  const out = {}
  for (const p of savedPlans.value) {
    try {
      const { blocked } = cardContext(p)
      out[p.id] = summarizePlan({ ...p, goals: (p.goals || []).map((g) => ({ ...g, blockedMethodIds: blocked, doneQuestIds: doneQuestIds.value })) })
    } catch {
      /* the card falls back to its own totals */
    }
  }
  return out
})
const overviewProgress = computed(() => {
  if (!showOverview.value) return {}
  const out = {}
  for (const p of savedPlans.value) {
    try {
      const r = cardProgress(p)
      if (r) out[p.id] = r
    } catch {
      /* a plan that cannot be worked out just shows no progress */
    }
  }
  return out
})

// --- Opening what the address asks for ---------------------------------------------
function applyRestored(restored, keepScratch) {
  goals.value = restored.goals || []
  hoursPerDay.value = restored.hoursPerDay || 2
  username.value = restored.username || ''
  if (GLOBAL_STRATEGIES.includes(restored.strategy)) globalStrategy.value = restored.strategy
  if (restored.gpValue > 0) gpValue.value = restored.gpValue
  statsAt.value = restored.statsAt || null
  scratch.value = keepScratch
  currentPlanId.value = ''
  currentPlanName.value = ''
}
// /planner/new?g=... : a plan carried in the address (a shared link, a plan guide, a calculator).
async function restoreFromQuery() {
  const q = route.query
  const restored = decodePlan(q, SKILL_NAMES)
  if (!restored) return
  // A link made by Share carries the plan and nothing about who made it: opened as a shared plan.
  const fromShare = q.from === 'share' && typeof q.u !== 'string'
  applyRestored(restored, false)
  if (fromShare && goals.value.length) {
    template.value = { slug: '', name: 'Shared plan', rsn: '' }
    templatePending.value = true
    scratch.value = true
    // Where the click came from, and a code for the plan, so the owner can tell whose saved plan the link most likely was.
    track('planner_share_link_opened', { goals: goals.value.length, source: referrerSource(document.referrer, window.location.hostname), plan: goalsCode(restored.goals) })
  }
  if (username.value) await loadPlayer()
}
// The plan in progress that was never saved (kept in this browser), for coming back to it or arriving from a calculator.
async function restoreScratchFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!saved || !Array.isArray(saved.goals) || !saved.goals.length || saved.planId) return
    // Plans stored before global strategies pinned every goal to a method; the old default now follows the global strategy.
    saved.goals = saved.goals.map((g) => ({ ...g, methodId: g.methodId === AUTO_FAST || !g.methodId ? GLOBAL_STRATEGY : g.methodId, quests: g.quests || [], customXpPerHour: g.customXpPerHour || 0 }))
    applyRestored(saved, !!saved.scratch)
    if (username.value) await loadPlayer()
  } catch {
    /* nothing to bring back */
  }
}
// Signed in with a claimed profile: the start screen begins with that profile loaded.
async function prefillOwnProfile() {
  await waitForAuth()
  if (!loggedIn.value || !profiles.value.length || player.value || username.value) return
  let last = ''
  try {
    last = localStorage.getItem(OWN_PROFILE_KEY) || ''
  } catch {
    last = ''
  }
  const own = profiles.value.find((p) => sameName(p.username, last)) || profiles.value[0]
  username.value = own.displayName
  await loadPlayer()
}
async function applyNewRoute(first) {
  const q = route.query
  planMissing.value = false
  if (q.g) return restoreFromQuery()
  if (typeof q.template === 'string') return loadTemplate(q.template)
  if (typeof q.u === 'string') {
    // A link to plan for one player (from their profile): their latest saved plan, if they have one.
    const theirs = savedPlans.value.find((p) => p.player?.rsn && sameName(p.player.rsn, q.u))
    if (theirs) return router.replace(planLocation(theirs.id))
    username.value = q.u
    return loadPlayer()
  }
  // A saved plan left open in memory is not "new": start blank.
  if (currentPlanId.value) startNew()
  else if (!goals.value.length && first) await restoreScratchFromStorage()
  if (!goals.value.length) await prefillOwnProfile()
}
// A saved plan's own address: open it (waiting for the account's plans to arrive if need be), and open its skill if one is named.
async function syncSkillFromRoute() {
  const skill = routeSkill.value && goals.value.some((g) => g.skill === routeSkill.value) ? routeSkill.value : ''
  pathOpen.value = skill
  if (!skill) return
  await nextTick()
  document.getElementById(`path-${skill.toLowerCase()}`)?.scrollIntoView({ behavior: 'smooth', block: isEditSkillRoute.value ? 'start' : 'center' })
}
async function applyPlanRoute() {
  const id = routeId.value
  if (currentPlanId.value === id && goals.value.length) {
    planMissing.value = false
    return syncSkillFromRoute()
  }
  let stored = savedPlans.value.find((p) => p.id === id)
  if (!stored) {
    // On another device the plan arrives with the account's data a moment after the page opens.
    await waitForAuth()
    refreshSaved()
    stored = savedPlans.value.find((p) => p.id === id)
  }
  if (!stored) {
    planMissing.value = true
    return
  }
  planMissing.value = false
  await loadSaved(stored, { silent: true })
  return syncSkillFromRoute()
}
async function applyRoute(first = false) {
  if (route.name === 'planner') {
    const q = route.query
    // Addresses from before plans had their own: /planner?plan=<id>, ?g=..., ?template=..., ?u=...
    if (typeof q.plan === 'string' && savedPlans.value.some((p) => p.id === q.plan)) return router.replace(planLocation(q.plan))
    if (q.g || typeof q.template === 'string' || typeof q.u === 'string') return router.replace({ name: 'plannerNew', query: q })
    planMissing.value = false
    if (!savedPlans.value.length && !goals.value.length) await prefillOwnProfile()
    return
  }
  if (route.name === 'plannerNew') return applyNewRoute(first)
  return applyPlanRoute()
}
watch(
  () => route.fullPath,
  () => applyRoute(false),
)
// Plans arriving from the account (another device, or just after logging in).
const onSynced = () => {
  refreshSaved()
  if (planMissing.value) applyRoute(false)
}
onMounted(async () => {
  window.addEventListener(SYNCED_EVENT, onSynced)
  await applyRoute(true)
  // Re-hydrate a previously-loaded username so the header and refresh offer reflect the latest snapshot.
  if (username.value && !player.value) await loadPlayer()
})
onBeforeUnmount(() => window.removeEventListener(SYNCED_EVENT, onSynced))
</script>
