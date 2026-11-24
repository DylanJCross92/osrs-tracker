<template>
  <div class="se" :aria-label="`Edit ${goal.skill}`">
    <div class="se-bar">
      <nav class="se-tabs" role="tablist" :aria-label="`${goal.skill} options`">
        <button v-for="t in tabs" :key="t.key" type="button" role="tab" class="se-tab" :class="{ on: tab === t.key }" :aria-selected="tab === t.key" @click="tab = t.key">
          {{ t.label }}<i v-if="t.badge" :class="t.badgeClass">{{ t.badge }}</i>
        </button>
      </nav>
    </div>

    <!-- The goal, then how it is trained -->
    <div v-if="tab === 'method'" class="se-panel" role="tabpanel">
      <section class="se-field">
        <h4>Your goal</h4>
        <p class="se-hint">Where {{ goal.skill }} starts and the level this plan takes it to. The route and times update straight away.</p>
        <div v-if="goal.allowedMethodIds?.length" class="planner-notice">
          This skill only uses {{ goal.allowedMethodIds.length }} chosen method{{ goal.allowedMethodIds.length === 1 ? '' : 's' }} (set in the skill calculator).
          <button class="btn-text" type="button" @click="$emit('patch', { allowedMethodIds: null })">Use all methods</button>
        </div>
        <div class="se-levels">
          <label>
            <span>From level</span>
            <NumberInput :model-value="startLevel" :min="1" :max="MAX_VIRTUAL_LEVEL" commit="blur" @update:model-value="setStartLevel" />
          </label>
          <span class="se-arrow" aria-hidden="true">→</span>
          <label>
            <span>Goal level</span>
            <NumberInput :model-value="endLevel" :min="2" :max="MAX_VIRTUAL_LEVEL" commit="blur" @update:model-value="setTargetLevel" />
          </label>
        </div>
      </section>

      <section class="se-field">
        <h4>Training method</h4>
        <p class="se-hint">The planner picks the {{ globalLabel }} route for every skill. Choose another strategy, or one method to use for {{ goal.skill }}.</p>
        <div class="se-pick">
          <MethodPicker :model-value="goal.methodId" :methods="methods" :routes="methodRoutes" @update:model-value="$emit('patch', { methodId: $event })" />
          <label v-if="goal.methodId === 'custom'" class="se-inline">
            <span>XP per hour</span>
            <NumberInput :model-value="goal.customXpPerHour" :min="1" :max="10000000" commit="blur" @update:model-value="$emit('patch', { customXpPerHour: $event })" />
          </label>
        </div>
        <p v-if="method" class="se-hint">
          {{ method.description }} · {{ method.intensity }} intensity<span class="gp-figure"> ·
          <GpTip :method="method">{{ method.gpPerHour == null ? 'no GP data' : `${formatGp(method.gpPerHour)}/h` }}</GpTip></span>
        </p>
        <button v-if="isOverride" class="btn-text" type="button" @click="$emit('patch', { methodId: GLOBAL_STRATEGY })">Use the plan's strategy again</button>
      </section>

      <section class="se-field">
        <h4>Route by level</h4>
        <p class="se-hint">Tap a step to choose a different method for those levels.</p>
        <PlannerRoute :segments="plan.segments" :quests="plan.questList" :skill="goal.skill" @set="setRange" />
        <p v-if="overrideCount" class="se-hint">
          You chose the method for {{ overrideCount }} set{{ overrideCount === 1 ? '' : 's' }} of levels.
          <button class="btn-text" type="button" @click="$emit('patch', { overrides: [] })">Back to recommended</button>
        </p>
        <div class="route-range">
          <button class="btn-text" type="button" :aria-expanded="rangeOpen" @click="toggleRange">{{ rangeOpen ? 'Close' : '+ Pick a method for a range of levels' }}</button>
          <div v-if="rangeOpen" class="route-range-form">
            <label><span>From level</span><NumberInput :model-value="rangeFrom" :min="startLevel" :max="endLevel - 1" commit="blur" @update:model-value="(v) => v && (rangeFrom = Math.min(Math.max(v, startLevel), endLevel - 1))" /></label>
            <span class="goal-levels-arrow" aria-hidden="true">→</span>
            <label><span>To level</span><NumberInput :model-value="rangeTo" :min="startLevel + 1" :max="endLevel" commit="blur" @update:model-value="(v) => v && (rangeTo = Math.min(Math.max(v, startLevel + 1), endLevel))" /></label>
            <div class="route-range-pick">
              <span>Method</span>
              <MethodPicker v-if="rangeMethods.length && rangeTo > rangeFrom" inline model-value="" :methods="rangeMethods" :allow-custom="false" @update:model-value="applyRange" />
              <small v-else class="planner-hint">{{ rangeTo > rangeFrom ? 'No single method covers all of those levels. Try a shorter range.' : 'Pick a target level above the start level.' }}</small>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- What you need to have unlocked -->
    <div v-else-if="tab === 'requirements'" class="se-panel goal-reqs" role="tabpanel">
      <section class="se-field">
        <h4>Requirements</h4>
        <p v-if="chosenBlocked" class="planner-warning">
          ⚠ {{ chosenBlocked.method.name }} may not be accessible: {{ unmetNames(chosenBlocked) }} {{ chosenBlocked.unmet.length === 1 ? 'is' : 'are' }} marked as missing.
          <button class="btn-text" type="button" @click="$emit('patch', { methodId: GLOBAL_STRATEGY })">Use the plan's strategy instead</button>
        </p>
        <p v-else-if="blockedInRoute.length" class="planner-warning">
          <template v-if="respect">⚠ Part of this route uses {{ blockedInRoute.map((a) => a.method.name).join(', ') }}, which you are missing something for. No other method covers that stretch of levels.</template>
          <template v-else>⚠ This route uses {{ blockedInRoute.map((a) => a.method.name).join(', ') }}, which you are missing something for, because "Skip methods I can't use yet" is off.</template>
        </p>
        <p v-else-if="routeState === 'unconfirmed'" class="se-hint">Confirm what you already have. Anything you are not sure about is treated as available, so nothing is hidden from you.</p>
        <p v-else class="se-hint">Everything this route needs is covered.</p>
        <div v-for="a in routeMethods" :key="a.method.id" class="goal-req-method" :class="`is-${a.state}`">
          <div class="goal-req-head">
            <b>{{ a.method.name }}</b>
            <span class="goal-req-state">{{ STATE_TEXT[a.state] }}</span>
          </div>
          <RequirementList :items="a.items" :method-name="a.method.name" />
        </div>
        <p class="se-hint">
          <template v-if="loggedIn">Your answers are saved to your account and used in every plan. <RouterLink :to="{ name: 'account', hash: '#quests' }">Open your quest tracker</RouterLink></template>
          <template v-else>Your answers are saved in this browser. <RouterLink :to="{ name: 'login', query: { next: '/account' } }">Log in</RouterLink> to keep them on your account and use them on every device.</template>
        </p>
      </section>
    </div>

    <!-- Quest shortcuts -->
    <div v-else-if="tab === 'quests'" class="se-panel" role="tabpanel">
      <PlannerQuests
        :model-value="goal.quests"
        :skill="goal.skill"
        :current-xp="planned.currentXp"
        :target-xp="goal.targetXp"
        :method-id="resolvedId"
        :gp-value="gpValue"
        @update:model-value="$emit('patch', { quests: $event })"
      />
    </div>

    <!-- Everything else -->
    <div v-else class="se-panel" role="tabpanel">
      <section class="se-field">
        <h4>Compare routes</h4>
        <PlannerCompare :goal="resolved" :plans="compare" :plan="plan" :selected-id="resolvedId" @pick="(id) => $emit('pick', id)" />
      </section>
      <section v-if="hasMaterials" class="se-field">
        <h4>Materials needed</h4>
        <PlannerMaterials :plan="plan" />
      </section>
      <section class="se-field">
        <button class="se-remove" type="button" @click="$emit('remove')">Remove {{ goal.skill }} from the plan</button>
      </section>
    </div>
  
    <div class="se-foot">
      <button class="btn btn-ghost" type="button" @click="$emit('cancel')">Cancel</button>
      <button class="btn btn-primary" type="button" @click="$emit('done')">Save</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import NumberInput from '@/components/NumberInput.vue'
import PlannerRoute from '@/components/planner/PlannerRoute.vue'
import PlannerQuests from '@/components/planner/PlannerQuests.vue'
import PlannerCompare from '@/components/planner/PlannerCompare.vue'
import PlannerMaterials from '@/components/planner/PlannerMaterials.vue'
import MethodPicker from '@/components/planner/MethodPicker.vue'
import GpTip from '@/components/planner/GpTip.vue'
import RequirementList from '@/components/planner/RequirementList.vue'
import { methodsForSkill, getMethod } from '@/data/trainingMethods'
import { questsForSkill } from '@/data/quests'
import { useRouteRequirements } from '@/composables/useRouteRequirements'
import { useRequirements } from '@/composables/useRequirements'
import { useAuth } from '@/composables/useAuth'
import {
  AUTO_FAST,
  AUTO_CHEAP,
  AUTO_BALANCED,
  AUTO_PROFIT,
  GLOBAL_STRATEGY,
  isAuto,
  levelAtXp,
  xpAtLevel,
  MAX_VIRTUAL_LEVEL,
  MAX_XP,
  setOverrideRange,
  relevantMethods,
  profitableMethods,
  formatGp,
} from '@/utils/planner'
import { STRATEGY_LABELS, materialsForPlan } from '@/utils/plannerTools'

// Everything about one skill's plan, in one place: how it is trained, the levels, what it needs, quest shortcuts and the rest.
// Changes go up as `patch` events and the plan page recalculates, so the route above it is always current.
const props = defineProps({
  goal: { type: Object, required: true },
  plan: { type: Object, required: true },
  compare: { type: Object, required: true },
  globalStrategy: { type: String, required: true },
  gpValue: { type: Number, required: true },
  index: { type: Number, required: true },
  count: { type: Number, required: true },
  // The goal as it stands today (start moved up to tracked XP).
  liveGoal: { type: Object, default: null },
  // Which tab opens first.
  initialTab: { type: String, default: 'method' },
})
const emit = defineEmits(['patch', 'pick', 'remove', 'done', 'cancel'])

const { respect } = useRequirements()
const { loggedIn } = useAuth()
const STATE_TEXT = { blocked: 'Requirement missing', unconfirmed: 'Needs confirming', planned: 'Your plan covers it', available: 'Requirements met' }

const isOverride = computed(() => props.goal.methodId !== GLOBAL_STRATEGY)
const resolvedId = computed(() => (props.goal.methodId === GLOBAL_STRATEGY ? props.globalStrategy : props.goal.methodId))
const planned = computed(() => props.liveGoal || props.goal)
const resolved = computed(() => ({ ...planned.value, methodId: resolvedId.value, gpValuePerHour: props.gpValue }))
const method = computed(() => (isAuto(resolvedId.value) || resolvedId.value === 'custom' ? null : getMethod(resolvedId.value)))
const startLevel = computed(() => levelAtXp(props.goal.currentXp, true))
const endLevel = computed(() => levelAtXp(props.goal.targetXp, true))
const plannedLevel = computed(() => levelAtXp(planned.value.currentXp, true))
const globalLabel = computed(() => (STRATEGY_LABELS[props.globalStrategy] || 'Fastest').toLowerCase())

// --- Requirements of every method the route uses, plus the one picked by hand
const { routeMethods, routeState } = useRouteRequirements(computed(() => props.plan), method)
const chosenBlocked = computed(() => {
  const a = method.value ? routeMethods.value.find((x) => x.method.id === method.value.id) : null
  return a && a.state === 'blocked' ? a : null
})
const blockedInRoute = computed(() => routeMethods.value.filter((a) => a.state === 'blocked' && a.method.id !== method.value?.id))
const unmetNames = (a) => a.unmet.map((i) => i.req.label).join(', ')

// --- Levels
function setStartLevel(level) {
  if (!level) return
  emit('patch', { currentXp: xpAtLevel(Math.min(level, MAX_VIRTUAL_LEVEL)) })
}
function setTargetLevel(level) {
  if (!level) return
  emit('patch', { targetXp: Math.min(xpAtLevel(Math.min(level, MAX_VIRTUAL_LEVEL)), MAX_XP) })
}

// --- Method choices
const methods = computed(() => {
  const list = relevantMethods(props.goal.skill, plannedLevel.value, endLevel.value)
  const picked = getMethod(props.goal.methodId)
  return picked && !list.some((x) => x.id === picked.id) ? [...list, picked] : list
})
const profitable = computed(() => profitableMethods(props.goal.skill, plannedLevel.value, endLevel.value))
const methodRoutes = computed(() => [
  { value: GLOBAL_STRATEGY, label: 'Follow the plan strategy', sub: STRATEGY_LABELS[props.globalStrategy] },
  { value: AUTO_FAST, label: 'Fastest route' },
  { value: AUTO_CHEAP, label: 'Cheapest route' },
  { value: AUTO_BALANCED, label: 'Balanced route' },
  ...(profitable.value.length ? [{ value: AUTO_PROFIT, label: 'Best gp per hour route' }] : []),
])

// --- Methods chosen by hand for some levels: from the route rows, or from a range typed below them
const overrideCount = computed(() => (props.goal.overrides || []).length)
function setRange({ fromLevel, toLevel, methodId }) {
  emit('patch', { overrides: setOverrideRange(props.goal.overrides, fromLevel, toLevel, methodId) })
}
const rangeOpen = ref(false)
const rangeFrom = ref(1)
const rangeTo = ref(2)
function toggleRange() {
  rangeOpen.value = !rangeOpen.value
  if (rangeOpen.value) {
    rangeFrom.value = Math.min(startLevel.value, endLevel.value - 1)
    rangeTo.value = Math.min(endLevel.value, rangeFrom.value + 10)
  }
}
const rangeMethods = computed(() => methodsForSkill(props.goal.skill).filter((m) => m.minLevel <= rangeFrom.value && (m.maxLevel == null || m.maxLevel >= rangeTo.value - 1)))
function applyRange(id) {
  setRange({ fromLevel: rangeFrom.value, toLevel: rangeTo.value, methodId: id })
  rangeOpen.value = false
}

// --- Extras
const hasQuests = computed(() => questsForSkill(props.goal.skill).length > 0)
const hasMaterials = computed(() => materialsForPlan(props.plan).rows.length > 0)

// --- Tabs
const blockedCount = computed(() => routeMethods.value.filter((a) => a.state === 'blocked').length)
const tabs = computed(() => [
  { key: 'method', label: 'Goal & method', badge: overrideCount.value ? 'edited' : '', badgeClass: 'se-badge' },
  ...(routeMethods.value.length
    ? [{ key: 'requirements', label: 'Requirements', badge: blockedCount.value ? `${blockedCount.value} missing` : routeState.value === 'unconfirmed' ? 'confirm' : '', badgeClass: blockedCount.value ? 'se-badge is-bad' : 'se-badge' }]
    : []),
  ...(hasQuests.value ? [{ key: 'quests', label: 'Quests', badge: (props.goal.quests || []).length ? String(props.goal.quests.length) : '', badgeClass: 'se-badge' }] : []),
  { key: 'more', label: 'More' },
])
const tab = ref(props.initialTab)
watch(
  () => props.initialTab,
  (t) => (tab.value = t),
)
// A tab that no longer exists (the last blocked method was swapped out) falls back to the first one.
watch(tabs, (list) => {
  if (!list.some((t) => t.key === tab.value)) tab.value = 'method'
})
</script>
