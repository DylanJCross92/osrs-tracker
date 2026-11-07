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
      <form class="add-player-form" @submit.prevent="loadPlayer">
        <input type="text" name="username" autocomplete="username" class="autofill-decoy" tabindex="-1" aria-hidden="true" />
        <input type="password" name="password" autocomplete="current-password" class="autofill-decoy" tabindex="-1" aria-hidden="true" />
        <input v-model="username" type="text" name="rsn" placeholder="OSRS username (optional)" autocomplete="off" maxlength="12" :disabled="lookingUp" />
        <button class="btn btn-primary" type="submit" :disabled="lookingUp || !username.trim()">
          {{ lookingUp ? 'Finding…' : 'Find Player' }}
        </button>
      </form>
      <p v-if="lookupError" class="planner-error">{{ lookupError }} You can still plan manually below.</p>
      <p v-else-if="!player" class="planner-hint">No username? Skip this and enter your current level or XP manually.</p>

      <div v-if="player" class="planner-player">
        <b>{{ player.displayName }}</b>
        <span>Total level {{ player.latest.overallLevel.toLocaleString() }}</span>
        <span>{{ formatNum(player.latest.overallXp) }} XP</span>
        <span>Updated {{ formatRelative(player.latest.capturedAt) }}</span>
        <RouterLink :to="{ name: 'playerDetail', params: { username: player.username } }">View TickGains profile →</RouterLink>
      </div>
    </div>

    <!-- Section 2: add skill goal -->
    <div class="card">
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
          <span>Target method</span>
          <select v-model="form.methodId">
            <option v-for="meth in skillMethods" :key="meth.id" :value="meth.id">
              {{ meth.name }}{{ meth.fastest ? ' ★ Fastest' : '' }} (lvl {{ meth.minLevel }}+, ~{{ formatNum(meth.xpPerHour) }} xp/h)
            </option>
            <option value="custom">Custom XP/hour…</option>
          </select>
        </label>
        <label v-if="form.methodId === 'custom'">
          <span>XP per hour</span>
          <NumberInput v-model="form.customXpPerHour" :min="1" :max="10000000" />
        </label>
      </div>
      <p class="planner-hint" v-if="formMethod">
        {{ formMethod.description }} · {{ formMethod.intensity }} intensity ·
        {{ formMethod.gpPerHour == null ? 'no GP data' : `${formatGp(formMethod.gpPerHour)}/h` }}
        <template v-if="formMethod.requirements"> · Needs: {{ formMethod.requirements }}</template>
      </p>
      <p class="planner-error" v-if="formError">{{ formError }}</p>
      <button class="btn btn-primary" type="button" @click="addGoal">Add to plan</button>
    </div>

    <!-- Section 3: training plan -->
    <div class="card" v-if="goals.length">
      <h2>Training plan</h2>
      <div class="planner-goals">
        <div v-for="(g, i) in goals" :key="g.skill + i" class="planner-goal">
          <div class="planner-goal-head">
            <img :src="skillIconSrc(g.skill)" :alt="g.skill" width="28" height="28" />
            <b>{{ g.skill }}</b>
            <span class="planner-levels">{{ levelAtXp(g.currentXp, true) }} → {{ levelAtXp(g.targetXp, true) }}</span>
            <button class="btn btn-ghost planner-remove" type="button" @click="removeGoal(i)" :aria-label="`Remove ${g.skill}`">Remove</button>
          </div>
          <div class="planner-goal-grid">
            <div><span>XP remaining</span><b>{{ formatNum(plans[i].remainingXp) }}</b></div>
            <label>
              <span>Target method</span>
              <select v-model="g.methodId">
                <option v-for="meth in methodsForSkill(g.skill)" :key="meth.id" :value="meth.id">{{ meth.name }}</option>
                <option value="custom">Custom XP/hour</option>
              </select>
            </label>
            <label v-if="g.methodId === 'custom'">
              <span>XP/hour</span>
              <NumberInput v-model="g.customXpPerHour" :min="1" :max="10000000" />
            </label>
            <div><span>Est. hours</span><b>{{ formatHours(plans[i].hours) }}</b></div>
            <div v-if="plans[i].netGp != null"><span>Est. GP (approx.)</span><b :class="gpClass(plans[i].netGp)">{{ formatGp(plans[i].netGp) }}</b></div>
          </div>
          <ol v-if="plans[i].segments.length" class="planner-route">
            <li v-for="(seg, k) in plans[i].segments" :key="k" :class="['planner-step', `planner-step-${seg.kind}`, { 'planner-step-gap': !seg.method }]">
              <span class="planner-step-levels">{{ seg.startLevel }} → {{ seg.endLevel }}</span>
              <span class="planner-step-name">
                {{ seg.method ? seg.method.name : 'No catalog method' }}
                <em v-if="seg.kind === 'main'">your chosen method</em>
                <em v-else-if="seg.kind === 'prep'">to unlock it</em>
                <em v-else-if="seg.kind === 'post'">after it caps out</em>
              </span>
              <span class="planner-step-meta">
                {{ formatNum(seg.xp) }} xp<template v-if="seg.xpPerHour"> · ~{{ formatNum(seg.xpPerHour) }} xp/h</template>
              </span>
              <span class="planner-step-hours">{{ seg.hours == null ? '—' : formatHours(seg.hours) }}</span>
            </li>
          </ol>
          <p v-if="plans[i].warning" class="planner-warning">⚠ {{ plans[i].warning }}</p>
        </div>
      </div>
    </div>
    <div class="card" v-else>
      <p class="empty-hint">Add a skill goal above to start your plan.</p>
    </div>

    <!-- Section 4: plan summary -->
    <div class="card" v-if="goals.length">
      <h2>Plan summary</h2>
      <div class="planner-summary">
        <div><span>Total XP remaining</span><b>{{ formatNum(totals.totalXp) }}</b></div>
        <div><span>Total training hours</span><b>{{ formatHours(totals.totalHours) }}</b></div>
        <div v-if="totals.netGp != null">
          <span>Est. GP cost / profit</span>
          <b :class="gpClass(totals.netGp)">{{ formatGp(totals.netGp) }}</b>
          <small v-if="totals.gpIncomplete && totals.netGp != null">some methods have no GP data</small>
        </div>
        <div>
          <span>Days to completion</span>
          <b>{{ totals.days == null ? '—' : totals.days.toLocaleString() }}</b>
          <small v-if="totals.completionDate">≈ {{ totals.completionDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}</small>
        </div>
      </div>
      <label class="planner-playtime">
        <span>Playtime per day: <b>{{ hoursPerDay }} h</b></span>
        <input type="range" min="0.5" max="12" step="0.5" v-model.number="hoursPerDay" />
      </label>
      <p class="planner-hint">GP and time figures are rough estimates from approximate community rates, not guarantees.</p>

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
import { usePlayersStore } from '@/stores/players'
import { useToast } from '@/composables/useToast'
import { setPageMeta } from '@/utils/pageMeta'
import { SKILL_NAMES, skillIconSrc } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'
import { methodsForSkill, getMethod } from '@/data/trainingMethods'
import {
  MAX_XP,
  xpAtLevel,
  levelAtXp,
  planGoal,
  planTotals,
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
  methodId: 'custom',
  customXpPerHour: 50000,
})

const skillMethods = computed(() => methodsForSkill(form.skill))
const formMethod = computed(() => (form.methodId === 'custom' ? null : getMethod(form.methodId)))
const currentLevel = computed(() => levelAtXp(form.currentXp || 0, true))
const plans = computed(() => goals.value.map(planGoal))
const totals = computed(() => planTotals(plans.value, hoursPerDay.value))

function gpClass(gp) {
  if (gp == null) return ''
  return gp >= 0 ? 'planner-gain' : 'planner-cost'
}

function playerXp(skill) {
  return player.value?.latest?.skills?.[skill]?.xp ?? null
}

function pickDefaultMethod() {
  // The skill's fastest method — the route climbs to it from your current
  // level automatically, so it doesn't need to be unlocked yet.
  const list = skillMethods.value
  const chosen = list.find((meth) => meth.fastest) || list[list.length - 1]
  form.methodId = chosen ? chosen.id : 'custom'
}

function onSkillChange() {
  const xp = playerXp(form.skill)
  form.currentXp = xp ?? (form.skill === 'Hitpoints' ? xpAtLevel(10) : 0)
  if (form.targetMode === 'level') {
    // 99 by default; once you're past it, aim at the next virtual level instead.
    form.targetLevel = currentLevel.value < 99 ? 99 : Math.min(currentLevel.value + 1, 126)
  }
  syncTarget()
  pickDefaultMethod()
}

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
  }
  const existing = goals.value.findIndex((g) => g.skill === form.skill)
  if (existing >= 0) goals.value.splice(existing, 1, goal)
  else goals.value.push(goal)
}

function removeGoal(i) {
  goals.value.splice(i, 1)
}

async function loadPlayer() {
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
    showToast('Could not copy — select and copy manually.')
  }
}

function copyLink() {
  copy(planUrl(), 'Plan link copied')
}

function copySummary() {
  const lines = goals.value.map((g, i) => {
    const p = plans.value[i]
    return `${g.skill} ${levelAtXp(g.currentXp, true)} → ${levelAtXp(g.targetXp, true)}: ${formatHours(p.hours)} (${formatNum(p.remainingXp)} xp)`
  })
  const t = totals.value
  const text = [
    `${player.value ? player.value.displayName + "'s " : ''}OSRS plan — TickGains Account Planner`,
    ...lines,
    `Total: ${formatNum(t.totalXp)} xp · ${formatHours(t.totalHours)}${t.days != null ? ` · ~${t.days} days at ${hoursPerDay.value}h/day` : ''}`,
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
      /* storage unavailable — URL sharing still works */
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
