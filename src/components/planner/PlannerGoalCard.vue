<template>
  <article class="goal-card" :class="{ open: expanded, overridden: isOverride }">
    <header class="goal-card-head">
      <button
        class="goal-grip"
        type="button"
        :aria-label="`Reorder ${goal.skill}: drag, or use the up and down arrow keys`"
        title="Drag to reorder"
        @pointerdown.prevent="$emit('drag-start', $event)"
        @keydown.up.prevent="$emit('move', -1)"
        @keydown.down.prevent="$emit('move', 1)"
      >
        <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true"><g fill="currentColor"><circle cx="4" cy="3" r="1.6" /><circle cx="10" cy="3" r="1.6" /><circle cx="4" cy="9" r="1.6" /><circle cx="10" cy="9" r="1.6" /><circle cx="4" cy="15" r="1.6" /><circle cx="10" cy="15" r="1.6" /></g></svg>
      </button>
      <button class="goal-card-toggle" type="button" :aria-expanded="expanded" :aria-controls="`goal-body-${goal.skill}`" @click="$emit('toggle')">
        <span class="goal-card-chevron" :class="{ open: expanded }" aria-hidden="true">▸</span>
        <img :src="skillIconSrc(goal.skill)" :alt="goal.skill" width="28" height="28" />
        <span class="goal-card-title">
          <b>{{ goal.skill }}</b>
          <em>{{ startLevel }} → {{ endLevel }}</em>
          <span v-if="reqState === 'blocked'" class="goal-card-req is-unmet" title="This route uses a method you are missing a requirement for. Open the goal for details.">⚠ Missing requirement</span>
          <span v-else-if="reqState === 'unconfirmed'" class="goal-card-req is-unknown" title="Some requirements for this route are not confirmed yet. Open the goal to confirm them.">? Check requirements</span>
          <span v-if="progress && (progress.done || progress.gained > 0)" class="goal-card-live" :class="{ done: progress.done }">{{ progress.done ? '✓ Complete' : `Now level ${progress.liveLevel} · ${pctText}` }}</span>
        </span>
        <span class="goal-card-stats">
          <span><small>XP left</small>{{ formatNum(plan.remainingXp) }}</span>
          <span class="goal-card-strategy"><small>Strategy</small>{{ strategyText }}<i v-if="isOverride" class="goal-override-tag">Override</i></span>
          <span><small>Time</small>{{ plan.remainingXp === 0 ? 'Done' : formatHours(plan.hours) }}</span>
          <span><small>Net GP</small><b :class="gpClass(plan.netGp)">{{ plan.netGp == null ? 'No GP data' : formatGp(plan.netGp) }}</b></span>
        </span>
      </button>
      <span class="goal-card-actions">
        <button class="btn-text" type="button" :disabled="index === 0" :aria-label="`Move ${goal.skill} up`" title="Train earlier" @click="$emit('move', -1)">↑</button>
        <button class="btn-text" type="button" :disabled="index === count - 1" :aria-label="`Move ${goal.skill} down`" title="Train later" @click="$emit('move', 1)">↓</button>
        <button class="btn btn-ghost planner-remove" type="button" :aria-label="`Remove ${goal.skill}`" @click="$emit('remove')">Remove</button>
      </span>
      <span v-if="progress" class="goal-card-progress" :class="{ done: progress.done }" role="progressbar" :aria-valuenow="Math.round(progress.pct * 100)" aria-valuemin="0" aria-valuemax="100" :aria-label="`${goal.skill} progress`"><i :style="{ width: progress.pct * 100 + '%' }" /></span>
    </header>

    <div v-if="expanded" :id="`goal-body-${goal.skill}`" class="goal-card-body">
      <div v-if="goal.allowedMethodIds?.length" class="planner-notice">
        This goal only uses {{ goal.allowedMethodIds.length }} chosen method{{ goal.allowedMethodIds.length === 1 ? '' : 's' }} (set in the skill calculator).
        <button class="btn-text" type="button" @click="$emit('patch', { allowedMethodIds: null })">Use all methods</button>
      </div>

      <div class="goal-levels-row">
        <label>
          <span>Start level</span>
          <NumberInput :model-value="startLevel" :min="1" :max="MAX_VIRTUAL_LEVEL" @update:model-value="setStartLevel" />
        </label>
        <span class="goal-levels-arrow" aria-hidden="true">→</span>
        <label>
          <span>Target level</span>
          <NumberInput :model-value="endLevel" :min="2" :max="MAX_VIRTUAL_LEVEL" @update:model-value="setTargetLevel" />
        </label>
        <small class="planner-hint">Change either level and the timeline recalculates.</small>
      </div>

      <div class="goal-method-row">
        <div class="goal-method-picker">
          <span>Training strategy / method</span>
          <MethodPicker :model-value="goal.methodId" :methods="methods" :routes="methodRoutes" @update:model-value="$emit('patch', { methodId: $event })" />
        </div>
        <label v-if="goal.methodId === 'custom'">
          <span>XP/hour</span>
          <NumberInput :model-value="goal.customXpPerHour" :min="1" :max="10000000" @update:model-value="$emit('patch', { customXpPerHour: $event })" />
        </label>
        <button v-if="isOverride" class="btn btn-ghost goal-reset" type="button" @click="$emit('patch', { methodId: GLOBAL_STRATEGY })">Reset to global</button>
      </div>
      <p v-if="method" class="planner-hint">
        {{ method.description }} · {{ method.intensity }} intensity ·
        <GpTip :method="method">{{ method.gpPerHour == null ? 'no GP data' : `${formatGp(method.gpPerHour)}/h` }}</GpTip>
      </p>

      <section v-if="routeMethods.length" class="goal-reqs" aria-label="Requirements for this route">
        <h4 class="goal-section-title">Requirements for this route</h4>
        <p v-if="chosenBlocked" class="planner-warning">
          ⚠ {{ chosenBlocked.method.name }} may not be accessible: {{ unmetNames(chosenBlocked) }} {{ chosenBlocked.unmet.length === 1 ? 'is' : 'are' }} marked as missing.
          <button class="btn-text" type="button" @click="$emit('patch', { methodId: GLOBAL_STRATEGY })">Use the global strategy instead</button>
        </p>
        <p v-else-if="blockedInRoute.length" class="planner-warning">
          <template v-if="respect">⚠ Part of this route uses {{ blockedInRoute.map((a) => a.method.name).join(', ') }}, which you are missing something for. No other method covers that stretch of levels.</template>
          <template v-else>⚠ This route uses {{ blockedInRoute.map((a) => a.method.name).join(', ') }}, which you are missing something for, because "Skip methods I can't use yet" is off.</template>
        </p>
        <p v-else-if="routeState === 'unconfirmed'" class="planner-hint">Confirm what you already have. Anything you are not sure about is treated as available, so nothing is hidden from you.</p>
        <div v-for="a in routeMethods" :key="a.method.id" class="goal-req-method" :class="`is-${a.state}`">
          <div class="goal-req-head">
            <b>{{ a.method.name }}</b>
            <span class="goal-req-state">{{ STATE_TEXT[a.state] }}</span>
          </div>
          <RequirementList :items="a.items" />
        </div>
        <p class="planner-hint goal-reqs-save">
          <template v-if="loggedIn">Your answers are saved to your account and used in every plan. <RouterLink :to="{ name: 'account', hash: '#quests' }">Open your quest tracker</RouterLink></template>
          <template v-else>Your answers are saved in this browser. <RouterLink :to="{ name: 'login', query: { next: '/account' } }">Log in</RouterLink> to keep them on your account and use them on every device.</template>
        </p>
      </section>

      <div class="planner-goal-summary">
        <div>
          <span>XP remaining</span><b>{{ formatNum(plan.remainingXp) }}</b>
          <small v-if="plan.questXp">{{ formatNum(plan.questXp) }} covered by quests</small>
        </div>
        <div><span>Est. time</span><b>{{ formatHours(plan.hours) }}</b><small>{{ daysText }}</small></div>
        <div>
          <span>Net GP</span><b :class="gpClass(plan.netGp)">{{ plan.netGp == null ? 'No GP data' : formatGp(plan.netGp) }}</b>
          <small v-if="plan.gpPartial" class="gp-incomplete">Incomplete: some steps are unpriced</small>
        </div>
        <div>
          <span>GP per hour</span><b :class="gpClass(gpPerHour)">{{ gpPerHour == null ? '-' : formatGp(gpPerHour) }}</b>
          <small>average, net of supplies</small>
        </div>
      </div>

      <PlannerQuests
        :model-value="goal.quests"
        :skill="goal.skill"
        :current-xp="planned.currentXp"
        :target-xp="goal.targetXp"
        :method-id="resolvedId"
        :gp-value="gpValue"
        @update:model-value="$emit('patch', { quests: $event })"
      />

      <h4 class="goal-section-title">Level-by-level route</h4>
      <PlannerRoute :segments="plan.segments" />
      <p v-if="plan.warning" class="planner-warning">⚠ {{ plan.warning }}</p>

      <PlannerMaterials :plan="plan" />

      <PlannerCompare :goal="resolved" :plans="compare" :plan="plan" :selected-id="resolvedId" @pick="(id) => $emit('pick', id)" />

      <p class="planner-hint goal-estimate-note">
        GP figures are approximate, net per hour of training after supplies and loot. The catalog stores one net rate per method, so supplies cost and output value
        are not shown separately, and prices are catalog estimates without a live timestamp.
      </p>
    </div>
  </article>
</template>

<script setup>
import { computed, inject } from 'vue'
import NumberInput from '@/components/NumberInput.vue'
import PlannerRoute from '@/components/planner/PlannerRoute.vue'
import PlannerQuests from '@/components/planner/PlannerQuests.vue'
import PlannerCompare from '@/components/planner/PlannerCompare.vue'
import PlannerMaterials from '@/components/planner/PlannerMaterials.vue'
import MethodPicker from '@/components/planner/MethodPicker.vue'
import GpTip from '@/components/planner/GpTip.vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import RequirementList from '@/components/planner/RequirementList.vue'
import { methodAvailability } from '@/utils/requirements'
import { plannerRequirementContext } from '@/composables/plannerRequirementContext'
import { useRequirements } from '@/composables/useRequirements'
import { useAuth } from '@/composables/useAuth'
import { getMethod } from '@/data/trainingMethods'
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
  relevantMethods,
  profitableMethods,
  formatNum,
  formatHours,
  formatGp,
} from '@/utils/planner'
import { STRATEGY_LABELS } from '@/utils/plannerTools'

const props = defineProps({
  goal: { type: Object, required: true },
  plan: { type: Object, required: true },
  compare: { type: Object, required: true },
  globalStrategy: { type: String, required: true },
  gpValue: { type: Number, required: true },
  hoursPerDay: { type: Number, required: true },
  expanded: { type: Boolean, default: false },
  index: { type: Number, required: true },
  count: { type: Number, required: true },
  // The goal as it stands today (start moved up to tracked XP). The plain `goal` keeps the original start for progress.
  liveGoal: { type: Object, default: null },
  progress: { type: Object, default: null },
})
const emit = defineEmits(['toggle', 'remove', 'move', 'patch', 'pick', 'drag-start'])

const pctText = computed(() => {
  const p = (props.progress?.pct || 0) * 100
  return `${p > 0 && p < 10 ? p.toFixed(1) : Math.floor(p)}%`
})
// Requirements of every method the route uses, plus the one picked by hand.
const reqCtx = inject(plannerRequirementContext, null)
const { respect } = useRequirements()
const { loggedIn } = useAuth()
const STATE_TEXT = { blocked: 'Requirement missing', unconfirmed: 'Needs confirming', planned: 'Your plan covers it', available: 'Requirements met' }
const routeMethods = computed(() => {
  const seen = new Map()
  for (const seg of props.plan.segments || []) {
    const m = seg.method
    if (m?.id && m.requirements && !seen.has(m.id)) seen.set(m.id, methodAvailability(m, reqCtx?.value || {}))
  }
  if (method.value?.requirements && !seen.has(method.value.id)) seen.set(method.value.id, methodAvailability(method.value, reqCtx?.value || {}))
  return [...seen.values()].filter((a) => a.items.length)
})
const routeState = computed(() => {
  const states = routeMethods.value.map((a) => a.state)
  return states.includes('blocked') ? 'blocked' : states.includes('unconfirmed') ? 'unconfirmed' : 'available'
})
const reqState = computed(() => (props.progress?.done ? 'available' : routeState.value))
const chosenBlocked = computed(() => {
  const a = method.value ? routeMethods.value.find((x) => x.method.id === method.value.id) : null
  return a && a.state === 'blocked' ? a : null
})
const blockedInRoute = computed(() => routeMethods.value.filter((a) => a.state === 'blocked' && a.method.id !== method.value?.id))
const unmetNames = (a) => a.unmet.map((i) => i.req.label).join(', ')
const isOverride = computed(() => props.goal.methodId !== GLOBAL_STRATEGY)
const resolvedId = computed(() => (props.goal.methodId === GLOBAL_STRATEGY ? props.globalStrategy : props.goal.methodId))
const planned = computed(() => props.liveGoal || props.goal)
const resolved = computed(() => ({ ...planned.value, methodId: resolvedId.value, gpValuePerHour: props.gpValue }))
const method = computed(() => (isAuto(resolvedId.value) || resolvedId.value === 'custom' ? null : getMethod(resolvedId.value)))
const startLevel = computed(() => levelAtXp(props.goal.currentXp, true))
const endLevel = computed(() => levelAtXp(props.goal.targetXp, true))
// Edit the start or target level in place. Blank while typing is ignored; the target never drops below the start.
function setStartLevel(level) {
  if (!level) return
  emit('patch', { currentXp: xpAtLevel(Math.min(level, MAX_VIRTUAL_LEVEL)) })
}
function setTargetLevel(level) {
  if (!level) return
  emit('patch', { targetXp: Math.min(xpAtLevel(Math.min(level, MAX_VIRTUAL_LEVEL)), MAX_XP) })
}
const plannedLevel = computed(() => levelAtXp(planned.value.currentXp, true))
const methods = computed(() => {
  const list = relevantMethods(props.goal.skill, plannedLevel.value, endLevel.value)
  const picked = getMethod(props.goal.methodId)
  return picked && !list.some((x) => x.id === picked.id) ? [...list, picked] : list
})
const methodRoutes = computed(() => [
  { value: GLOBAL_STRATEGY, label: `Follow global strategy`, sub: STRATEGY_LABELS[props.globalStrategy] },
  { value: AUTO_FAST, label: 'Fastest route' },
  { value: AUTO_CHEAP, label: 'Cheapest route' },
  { value: AUTO_BALANCED, label: 'Balanced route' },
  ...(profitable.value.length ? [{ value: AUTO_PROFIT, label: 'Best gp per hour route' }] : []),
])
const profitable = computed(() => profitableMethods(props.goal.skill, plannedLevel.value, endLevel.value))
const strategyText = computed(() => {
  const id = resolvedId.value
  const label = isAuto(id) ? STRATEGY_LABELS[id] : id === 'custom' ? 'Custom rate' : method.value?.name || 'Method'
  return isOverride.value ? label : `${label} (global)`
})
const gpPerHour = computed(() => (props.plan.netGp != null && props.plan.hours > 0 ? props.plan.netGp / props.plan.hours : null))
const daysText = computed(() => {
  const h = props.plan.hours
  if (h == null || !(props.hoursPerDay > 0)) return ''
  const d = Math.ceil(h / props.hoursPerDay)
  return `${d.toLocaleString('en-US')} day${d === 1 ? '' : 's'} at ${props.hoursPerDay} h/day`
})
const gpClass = (gp) => (gp == null ? '' : gp >= 0 ? 'planner-gain' : 'planner-cost')

function methodLabel(meth, list) {
  const fastest = list.reduce((a, b) => (b.xpPerHour > a.xpPerHour ? b : a), list[0])
  const profit = list.filter((x) => x.gpPerHour != null && x.gpPerHour > 0)
  const top = profit.length ? profit.reduce((a, b) => (b.gpPerHour > a.gpPerHour ? b : a)) : null
  const priced = list.filter((x) => x.gpPerHour != null)
  const cheapest = priced.length ? priced.reduce((a, b) => (b.gpPerHour / b.xpPerHour > a.gpPerHour / a.xpPerHour ? b : a)) : null
  const tags = [
    meth.id === fastest.id ? 'fastest here' : '',
    top && meth.id === top.id ? 'MOST PROFITABLE' : meth.gpPerHour > 0 ? 'Profitable' : '',
    cheapest && meth.id === cheapest.id && !(meth.gpPerHour > 0) ? 'cheapest here' : '',
  ].filter(Boolean)
  const gp = meth.gpPerHour == null ? 'no gp data' : `${formatGp(meth.gpPerHour)}/h`
  return `${meth.name} · lvl ${meth.minLevel}+ · ~${formatNum(meth.xpPerHour)} xp/h · ${gp}${tags.length ? ` · ${tags.join(', ')}` : ''}`
}
</script>
