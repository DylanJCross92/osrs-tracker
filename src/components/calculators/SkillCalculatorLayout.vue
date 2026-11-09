<template>
  <div class="calc planner">
    <!-- Header -->
    <section class="card calc-hero">
      <div class="calc-hero-main">
        <nav class="calc-crumbs" aria-label="Breadcrumb"><RouterLink to="/calculators">Calculators</RouterLink> <span aria-hidden="true">/</span> <span>{{ skill }}</span></nav>
        <div class="calc-title">
          <span class="calc-icon"><img :src="skillIconSrc(skill)" :alt="`${skill} icon`" width="52" height="52" /></span>
          <div>
            <span class="calc-eyebrow">{{ info.category }} skill</span>
            <h1>OSRS <span class="home-accent">{{ skill }}</span> Calculator</h1>
          </div>
        </div>
        <p class="calc-lead">{{ info.lead }}</p>
        <ul class="calc-chips">
          <li>Free, no sign-up</li>
          <li>{{ allCount }} training methods</li>
          <li>Time, gp and shareable links</li>
        </ul>
        <div class="calc-head-links">
          <RouterLink to="/planner" class="btn btn-ghost">Account Planner</RouterLink>
          <RouterLink to="/calculators" class="btn btn-ghost">All calculators</RouterLink>
        </div>
      </div>
      <div class="calc-hero-side">
        <h2>Start from your stats</h2>
        <p class="calc-side-sub">Load your {{ skill }} level and XP by username, or skip this and type them in below.</p>
        <CalcPlayerLookup ref="lookup" :skill="skill" @loaded="onPlayer" @cleared="player = null" />
      </div>
    </section>

    <!-- Inputs -->
    <section class="card">
      <h2>Your goal</h2>
      <div class="planner-form calc-form">
        <label>
          <span>Current level</span>
          <NumberInput v-model="currentLevelModel" :min="1" :max="126" />
        </label>
        <label>
          <span>Current XP</span>
          <NumberInput v-model="currentXp" :min="0" :max="MAX_XP" />
        </label>
        <label>
          <span>Goal</span>
          <select v-model="targetMode" @change="syncTarget">
            <option value="level">Target level</option>
            <option value="xp">Target XP</option>
            <option value="max">200M XP</option>
          </select>
        </label>
        <label v-if="targetMode === 'level'">
          <span>Target level</span>
          <NumberInput v-model="targetLevel" :min="1" :max="126" />
        </label>
        <label v-else-if="targetMode === 'xp'">
          <span>Target XP</span>
          <NumberInput v-model="targetXpInput" :min="0" :max="MAX_XP" />
        </label>
        <label v-else><span>Target XP</span><input type="text" :value="formatNum(MAX_XP)" disabled /></label>
        <label>
          <span>Playtime per day (hours)</span>
          <NumberInput v-model="hoursPerDayInt" :min="1" :max="24" />
        </label>
      </div>

      <div class="calc-strategy">
        <span class="strategy-label">Training strategy</span>
        <div class="range-tabs strategy-tabs" role="group" aria-label="Training strategy">
          <button v-for="st in STRATEGIES" :key="st" type="button" :class="{ active: methodChoice === 'strategy' && strategy === st }" :title="STRATEGY_HINTS[st]" @click="setStrategy(st)">{{ TAB_LABELS[st] }}</button>
        </div>
      </div>
      <p class="planner-hint">{{ methodChoice === 'strategy' ? STRATEGY_HINTS[strategy] : 'You picked a specific method below. Choose a strategy above to let the calculator pick the route.' }}</p>

      <div class="calc-method-row">
        <div class="calc-method-picker">
          <span>Training method</span>
          <MethodPicker v-model="methodChoice" :methods="methods" :routes="methodRoutes" />
        </div>
        <template v-if="methodChoice === 'custom'">
          <label><span>XP per hour</span><NumberInput v-model="customXp" :min="1" :max="10000000" /></label>
          <label><span>GP per hour (optional)</span><NumberInput v-model="customGp" :min="0" :max="1000000000" /></label>
        </template>
      </div>
      <p v-if="method" class="planner-hint">
        {{ method.description }} · {{ method.intensity }} intensity ·
        <GpTip :method="method">{{ method.gpPerHour == null ? 'no GP data' : `${formatGp(method.gpPerHour)}/h` }}</GpTip>
        <template v-if="method.requirements"> · Needs: {{ method.requirements }}</template>
      </p>
      <details v-if="methods.length > 2" class="planner-all-methods calc-filter" :open="filterOpen" @toggle="filterOpen = $event.target.open">
        <summary>Choose which methods to use<span v-if="excluded.size" class="calc-filter-count"> ({{ allowedCount }} of {{ allCount }} on)</span></summary>
        <p class="planner-hint">The route only uses the methods that are ticked, picking the best one at each level. Untick any you do not want to do.</p>
        <div class="calc-filter-actions">
          <button class="btn btn-ghost" type="button" @click="clearFilter">Use all methods</button>
          <button v-for="pr in presets" :key="pr.label" class="btn btn-ghost" type="button" @click="applyPreset(pr)">{{ pr.label }}</button>
        </div>
        <ul class="calc-filter-list">
          <li v-for="meth in methods" :key="meth.id">
            <label>
              <input type="checkbox" :checked="!excluded.has(meth.id)" :disabled="!excluded.has(meth.id) && allowedCount <= 1" @change="toggleMethod(meth.id)" />
              <span>{{ meth.name }}<small> lvl {{ meth.minLevel }}{{ meth.maxLevel != null ? ` to ${meth.maxLevel}` : '+' }}</small></span>
            </label>
          </li>
        </ul>
      </details>
      <p v-if="inputError" class="planner-error">{{ inputError }}</p>
    </section>

    <!-- Results -->
    <section class="card calc-results" aria-live="polite">
      <h2>Results</h2>
      <template v-if="plan && plan.remainingXp > 0">
        <div class="plan-tiles">
          <div class="plan-tile"><span>XP remaining</span><b>{{ formatNum(plan.remainingXp) }}</b><small v-if="plan.questXp">{{ formatNum(plan.questXp) }} covered by quests</small></div>
          <div class="plan-tile"><span>Estimated time</span><b>{{ formatHours(plan.hours) }}</b><small>{{ levelAtXp(currentXpNum, true) }} → {{ levelAtXp(targetXpNum, true) }}</small></div>
          <div class="plan-tile">
            <span>Estimated GP</span>
            <b :class="gpClass(plan.netGp)">{{ plan.netGp == null ? 'No GP data' : formatGp(plan.netGp) }}</b>
            <small v-if="plan.gpPartial" class="gp-incomplete">Incomplete: some steps are unpriced</small>
            <small v-else-if="plan.netGp != null">{{ plan.netGp >= 0 ? 'estimated profit' : 'estimated cost' }}</small>
          </div>
          <div class="plan-tile plan-tile-finish">
            <span>Completion</span>
            <b>{{ days == null ? '-' : `${days.toLocaleString('en-US')} day${days === 1 ? '' : 's'}` }}</b>
            <small v-if="finishDate">≈ {{ finishDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }} at {{ hoursPerDay }} h/day</small>
          </div>
        </div>

        <ul v-if="extras.length" class="calc-extras">
          <li v-for="e in extras" :key="e.label"><span>{{ e.label }}</span><b :class="e.cls">{{ e.value }}</b></li>
        </ul>
        <p v-if="plan.warning" class="planner-warning">⚠ {{ plan.warning }}</p>

        <div class="calc-actions">
          <button class="btn btn-primary" type="button" @click="copyLink">Copy link</button>
          <button class="btn btn-ghost" type="button" @click="addToPlanner">Add to Account Planner</button>
        </div>
        <p class="planner-hint">GP and time are approximate estimates from community rates, net of supplies and loot. Price data comes from the planner's catalog and has no live timestamp.</p>
      </template>
      <p v-else class="empty-hint">{{ inputError ? 'Fix the goal above to see your results.' : 'You have already reached this target. Pick a higher goal.' }}</p>
    </section>

    <template v-if="plan && plan.remainingXp > 0">
      <!-- Agility laps -->
      <section v-if="laps.length" class="card">
        <h2>Laps and marks of grace</h2>
        <div class="planner-table-scroll">
          <table class="planner-table">
            <thead><tr><th>Course</th><th>Levels</th><th class="num">Laps</th><th class="num">Marks of grace</th></tr></thead>
            <tbody>
              <tr v-for="l in laps" :key="l.name">
                <td>{{ l.name }}</td>
                <td>{{ l.levels }}</td>
                <td class="num">{{ l.laps == null ? 'No lap data' : formatNum(l.laps) }}</td>
                <td class="num">{{ l.laps == null ? '-' : !l.marks ? 'None' : l.marks[0] === l.marks[1] ? `~${formatNum(l.marks[0])}` : `${formatNum(l.marks[0])} to ${formatNum(l.marks[1])}` }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="planner-hint">Laps use each course's xp per lap. Marks of grace are the wiki's per-hour range, which depends on your Achievement Diaries.</p>
      </section>

      <!-- Resources -->
      <section v-if="hasMaterials" class="card"><PlannerMaterials :plan="plan" :title="info.resources" /></section>

      <!-- Comparison -->
      <section v-if="methods.length > 1" class="card">
        <PlannerCompare :goal="goal" :plans="strategyPlans" :plan="plan" :selected-id="resolvedId" @pick="pickRoute" />
      </section>

      <!-- Quests -->
      <section v-if="hasQuests" class="card">
        <PlannerQuests v-model="quests" :skill="skill" :current-xp="currentXpNum" :target-xp="targetXpNum" :method-id="resolvedId" />
      </section>

      <!-- Route -->
      <section class="card">
        <details class="planner-all-methods calc-route" open>
          <summary>Level-by-level route</summary>
          <PlannerRoute :segments="plan.segments" />
        </details>
      </section>
    </template>

    <!-- Guide -->
    <section class="card calc-guide">
      <h2>How the {{ skill }} calculator works</h2>
      <p v-for="(para, i) in info.guide" :key="i">{{ para }}</p>
      <p>XP remaining comes from your current XP, not just your level, using the game's own XP table. Time is XP divided by each method's XP per hour, and the route switches method whenever a better one unlocks at a higher level. <RouterLink to="/planner">Combine several skills in the Account Planner</RouterLink> to see the total time for a whole account.</p>
      <div class="calc-related">
        <b>More calculators</b>
        <RouterLink v-for="r in related" :key="r.slug" :to="`/calculators/${r.slug}`">{{ r.name }}</RouterLink>
        <RouterLink to="/calculators">All calculators</RouterLink>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NumberInput from '@/components/NumberInput.vue'
import GpTip from '@/components/planner/GpTip.vue'
import PlannerRoute from '@/components/planner/PlannerRoute.vue'
import PlannerQuests from '@/components/planner/PlannerQuests.vue'
import PlannerCompare from '@/components/planner/PlannerCompare.vue'
import PlannerMaterials from '@/components/planner/PlannerMaterials.vue'
import MethodPicker from '@/components/planner/MethodPicker.vue'
import CalcPlayerLookup from '@/components/calculators/CalcPlayerLookup.vue'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'
import { skillIconSrc } from '@/utils/osrsSkills'
import { getMethod, methodsForSkill } from '@/data/trainingMethods'
import { questsForSkill } from '@/data/quests'
import { SKILL_INFO } from '@/data/skillInfo'
import {
  MAX_XP,
  AUTO_FAST,
  AUTO_CHEAP,
  AUTO_BALANCED,
  AUTO_PROFIT,
  GLOBAL_STRATEGY,
  DEFAULT_GP_VALUE,
  isAuto,
  xpAtLevel,
  levelAtXp,
  planGoal,
  compareStrategies,
  relevantMethods,
  profitableMethods,
  formatNum,
  formatHours,
  formatGp,
} from '@/utils/planner'
import { STRATEGY_LABELS, materialsForPlan } from '@/utils/plannerTools'
import { agilityLaps, METHOD_PRESETS } from '@/utils/calculatorExtras'

const props = defineProps({ info: { type: Object, required: true } })
const route = useRoute()
const router = useRouter()
const { showToast } = useToast()

const skill = props.info.name
const BASE_STRATEGIES = [AUTO_FAST, AUTO_CHEAP, AUTO_BALANCED]
const STRATEGY_HINTS = {
  [AUTO_FAST]: 'Minimises training time, whatever it costs.',
  [AUTO_CHEAP]: 'Minimises net gp spent, even if it is slower.',
  [AUTO_BALANCED]: 'A middle ground between speed and cost.',
  [AUTO_PROFIT]: 'Uses whichever method makes the most gp per hour at each level, and the cheapest one where nothing makes money.',
}
const TAB_LABELS = { [AUTO_FAST]: 'Fastest', [AUTO_CHEAP]: 'Cheapest', [AUTO_BALANCED]: 'Balanced', [AUTO_PROFIT]: 'Profitable' }
const PLANNER_KEY = 'tickgains-planner-v1'

// --- Inputs (validated from the URL so shared links restore the same calculation) ---
const q = route.query
const intParam = (v, lo, hi) => {
  const n = parseInt(Array.isArray(v) ? v[0] : v, 10)
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : null
}
const strParam = (v) => (typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : '')

const currentXp = ref(intParam(q.currentXp, 0, MAX_XP) ?? 0)
const targetMode = ref('level')
const targetLevel = ref(99)
const targetXpInput = ref(xpAtLevel(99))
const hoursPerDay = ref(intParam(q.hours, 1, 24) ?? 2)
const strategy = ref(AUTO_FAST)
const methodChoice = ref('strategy')
const customXp = ref(intParam(q.rate, 1, 10_000_000) ?? 50000)
const customGp = ref(intParam(q.gp, 0, 1_000_000_000))
const quests = ref([])
// Methods the user switched off, so routes only use the rest. Stored as the ones to skip.
const allSkillMethods = methodsForSkill(skill)
const excluded = ref(new Set())
// The panel's open state is ours, so ticking boxes never re-opens or closes it.
const filterOpen = ref(false)

// Past 99, aim at the next level instead of a target you already have.
if (levelAtXp(currentXp.value, true) >= 99) targetLevel.value = Math.min(levelAtXp(currentXp.value, true) + 1, 126)
if (intParam(q.targetXp, 1, MAX_XP) != null) {
  targetMode.value = intParam(q.targetXp, 1, MAX_XP) >= MAX_XP ? 'max' : 'xp'
  targetXpInput.value = intParam(q.targetXp, 1, MAX_XP)
} else if (intParam(q.targetLevel, 1, 126) != null) {
  targetLevel.value = intParam(q.targetLevel, 1, 126)
}

const methodParam = strParam(q.method)
const STRATEGY_BY_NAME = { fastest: AUTO_FAST, cheapest: AUTO_CHEAP, balanced: AUTO_BALANCED }
if (STRATEGY_BY_NAME[methodParam]) strategy.value = STRATEGY_BY_NAME[methodParam]
else if (methodParam === 'profitable') strategy.value = AUTO_PROFIT
else if (methodParam === 'custom') methodChoice.value = 'custom'
else if (methodParam) {
  // Accept "prifddinas" or the full id "agility-prifddinas".
  const id = methodParam.startsWith(`${props.info.slug}-`) ? methodParam : `${props.info.slug}-${methodParam}`
  if (getMethod(id)?.skill === skill) methodChoice.value = id
}
excluded.value = new Set(
  strParam(q.skip)
    .split(',')
    .map((x) => (x.startsWith(`${props.info.slug}-`) ? x : `${props.info.slug}-${x}`))
    .filter((id) => allSkillMethods.some((m) => m.id === id)),
)
if (excluded.value.size >= allSkillMethods.length) excluded.value = new Set()
filterOpen.value = excluded.value.size > 0
quests.value = strParam(q.quests)
  .split(',')
  .filter((id) => questsForSkill(skill).some((x) => x.id === id))

const currentXpNum = computed(() => Math.min(Math.max(Math.floor(currentXp.value || 0), 0), MAX_XP))
const targetXpNum = computed(() => {
  if (targetMode.value === 'max') return MAX_XP
  if (targetMode.value === 'level') return xpAtLevel(targetLevel.value || 1)
  return Math.min(Math.floor(targetXpInput.value || 0), MAX_XP)
})
const currentLevelModel = computed({
  get: () => levelAtXp(currentXpNum.value, true),
  set: (v) => {
    if (v != null) currentXp.value = xpAtLevel(Math.min(Math.max(v, 1), 126))
  },
})
const hoursPerDayInt = computed({
  get: () => hoursPerDay.value,
  set: (v) => (hoursPerDay.value = v || 1),
})
function syncTarget() {
  if (targetMode.value === 'level') targetXpInput.value = xpAtLevel(targetLevel.value || 1)
  else if (targetMode.value === 'max') targetXpInput.value = MAX_XP
}
watch(targetLevel, syncTarget)

const inputError = computed(() => {
  if (currentXpNum.value >= MAX_XP) return 'You already have 200M XP in this skill.'
  if (targetMode.value === 'level' && !(targetLevel.value >= 1 && targetLevel.value <= 126)) return 'Target level must be between 1 and 126.'
  if (targetXpNum.value <= currentXpNum.value) return 'Your target has to be higher than your current XP.'
  if (methodChoice.value === 'custom' && !(customXp.value > 0)) return 'Enter an XP/hour rate for a custom method.'
  return ''
})

// --- Methods and calculation (the Account Planner's engine) ---
const methods = computed(() => relevantMethods(skill, levelAtXp(currentXpNum.value, true), levelAtXp(targetXpNum.value, true)))
const method = computed(() => (isAuto(resolvedId.value) || resolvedId.value === 'custom' ? null : getMethod(resolvedId.value)))
const methodRoutes = computed(() => [{ value: 'strategy', label: `Best route (${STRATEGY_LABELS[strategy.value]})`, sub: 'Picks the best method at every level' }])
// The Profitable strategy only appears when something can actually make gp between your levels.
const STRATEGIES = computed(() => (hasProfit.value ? [...BASE_STRATEGIES, AUTO_PROFIT] : BASE_STRATEGIES))
const hasProfit = computed(() => profitableMethods(skill, levelAtXp(currentXpNum.value, true), levelAtXp(targetXpNum.value, true)).length > 0)
const resolvedId = computed(() => (methodChoice.value === 'strategy' ? strategy.value : methodChoice.value))
const goal = computed(() => ({
  skill,
  currentXp: currentXpNum.value,
  targetXp: targetXpNum.value,
  methodId: resolvedId.value,
  customXpPerHour: methodChoice.value === 'custom' ? customXp.value : 0,
  customGpPerHour: methodChoice.value === 'custom' && customGp.value != null ? customGp.value : undefined,
  gpValuePerHour: DEFAULT_GP_VALUE,
  quests: quests.value,
  allowedMethodIds: allowedIds.value,
}))
const allCount = allSkillMethods.length
const allowedCount = computed(() => allCount - excluded.value.size)
const allowedIds = computed(() => (excluded.value.size ? allSkillMethods.filter((m) => !excluded.value.has(m.id)).map((m) => m.id) : null))
const presets = METHOD_PRESETS[skill] || []
function toggleMethod(id) {
  const next = new Set(excluded.value)
  if (next.has(id)) next.delete(id)
  else if (allCount - next.size > 1) next.add(id)
  excluded.value = next
  track('calc_method_filter', { skill })
}
function clearFilter() {
  excluded.value = new Set()
}
function applyPreset(pr) {
  excluded.value = new Set(allSkillMethods.filter((m) => !pr.keep.includes(m.id)).map((m) => m.id))
  track('calc_method_preset', { skill, preset: pr.label })
}
const plan = computed(() => (inputError.value ? null : planGoal(goal.value)))
const strategyPlans = computed(() => (inputError.value ? null : compareStrategies(goal.value)))

// A method that no longer applies after the levels change falls back to the best route.
watch(methods, (list) => {
  if (methodChoice.value !== 'strategy' && methodChoice.value !== 'custom' && !list.some((m) => m.id === methodChoice.value)) methodChoice.value = 'strategy'
})
watch(
  hasProfit,
  (v) => {
    if (!v && strategy.value === AUTO_PROFIT) strategy.value = AUTO_FAST
  },
  { immediate: true },
)

function setStrategy(st) {
  strategy.value = st
  methodChoice.value = 'strategy'
  track('calc_strategy', { skill, strategy: st })
}
function pickRoute(id) {
  if (id === AUTO_PROFIT || BASE_STRATEGIES.includes(id)) setStrategy(id)
  else methodChoice.value = id
}

// --- Results extras: only what the selected route can really support ---
const days = computed(() => (plan.value?.hours != null && hoursPerDay.value > 0 ? Math.ceil(plan.value.hours / hoursPerDay.value) : null))
const finishDate = computed(() => (days.value != null ? new Date(Date.now() + days.value * 86_400_000) : null))
const materials = computed(() => (plan.value ? materialsForPlan(plan.value) : { rows: [], totals: [], actions: 0 }))
const hasMaterials = computed(() => materials.value.rows.length > 0)
const lapData = computed(() => (skill === 'Agility' && plan.value ? agilityLaps(plan.value) : { rows: [], complete: false }))
const laps = computed(() => lapData.value.rows)
const hasQuests = computed(() => questsForSkill(skill).length > 0)
const gpClass = (gp) => (gp == null ? '' : gp >= 0 ? 'planner-gain' : 'planner-cost')
const extras = computed(() => {
  const p = plan.value
  const out = []
  if (!p || !(p.hours > 0)) return out
  out.push({ label: 'Average XP per hour', value: formatNum(p.remainingXp / p.hours) })
  if (p.netGp != null) out.push({ label: 'Average GP per hour', value: formatGp(p.netGp / p.hours), cls: gpClass(p.netGp) })
  if (hasMaterials.value && materials.value.actions > 0) out.push({ label: 'Actions required', value: formatNum(materials.value.actions) })
  if (laps.value.length && lapData.value.complete) out.push({ label: 'Laps required', value: formatNum(laps.value.reduce((a, l) => a + l.laps, 0)) })
  return out
})

function methodLabel(meth, list) {
  const fastest = list.reduce((a, b) => (b.xpPerHour > a.xpPerHour ? b : a), list[0])
  const profit = list.filter((x) => x.gpPerHour != null && x.gpPerHour > 0)
  const top = profit.length ? profit.reduce((a, b) => (b.gpPerHour > a.gpPerHour ? b : a)) : null
  const tags = [meth.id === fastest.id ? 'fastest here' : '', top && meth.id === top.id ? 'MOST PROFITABLE' : meth.gpPerHour > 0 ? 'Profitable' : ''].filter(Boolean)
  const gp = meth.gpPerHour == null ? 'no gp data' : `${formatGp(meth.gpPerHour)}/h`
  return `${meth.name} · lvl ${meth.minLevel}+ · ~${formatNum(meth.xpPerHour)} xp/h · ${gp}${tags.length ? ` · ${tags.join(', ')}` : ''}`
}

// --- Player lookup ---
const player = ref(null)
function onPlayer(p) {
  player.value = p
  const xp = p.latest?.skills?.[skill]?.xp
  if (xp != null) {
    currentXp.value = xp
    if (levelAtXp(xp, true) >= 99 && targetMode.value === 'level') targetLevel.value = Math.min(levelAtXp(xp, true) + 1, 126)
  }
}

// --- Sharing ---
function shareParams() {
  const p = new URLSearchParams()
  p.set('currentXp', String(currentXpNum.value))
  if (targetMode.value === 'level') p.set('targetLevel', String(targetLevel.value))
  else p.set('targetXp', String(targetXpNum.value))
  const idParam = methodChoice.value === 'strategy' ? { [AUTO_FAST]: 'fastest', [AUTO_CHEAP]: 'cheapest', [AUTO_BALANCED]: 'balanced', [AUTO_PROFIT]: 'profitable' }[strategy.value] : methodChoice.value === 'custom' ? 'custom' : methodChoice.value.replace(`${props.info.slug}-`, '')
  p.set('method', idParam)
  if (methodChoice.value === 'custom') {
    p.set('rate', String(customXp.value))
    if (customGp.value != null) p.set('gp', String(customGp.value))
  }
  if (hoursPerDay.value !== 2) p.set('hours', String(hoursPerDay.value))
  if (quests.value.length) p.set('quests', quests.value.join(','))
  if (excluded.value.size) p.set('skip', [...excluded.value].map((id) => id.replace(`${props.info.slug}-`, '')).join(','))
  return p
}
const shareUrl = () => `${window.location.origin}/calculators/${props.info.slug}?${shareParams().toString()}`

watch(
  [currentXpNum, targetXpNum, targetMode, targetLevel, methodChoice, strategy, customXp, customGp, hoursPerDay, quests, excluded],
  () => window.history.replaceState(window.history.state, '', `/calculators/${props.info.slug}?${shareParams().toString()}`),
  { deep: true },
)

async function copyLink() {
  track('calc_share', { skill })
  try {
    await navigator.clipboard.writeText(shareUrl())
    showToast('Calculator link copied')
  } catch {
    showToast('Could not copy, select and copy the address bar instead.')
  }
}

// Adds (or replaces) this skill's goal in the saved Account Planner plan, then opens the planner.
function addToPlanner() {
  track('calc_add_to_planner', { skill })
  let state = {}
  try {
    state = JSON.parse(localStorage.getItem(PLANNER_KEY) || '{}') || {}
  } catch {
    state = {}
  }
  const goals = Array.isArray(state.goals) ? state.goals.filter((g) => g.skill !== skill) : []
  goals.push({
    skill,
    currentXp: currentXpNum.value,
    targetXp: targetXpNum.value,
    methodId: methodChoice.value === 'strategy' && strategy.value === (state.strategy || AUTO_FAST) ? GLOBAL_STRATEGY : resolvedId.value,
    customXpPerHour: methodChoice.value === 'custom' ? customXp.value : 0,
    quests: [...quests.value],
    allowedMethodIds: allowedIds.value || undefined,
  })
  const next = {
    ...state,
    goals: goals.slice(0, 24),
    hoursPerDay: state.hoursPerDay || hoursPerDay.value,
    username: state.username || player.value?.username || '',
  }
  try {
    localStorage.setItem(PLANNER_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable: the planner opens with whatever it already had */
  }
  router.push('/planner')
}

const related = computed(() => SKILL_INFO.filter((x) => x.category === props.info.category && x.slug !== props.info.slug).slice(0, 6))

onMounted(() => track('calc_view', { skill }))
</script>
