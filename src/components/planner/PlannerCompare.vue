<template>
  <div class="planner-compare">
    <div class="planner-compare-head">
      <b>Compare routes</b>
      <span>Pick a route to use it for this skill. Differences are against your selected route.</span>
    </div>
    <div class="planner-table-scroll">
      <table class="planner-table">
        <thead>
          <tr><th>Strategy</th><th class="num">Hours</th><th class="num">Net GP</th><th>vs. selected</th><th /></tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id" :class="{ current: row.id === selectedId }">
            <td>{{ row.label }}</td>
            <td class="num">{{ formatHours(row.plan.hours) }}</td>
            <td class="num" :class="gpClass(row.plan.netGp)">{{ row.plan.netGp == null ? 'No GP data' : formatGp(row.plan.netGp) }}</td>
            <td class="planner-table-note">
              <template v-if="row.id === selectedId">Selected</template>
              <template v-else-if="row.diff">
                <span>{{ row.diff.time }}</span>
                <span :class="row.diff.gpGood === true ? 'planner-gain' : row.diff.gpGood === false ? 'planner-cost' : ''">{{ row.diff.gp }}</span>
                <small v-if="row.diff.perHour">{{ row.diff.perHour }}</small>
              </template>
              <template v-else>Not enough data to compare</template>
            </td>
            <td><button v-if="row.id !== selectedId" class="btn btn-ghost" type="button" @click="$emit('pick', row.id)">Use this</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <details class="planner-all-methods" @toggle="onToggle">
      <summary>Compare Other Methods for {{ goal.skill }}</summary>
      <div v-if="open && methodRows.length" class="planner-table-scroll">
        <table class="planner-table">
          <thead>
            <tr><th>Method</th><th class="num">Hours</th><th class="num">Net GP</th><th>vs. selected</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="row in methodRows" :key="row.method.id" :class="{ current: row.method.id === selectedId }">
              <td>{{ row.method.name }}<small> lvl {{ row.method.minLevel }}+ · {{ row.method.intensity }}</small> <span v-if="profitTag(row.method)" class="planner-profit-tag">{{ profitTag(row.method) }}</span></td>
              <td class="num">{{ formatHours(row.plan.hours) }}</td>
              <td class="num" :class="gpClass(row.plan.netGp)"><GpTip :method="row.method" :hours="row.plan.hours">{{ row.plan.netGp == null ? 'No GP data' : formatGp(row.plan.netGp) }}</GpTip></td>
              <td class="planner-table-note">
                <template v-if="row.method.id === selectedId">Selected</template>
                <template v-else-if="row.diff"><span>{{ row.diff.time }}</span> <span :class="row.diff.gpGood === true ? 'planner-gain' : row.diff.gpGood === false ? 'planner-cost' : ''">{{ row.diff.gp }}</span></template>
              </td>
              <td><button v-if="row.method.id !== selectedId" class="btn btn-ghost" type="button" @click="$emit('pick', row.method.id)">Use this</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else-if="open" class="planner-hint">No other methods apply between these levels.</p>
    </details>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { track } from '@/utils/analytics'
import GpTip from '@/components/planner/GpTip.vue'
import { AUTO_FAST, AUTO_CHEAP, AUTO_BALANCED, AUTO_PROFIT, compareMethods, profitableMethods, levelAtXp, formatHours, formatGp } from '@/utils/planner'

const props = defineProps({
  goal: { type: Object, required: true },
  plans: { type: Object, required: true },
  plan: { type: Object, required: true },
  selectedId: { type: String, required: true },
})
defineEmits(['pick'])

const open = ref(false)
function onToggle(e) {
  open.value = e.target.open
  if (open.value) track('planner_compare_opened', { skill: props.goal.skill })
}
const gpClass = (gp) => (gp == null ? '' : gp >= 0 ? 'planner-gain' : 'planner-cost')

// Time and gp difference against the selected route, in plain words.
function diffOf(plan) {
  const base = props.plan
  if (base.hours == null || plan.hours == null) return null
  const extraHours = plan.hours - base.hours
  const time = Math.abs(extraHours) < 0.05 ? 'Same time' : extraHours < 0 ? `${formatHours(-extraHours)} saved` : `${formatHours(extraHours)} more`
  if (base.netGp == null || plan.netGp == null) return { time, gp: 'GP not comparable', gpGood: null, perHour: '' }
  const gpDelta = plan.netGp - base.netGp
  const amount = formatGp(Math.abs(gpDelta)).replace(/^[+-]/, '')
  const same = Math.abs(gpDelta) < 1000
  const gp = same ? 'Same GP' : gpDelta > 0 ? `${amount} earned or saved` : `${amount} more spent`
  const perHour = extraHours > 0.05 && gpDelta > 1000 ? `${formatGp(gpDelta / extraHours).replace(/^\+/, '')} per extra hour` : ''
  return { time, gp, gpGood: same ? null : gpDelta > 0, perHour }
}

const profitable = computed(() => profitableMethods(props.goal.skill, levelAtXp(props.goal.currentXp, true), levelAtXp(props.goal.targetXp, true)))
const profitTag = (meth) => (profitable.value[0]?.id === meth.id ? 'Most profitable' : meth.gpPerHour > 0 ? 'Profitable' : '')

const rows = computed(() => {
  const list = [
    { id: AUTO_FAST, label: 'Fastest', plan: props.plans.fast },
    { id: AUTO_CHEAP, label: 'Cheapest', plan: props.plans.cheap },
    { id: AUTO_BALANCED, label: 'Balanced', plan: props.plans.balanced },
  ]
  if (profitable.value.length) list.push({ id: AUTO_PROFIT, label: 'Most profitable', plan: props.plans.profit })
  // A hand-picked method or custom rate gets its own row so it can be weighed against the strategies.
  if (!list.some((r) => r.id === props.selectedId)) list.push({ id: props.selectedId, label: props.plan.method ? props.plan.method.name : 'Custom rate', plan: props.plan })
  return list.map((r) => ({ ...r, diff: diffOf(r.plan) }))
})

const methodRows = computed(() => (open.value ? compareMethods({ ...props.goal, methodId: props.selectedId }).map((r) => ({ ...r, diff: diffOf(r.plan) })) : []))
</script>
