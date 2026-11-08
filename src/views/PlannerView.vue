<template>
  <div class="planner">
    <div class="card">
      <a v-if="backName" href="#" class="btn-text planner-back" @click.prevent="goBack">← Back to {{ backName }}'s profile</a>
      <h1>OSRS Account Planner &amp; XP Calculator</h1>
      <p class="planner-intro">
        Plan your Old School RuneScape skill goals. Load your stats by username (or enter them by hand), pick targets and
        training methods, and see the XP, hours, GP and days it takes.
      </p>

      <!-- Section 1: player lookup -->
      <div class="suggest-wrap">
      <form class="add-player-form" @submit.prevent="loadPlayer">
        <input type="text" name="username" autocomplete="username" class="autofill-decoy" tabindex="-1" aria-hidden="true" />
        <input type="password" name="password" autocomplete="current-password" class="autofill-decoy" tabindex="-1" aria-hidden="true" />
        <input v-model="username" type="text" name="rsn" placeholder="OSRS username (optional)" autocomplete="off" maxlength="12" :disabled="lookingUp" data-1p-ignore data-lpignore="true" />
        <button class="btn btn-primary" type="submit" :disabled="lookingUp || !username.trim()">
          {{ lookingUp ? 'Finding…' : 'Find Player' }}
        </button>
      </form>
      <ul v-if="suggestions.length" class="search-suggest">
        <li v-for="sg in suggestions" :key="sg.username">
          <a href="#" @click.prevent="pickSuggestion(sg)"><span>{{ sg.displayName }}</span><small>Already tracked · Overall {{ sg.overallLevel?.toLocaleString() ?? '-' }}</small></a>
        </li>
      </ul>
      </div>
      <p v-if="lookupError" class="planner-error">{{ lookupError }} You can still plan manually below.</p>
      <p v-else-if="!player" class="planner-hint">No username? Skip this and enter your current level or XP manually.</p>

      <div v-if="player" class="planner-player">
        <b>{{ player.displayName }}</b>
        <span>Overall {{ player.latest.overallLevel.toLocaleString() }}</span>
        <span>{{ formatNum(player.latest.overallXp) }} XP</span>
        <span>Updated {{ formatRelative(player.latest.capturedAt) }}</span>
        <RouterLink :to="{ name: 'playerDetail', params: { username: player.username } }">View TickGains profile →</RouterLink>
      </div>
    </div>

    <!-- Section 2: add skill goal -->
    <div id="add-goal" class="card">
      <h2>Add a skill goal</h2>
      <div class="planner-form">
        <label>
          <span>Skill</span>
          <div class="planner-skill-select"><span class="planner-skill-icon">
            <img :src="skillIconSrc(form.skill)" :alt="form.skill" width="24" height="24" /></span>
            <select v-model="form.skill" @change="onSkillChange">
              <option v-for="s in SKILL_NAMES" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
        </label>
        <label>
          <span>Current level</span>
          <NumberInput v-model="currentLevelModel" :min="1" :max="126" />
        </label>
        <label>
          <span>Current XP</span>
          <NumberInput v-model="form.currentXp" :min="0" :max="MAX_XP" />
        </label>
        <div class="planner-pair">
        <label>
          <span>Goal</span>
          <select v-model="form.targetMode" @change="syncTarget">
            <option value="level">Target level</option>
            <option value="xp">Target XP</option>
            <option value="max">200M XP</option>
          </select>
        </label>
        <label v-if="form.targetMode === 'level'">
          <span>Target level</span>
          <NumberInput v-model="form.targetLevel" :min="1" :max="126" />
        </label>
        <label v-else-if="form.targetMode === 'xp'">
          <span>Target XP</span>
          <NumberInput v-model="form.targetXp" :min="0" :max="MAX_XP" />
        </label>
        <label v-else><span>Target XP</span><input type="text" :value="formatNum(MAX_XP)" disabled /></label>

        </div>
        <label class="planner-method">
          <span>Training method</span>
          <select v-model="form.methodId">
            <optgroup label="Best route">
              <option :value="AUTO_FAST">Fastest route (recommended)</option>
              <option :value="AUTO_CHEAP">Cheapest route</option>
            </optgroup>
            <optgroup label="Specific method">
              <option v-for="meth in skillMethods" :key="meth.id" :value="meth.id">{{ methodLabel(meth, skillMethods) }}</option>
              <option value="custom">Custom XP/hour…</option>
            </optgroup>
          </select>
        </label>
        <label v-if="form.methodId === 'custom'">
          <span>XP per hour</span>
          <NumberInput v-model="form.customXpPerHour" :min="1" :max="10000000" />
        </label>
      </div>
      <p class="planner-hint" v-if="formMethod">
        {{ formMethod.description }} · {{ formMethod.intensity }} intensity ·
        <GpTip :method="formMethod">{{ formMethod.gpPerHour == null ? 'no GP data' : `${formatGp(formMethod.gpPerHour)}/h` }}</GpTip>
        <template v-if="formMethod.requirements"> · Needs: {{ formMethod.requirements }}</template>
      </p>
      <p class="planner-hint" v-else-if="form.methodId === AUTO_FAST">Uses the fastest method you can do at every level on the way, so a level {{ currentLevel }} to {{ formTargetLevel }} plan only suggests methods you can actually use.</p>
      <p class="planner-hint" v-else-if="form.methodId === AUTO_CHEAP">Uses the method with the lowest cost per XP at every level. It is usually slower, so compare it against the fastest route once added.</p>

      <PlannerQuests v-model="form.quests" :skill="form.skill" :current-xp="Number(form.currentXp) || 0" :target-xp="formTargetXp" />

      <div v-if="formPlan && formPlan.remainingXp > 0" class="planner-preview">
        <div class="planner-preview-head">
          <b>Preview</b>
          <span>{{ formatNum(formPlan.remainingXp) }} xp</span>
          <span>{{ formatHours(formPlan.hours) }}</span>
          <span v-if="formPlan.netGp != null" :class="gpClass(formPlan.netGp)">{{ formatGp(formPlan.netGp) }}</span>
        </div>
        <PlannerRoute :segments="formPlan.segments" />
        <p v-if="formPlan.warning" class="planner-warning">⚠ {{ formPlan.warning }}</p>
      </div>
      <p class="planner-error" v-if="formError">{{ formError }}</p>
      <button class="btn btn-primary" type="button" @click="addGoal">Add to plan</button>
    </div>

    <!-- Section 3: training plan -->
    <div class="card" v-if="goals.length">
      <h2>Training plan</h2>
      <div class="planner-goals">
        <div v-for="(g, i) in goals" :key="g.skill" class="planner-goal">
          <div class="planner-goal-head">
            <img :src="skillIconSrc(g.skill)" :alt="g.skill" width="28" height="28" />
            <b>{{ g.skill }}</b>
            <span class="planner-levels">{{ levelAtXp(g.currentXp, true) }} → {{ levelAtXp(g.targetXp, true) }}</span>
            <button class="btn btn-ghost planner-remove" type="button" @click="removeGoal(i)" :aria-label="`Remove ${g.skill}`">Remove</button>
          </div>

          <!-- Per-skill summary -->
          <div class="planner-goal-summary">
            <div>
              <span>XP remaining</span><b>{{ formatNum(plans[i].remainingXp) }}</b>
              <small v-if="plans[i].questXp">{{ formatNum(plans[i].questXp) }} covered by quests</small>
            </div>
            <div><span>Est. time</span><b>{{ formatHours(plans[i].hours) }}</b><small>{{ daysFor(plans[i].hours) }}</small></div>
            <div><span>Est. GP</span><b :class="gpClass(plans[i].netGp)">{{ plans[i].netGp == null ? 'No GP data' : formatGp(plans[i].netGp) }}</b><small v-if="plans[i].gpPartial" class="gp-incomplete">Incomplete: some steps are unpriced, so the real cost is higher or lower</small></div>
          </div>

          <div class="planner-goal-grid">
            <label>
              <span>Training method</span>
              <select v-model="g.methodId">
                <optgroup label="Best route">
                  <option :value="AUTO_FAST">Fastest route</option>
                  <option :value="AUTO_CHEAP">Cheapest route</option>
                </optgroup>
                <optgroup label="Specific method">
                  <option v-for="meth in goalMethods(g)" :key="meth.id" :value="meth.id">{{ methodLabel(meth, goalMethods(g)) }}</option>
                  <option value="custom">Custom XP/hour</option>
                </optgroup>
              </select>
            </label>
            <label v-if="g.methodId === 'custom'">
              <span>XP/hour</span>
              <NumberInput v-model="g.customXpPerHour" :min="1" :max="10000000" />
            </label>
          </div>

          <PlannerQuests v-model="g.quests" :skill="g.skill" :current-xp="g.currentXp" :target-xp="g.targetXp" />

          <PlannerRoute :segments="plans[i].segments" />
          <p v-if="plans[i].warning" class="planner-warning">⚠ {{ plans[i].warning }}</p>

          <PlannerCompare :goal="g" :fast="compares[i].fast" :cheap="compares[i].cheap" :plan="plans[i]" @pick="(id) => (g.methodId = id)" />
        </div>
      </div>
    </div>
    <div class="card" v-else>
      <p class="empty-hint">Add a skill goal above to start your plan.</p>
    </div>

    <!-- Section 4: plan overview -->
    <div class="card" v-if="goals.length">
      <h2>Your plan</h2>
      <div class="plan-tiles">
        <div class="plan-tile"><span>Total XP</span><b>{{ formatNum(totals.totalXp) }}</b><small>{{ goals.length }} skill{{ goals.length === 1 ? '' : 's' }}</small></div>
        <div class="plan-tile"><span>Training time</span><b>{{ formatHours(totals.totalHours) }}</b></div>
        <div class="plan-tile">
          <span>Net GP</span>
          <b :class="gpClass(totals.netGp)">{{ totals.netGp == null ? 'No GP data' : formatGp(totals.netGp) }}</b>
          <small v-if="totals.gpIncomplete && totals.netGp != null" class="gp-incomplete">Incomplete: some steps are unpriced, so the real cost is higher or lower</small>
        </div>
        <div class="plan-tile plan-tile-finish">
          <span>Finish in</span>
          <b>{{ totals.days == null ? '-' : `${totals.days.toLocaleString()} day${totals.days === 1 ? '' : 's'}` }}</b>
          <small v-if="totals.completionDate">≈ {{ totals.completionDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }} at {{ hoursPerDay }} h/day</small>
        </div>
      </div>

      <label class="planner-playtime">
        <span>Playtime per day: <b>{{ hoursPerDay }} h</b></span>
        <input type="range" min="0.5" max="12" step="0.5" v-model.number="hoursPerDay" />
      </label>

      <div class="plan-skills" role="table" aria-label="Plan by skill">
        <div class="plan-skill plan-skill-head" role="row"><span>Skill</span><span>XP</span><span>Time</span><span>GP</span></div>
        <div v-for="(g, i) in goals" :key="g.skill" class="plan-skill" role="row">
          <span class="plan-skill-name"><img :src="skillIconSrc(g.skill)" :alt="g.skill" width="22" height="22" /><b>{{ g.skill }}</b><em>{{ levelAtXp(g.currentXp, true) }} → {{ levelAtXp(g.targetXp, true) }}</em></span>
          <span>{{ formatNum(plans[i].remainingXp) }}</span>
          <span>{{ formatHours(plans[i].hours) }}</span>
          <span :class="gpClass(plans[i].netGp)">{{ plans[i].netGp == null ? '-' : formatGp(plans[i].netGp) }}</span>
          <i class="plan-skill-bar" :style="{ width: timeShare(plans[i]) + '%' }" />
        </div>
      </div>

      <!-- Whole-plan fastest vs cheapest -->
      <div v-if="planStrategies" class="planner-compare">
        <div class="planner-compare-head">
          <b>Whole plan: fastest vs cheapest</b>
          <span>{{ strategyVerdict }}</span>
        </div>
        <table class="planner-table">
          <thead><tr><th>Everything on the...</th><th>Time</th><th>Net GP</th></tr></thead>
          <tbody>
            <tr><td>Fastest routes</td><td>{{ formatHours(planStrategies.fast.totalHours) }}</td><td :class="gpClass(planStrategies.fast.netGp)">{{ planStrategies.fast.netGp == null ? '-' : formatGp(planStrategies.fast.netGp) }}</td></tr>
            <tr><td>Cheapest routes</td><td>{{ formatHours(planStrategies.cheap.totalHours) }}</td><td :class="gpClass(planStrategies.cheap.netGp)">{{ planStrategies.cheap.netGp == null ? '-' : formatGp(planStrategies.cheap.netGp) }}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Itemised steps -->
      <details class="planner-all-methods">
        <summary>Itemised steps and costs</summary>
        <div v-for="(g, i) in goals" :key="g.skill" class="receipt-items">
          <h3><img :src="skillIconSrc(g.skill)" :alt="g.skill" width="18" height="18" /> {{ g.skill }}</h3>
          <PlannerRoute :segments="plans[i].segments" />
        </div>
      </details>

      <p class="planner-hint">GP and time figures are rough estimates from approximate community rates, not guarantees. GP is net per hour of training, so it already nets out supplies and any loot.</p>

      <!-- Section 5: share -->
      <div class="planner-share">
        <button class="btn btn-primary" type="button" @click="copyLink">Copy plan link</button>
        <button class="btn btn-ghost" type="button" @click="copySummary">Copy text summary</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NumberInput from '@/components/NumberInput.vue'
import PlannerRoute from '@/components/planner/PlannerRoute.vue'
import PlannerQuests from '@/components/planner/PlannerQuests.vue'
import GpTip from '@/components/planner/GpTip.vue'
import PlannerCompare from '@/components/planner/PlannerCompare.vue'
import { usePlayersStore } from '@/stores/players'
import { playersApi } from '@/api/players'
import { useToast } from '@/composables/useToast'
import { setPageMeta } from '@/utils/pageMeta'
import { track } from '@/utils/analytics'
import { SKILL_NAMES, skillIconSrc } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'
import { getMethod } from '@/data/trainingMethods'
import {
  MAX_XP,
  xpAtLevel,
  levelAtXp,
  planGoal,
  planTotals,
  relevantMethods,
  compareStrategies,
  tradeoff,
  tradeoffText,
  AUTO_FAST,
  AUTO_CHEAP,
  isAuto,
  formatNum,
  formatHours,
  formatGp,
  encodePlan,
  decodePlan,
} from '@/utils/planner'

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

const username = ref('')

// A way back to the profile you came from: the loaded player, or ?u= from a
// profile link. If the previous page in history was a profile (and its tab),
// go straight back to it; otherwise open the profile fresh.
const cameFromProfile = typeof window !== 'undefined' && String(window.history.state?.back || '').startsWith('/player/')
const backName = computed(() => player.value?.displayName || (typeof route.query.u === 'string' ? route.query.u : ''))
function goBack() {
  if (cameFromProfile) return router.back()
  const target = player.value?.username || route.query.u
  router.push({ name: 'playerDetail', params: { username: target } })
}
const player = ref(null)

// Typeahead: partial, case-insensitive matches among already-tracked players.
const suggestions = ref([])
let suggestTimer = null
watch(username, (q) => {
  clearTimeout(suggestTimer)
  const term = (q || '').trim()
  // Once a player is loaded the box just shows their name; don't reopen the list.
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
  suggestions.value = []
  username.value = sg.displayName
  loadPlayer()
}
const lookingUp = ref(false)
const lookupError = ref('')
const goals = ref([])
const hoursPerDay = ref(2)
const formError = ref('')

const form = reactive({
  skill: 'Agility',
  currentXp: 0,
  targetMode: 'level',
  targetLevel: 99,
  targetXp: xpAtLevel(99),
  methodId: AUTO_FAST,
  customXpPerHour: 50000,
  quests: [],
})

const currentLevel = computed(() => levelAtXp(form.currentXp || 0, true))
const formTargetXp = computed(() => {
  if (form.targetMode === 'max') return MAX_XP
  if (form.targetMode === 'level') return xpAtLevel(form.targetLevel || 1)
  return Math.min(Math.floor(form.targetXp || 0), MAX_XP)
})
const formTargetLevel = computed(() => levelAtXp(formTargetXp.value, true))
// Only methods that can matter between your level and your target, so a
// level 1 to 50 plan never lists Prifddinas (level 75) as if it applied.
const skillMethods = computed(() => relevantMethods(form.skill, currentLevel.value, formTargetLevel.value))
const formMethod = computed(() => (isAuto(form.methodId) || form.methodId === 'custom' ? null : getMethod(form.methodId)))
const formPlan = computed(() => {
  const currentXp = Math.min(Math.max(Math.floor(form.currentXp || 0), 0), MAX_XP)
  if (formTargetXp.value <= currentXp) return null
  return planGoal({
    skill: form.skill,
    currentXp,
    targetXp: formTargetXp.value,
    methodId: form.methodId,
    customXpPerHour: form.customXpPerHour,
    quests: form.quests,
  })
})
const plans = computed(() => goals.value.map(planGoal))
const compares = computed(() => goals.value.map(compareStrategies))
const totals = computed(() => planTotals(plans.value, hoursPerDay.value))
// Each skill's share of total training time, drawn as a thin bar under its row.
function timeShare(plan) {
  const total = totals.value.totalHours
  return total > 0 && plan.hours ? Math.max((plan.hours / total) * 100, 2) : 0
}

// Whole plan on all-fastest vs all-cheapest routes.
const planStrategies = computed(() => {
  if (!goals.value.length) return null
  const fast = planTotals(compares.value.map((c) => c.fast), hoursPerDay.value)
  const cheap = planTotals(compares.value.map((c) => c.cheap), hoursPerDay.value)
  return { fast, cheap }
})
const strategyVerdict = computed(() => {
  const st = planStrategies.value
  if (!st) return ''
  return tradeoffText(tradeoff({ hours: st.fast.totalHours, netGp: st.fast.netGp }, { hours: st.cheap.totalHours, netGp: st.cheap.netGp }))
})

function methodLabel(meth, list) {
  const fastest = list.reduce((a, b) => (b.xpPerHour > a.xpPerHour ? b : a), list[0])
  const priced = list.filter((x) => x.gpPerHour != null)
  const cheapest = priced.length ? priced.reduce((a, b) => (b.gpPerHour / b.xpPerHour > a.gpPerHour / a.xpPerHour ? b : a)) : null
  const tags = [meth.id === fastest.id ? 'fastest here' : '', cheapest && meth.id === cheapest.id ? 'cheapest here' : ''].filter(Boolean)
  const gp = meth.gpPerHour == null ? 'no gp data' : `${formatGp(meth.gpPerHour)}/h`
  return `${meth.name} · lvl ${meth.minLevel}+ · ~${formatNum(meth.xpPerHour)} xp/h · ${gp}${tags.length ? ` · ${tags.join(', ')}` : ''}`
}

function goalMethods(g) {
  const list = relevantMethods(g.skill, levelAtXp(g.currentXp, true), levelAtXp(g.targetXp, true))
  const picked = getMethod(g.methodId)
  return picked && !list.some((x) => x.id === picked.id) ? [...list, picked] : list
}

function daysFor(hours) {
  if (hours == null || !(hoursPerDay.value > 0)) return ''
  const d = Math.ceil(hours / hoursPerDay.value)
  return `${d.toLocaleString()} day${d === 1 ? '' : 's'} at ${hoursPerDay.value} h/day`
}

function gpClass(gp) {
  if (gp == null) return ''
  return gp >= 0 ? 'planner-gain' : 'planner-cost'
}

function playerXp(skill) {
  return player.value?.latest?.skills?.[skill]?.xp ?? null
}

function pickDefaultMethod() {
  // The fastest route is built from what you can actually do at each level.
  form.methodId = AUTO_FAST
}

function onSkillChange() {
  const xp = playerXp(form.skill)
  form.currentXp = xp ?? (form.skill === 'Hitpoints' ? xpAtLevel(10) : 0)
  if (form.targetMode === 'level') {
    // 99 by default; once you're past it, aim at the next virtual level instead.
    form.targetLevel = currentLevel.value < 99 ? 99 : Math.min(currentLevel.value + 1, 126)
  }
  syncTarget()
  form.quests = []
  pickDefaultMethod()
}

// A hand-picked method that no longer applies after you change levels or the
// target (e.g. level 75 Prifddinas for a 1 to 50 goal) falls back to the fastest route.
watch([() => form.skill, currentLevel, formTargetLevel], () => {
  if (form.methodId !== 'custom' && !isAuto(form.methodId) && !skillMethods.value.some((m) => m.id === form.methodId)) pickDefaultMethod()
})

const currentLevelModel = computed({
  get: () => currentLevel.value,
  set: (v) => {
    if (v != null) form.currentXp = xpAtLevel(Math.min(Math.max(v, 1), 126))
  },
})

watch(() => form.targetLevel, () => syncTarget())

function syncTarget() {
  if (form.targetMode === 'level') form.targetXp = xpAtLevel(form.targetLevel || 1)
  else if (form.targetMode === 'max') form.targetXp = MAX_XP
}

function addGoal() {
  formError.value = ''
  syncTarget()
  const currentXp = Math.min(Math.max(Math.floor(form.currentXp || 0), 0), MAX_XP)
  const targetXp = Math.min(Math.floor(form.targetXp || 0), MAX_XP)
  if (form.targetMode === 'level' && !(form.targetLevel >= 1 && form.targetLevel <= 126)) {
    formError.value = 'Target level must be between 1 and 126.'
    return
  }
  if (currentXp >= MAX_XP) {
    formError.value = 'You already have 200M XP in this skill.'
    return
  }
  if (targetXp <= currentXp) {
    formError.value = 'Your target has to be higher than your current XP.'
    return
  }
  if (form.methodId === 'custom' && !(form.customXpPerHour > 0)) {
    formError.value = 'Enter an XP/hour rate for a custom method.'
    return
  }
  const goal = {
    skill: form.skill,
    currentXp,
    targetXp,
    methodId: form.methodId,
    customXpPerHour: form.methodId === 'custom' ? form.customXpPerHour : 0,
    quests: [...form.quests],
  }
  const existing = goals.value.findIndex((g) => g.skill === form.skill)
  if (existing >= 0) goals.value.splice(existing, 1, goal)
  else goals.value.push(goal)
  form.quests = []
  track('planner_goal_added', { skill: goal.skill, method: goal.methodId })
}

function removeGoal(i) {
  goals.value.splice(i, 1)
}

async function loadPlayer() {
  suggestions.value = []
  const name = username.value.trim()
  if (!name) return
  // OSRS names: 1-12 letters, digits, spaces, hyphens or underscores.
  if (!/^[A-Za-z0-9 _-]{1,12}$/.test(name)) {
    player.value = null
    lookupError.value = 'Usernames are 1–12 characters: letters, numbers, spaces, hyphens or underscores.'
    return
  }
  lookingUp.value = true
  lookupError.value = ''
  try {
    if (!store.loaded) await store.loadPlayers()
    const find = () => store.players.find((p) => p.username.toLowerCase() === name.toLowerCase())
    // Existing TickGains players load straight from the database; unknown
    // ones are added through the normal tracking flow (Hiscores lookup +
    // history import), so searching here also starts tracking them.
    if (!find()) await store.addPlayer(name)
    const found = find()
    if (!found?.latest) throw new Error('No stats found for that player yet.')
    player.value = found
    username.value = found.displayName
    // Recalculate everything already in the plan from the fresh stats.
    for (const g of goals.value) {
      const xp = playerXp(g.skill)
      if (xp != null) g.currentXp = xp
    }
    onSkillChange()
  } catch (err) {
    player.value = null
    lookupError.value = err?.message || 'Could not find that player on the OSRS Hiscores.'
  } finally {
    lookingUp.value = false
  }
}

function planUrl() {
  const params = encodePlan({ username: player.value?.username || '', hoursPerDay: hoursPerDay.value, goals: goals.value })
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
    `Total: ${formatNum(t.totalXp)} xp · ${formatHours(t.totalHours)}${t.netGp != null ? ` · ${formatGp(t.netGp)}` : ''}${t.days != null ? ` · ~${t.days} days at ${hoursPerDay.value}h/day` : ''}`,
    planUrl(),
  ].join('\n')
  copy(text, 'Summary copied')
}

// Keep the address bar + localStorage in sync so a refresh or a shared link
// restores the plan. Parameterized URLs are marked noindex.
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
  [goals, hoursPerDay, player],
  () => {
    const state = { username: player.value?.username || username.value, hoursPerDay: hoursPerDay.value, goals: goals.value }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage unavailable, URL sharing still works */
    }
    // history.replaceState (not router.replace) so syncing the URL never
    // triggers the router's scroll-to-top while dragging the slider.
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
      restored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    } catch {
      restored = null
    }
  }
  if (restored) {
    goals.value = restored.goals || []
    hoursPerDay.value = restored.hoursPerDay || 2
    username.value = restored.username || ''
  }
  onSkillChange()
  // Re-hydrate a previously-loaded username so current xp reflects the latest snapshot.
  if (username.value) await loadPlayer()
})
</script>
