<template>
  <article class="goal-card" :class="{ open: expanded, overridden: isOverride }">
    <header class="goal-card-head">
      <button class="goal-card-toggle" type="button" :aria-expanded="expanded" :aria-controls="`goal-body-${goal.skill}`" @click="$emit('toggle')">
        <span class="goal-card-chevron" :class="{ open: expanded }" aria-hidden="true">▸</span>
        <img :src="skillIconSrc(goal.skill)" :alt="goal.skill" width="28" height="28" />
        <span class="goal-card-title">
          <b>{{ goal.skill }}</b>
          <em>{{ startLevel }} → {{ endLevel }}</em>
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
    </header>

    <div v-if="expanded" :id="`goal-body-${goal.skill}`" class="goal-card-body">
      <div v-if="staleXp != null" class="planner-notice">
        Newer player stats are available: {{ formatNum(staleXp) }} XP now, this goal starts from {{ formatNum(goal.currentXp) }} XP.
        <button class="btn-text" type="button" @click="$emit('refresh')">Refresh this goal</button>
      </div>

      <div class="goal-method-row">
        <label>
          <span>Training strategy / method</span>
          <select :value="goal.methodId" @change="$emit('patch', { methodId: $event.target.value })">
            <option :value="GLOBAL_STRATEGY">Follow global strategy ({{ STRATEGY_LABELS[globalStrategy] }})</option>
            <optgroup label="Best route">
              <option :value="AUTO_FAST">Fastest route</option>
              <option :value="AUTO_CHEAP">Cheapest route</option>
              <option :value="AUTO_BALANCED">Balanced route</option>
              <option v-if="profitable.length" :value="AUTO_PROFIT">Most profitable route</option>
            </optgroup>
            <optgroup label="Specific method">
              <option v-for="meth in methods" :key="meth.id" :value="meth.id">{{ methodLabel(meth, methods) }}</option>
              <option value="custom">Custom XP/hour</option>
            </optgroup>
          </select>
        </label>
        <label v-if="goal.methodId === 'custom'">
          <span>XP/hour</span>
          <NumberInput :model-value="goal.customXpPerHour" :min="1" :max="10000000" @update:model-value="$emit('patch', { customXpPerHour: $event })" />
        </label>
        <button v-if="isOverride" class="btn btn-ghost goal-reset" type="button" @click="$emit('patch', { methodId: GLOBAL_STRATEGY })">Reset to global</button>
      </div>
      <p v-if="method" class="planner-hint">
        {{ method.description }} · {{ method.intensity }} intensity ·
        <GpTip :method="method">{{ method.gpPerHour == null ? 'no GP data' : `${formatGp(method.gpPerHour)}/h` }}</GpTip>
        <template v-if="method.requirements"> · Needs: {{ method.requirements }}</template>
      </p>

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
        :current-xp="goal.currentXp"
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
import { computed } from 'vue'
import NumberInput from '@/components/NumberInput.vue'
import PlannerRoute from '@/components/planner/PlannerRoute.vue'
import PlannerQuests from '@/components/planner/PlannerQuests.vue'
import PlannerCompare from '@/components/planner/PlannerCompare.vue'
import PlannerMaterials from '@/components/planner/PlannerMaterials.vue'
import GpTip from '@/components/planner/GpTip.vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import { getMethod } from '@/data/trainingMethods'
import {
  AUTO_FAST,
  AUTO_CHEAP,
  AUTO_BALANCED,
  AUTO_PROFIT,
  GLOBAL_STRATEGY,
  isAuto,
  levelAtXp,
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
  staleXp: { type: Number, default: null },
})
defineEmits(['toggle', 'remove', 'move', 'patch', 'pick', 'refresh'])

const isOverride = computed(() => props.goal.methodId !== GLOBAL_STRATEGY)
const resolvedId = computed(() => (props.goal.methodId === GLOBAL_STRATEGY ? props.globalStrategy : props.goal.methodId))
const resolved = computed(() => ({ ...props.goal, methodId: resolvedId.value, gpValuePerHour: props.gpValue }))
const method = computed(() => (isAuto(resolvedId.value) || resolvedId.value === 'custom' ? null : getMethod(resolvedId.value)))
const startLevel = computed(() => levelAtXp(props.goal.currentXp, true))
const endLevel = computed(() => levelAtXp(props.goal.targetXp, true))
const methods = computed(() => {
  const list = relevantMethods(props.goal.skill, startLevel.value, endLevel.value)
  const picked = getMethod(props.goal.methodId)
  return picked && !list.some((x) => x.id === picked.id) ? [...list, picked] : list
})
const profitable = computed(() => profitableMethods(props.goal.skill, startLevel.value, endLevel.value))
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
