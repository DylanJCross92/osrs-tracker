<template>
  <div class="planner-compare">
    <div class="planner-compare-head">
      <b>Fastest vs cheapest</b>
      <span>Is saving gp worth the extra time? Compare the routes.</span>
    </div>
    <table class="planner-table">
      <thead>
        <tr><th>Route</th><th>Time</th><th>Net GP</th><th>vs fastest</th><th /></tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id" :class="{ current: row.id === goal.methodId }">
          <td>{{ row.label }}<small v-if="row.id === goal.methodId"> (current)</small></td>
          <td>{{ formatHours(row.plan.hours) }}</td>
          <td :class="gpClass(row.plan.netGp)">{{ row.plan.netGp == null ? 'No GP data' : formatGp(row.plan.netGp) }}</td>
          <td class="planner-table-note">{{ row.note }}</td>
          <td><button v-if="row.id !== goal.methodId" class="btn btn-ghost" type="button" @click="$emit('pick', row.id)">Use this</button></td>
        </tr>
      </tbody>
    </table>
    <details class="planner-all-methods" @toggle="open = $event.target.open; if (open) track('planner_compare_opened', { skill: goal.skill })">
      <summary>Compare other methods for {{ goal.skill }}</summary>
      <table v-if="open && methodRows.length" class="planner-table">
        <thead>
          <tr><th>Method</th><th>Time</th><th>Net GP</th><th>vs fastest</th><th /></tr>
        </thead>
        <tbody>
          <tr v-for="row in methodRows" :key="row.method.id" :class="{ current: row.method.id === goal.methodId }">
            <td>{{ row.method.name }}<small> lvl {{ row.method.minLevel }}+ · {{ row.method.intensity }}</small></td>
            <td>{{ formatHours(row.plan.hours) }}</td>
            <td :class="gpClass(row.plan.netGp)"><GpTip :method="row.method" :hours="row.plan.hours">{{ row.plan.netGp == null ? 'No GP data' : formatGp(row.plan.netGp) }}</GpTip></td>
            <td class="planner-table-note">{{ row.trade ? tradeoffText(row.trade) : '' }}</td>
            <td><button v-if="row.method.id !== goal.methodId" class="btn btn-ghost" type="button" @click="$emit('pick', row.method.id)">Use this</button></td>
          </tr>
        </tbody>
      </table>
      <p v-else-if="open" class="planner-hint">The fastest route already covers every method available in this range.</p>
    </details>
  </div>
</template>

<script setup>
import { track } from '@/utils/analytics'
import { computed, ref } from 'vue'
import GpTip from '@/components/planner/GpTip.vue'
import { AUTO_FAST, AUTO_CHEAP, compareMethods, tradeoff, tradeoffText, formatHours, formatGp } from '@/utils/planner'

const props = defineProps({
  goal: { type: Object, required: true },
  fast: { type: Object, required: true },
  cheap: { type: Object, required: true },
  plan: { type: Object, required: true },
})
defineEmits(['pick'])

const open = ref(false)
const gpClass = (gp) => (gp == null ? '' : gp >= 0 ? 'planner-gain' : 'planner-cost')

const rows = computed(() => {
  const list = [
    { id: AUTO_FAST, label: 'Fastest route', plan: props.fast, note: 'Baseline' },
    { id: AUTO_CHEAP, label: 'Cheapest route', plan: props.cheap, note: tradeoffText(tradeoff(props.fast, props.cheap)) },
  ]
  // A hand-picked method or custom rate gets its own row so it can be weighed against both.
  if (props.goal.methodId !== AUTO_FAST && props.goal.methodId !== AUTO_CHEAP) {
    list.push({ id: props.goal.methodId, label: props.plan.method ? props.plan.method.name : 'Custom rate', plan: props.plan, note: tradeoffText(tradeoff(props.fast, props.plan)) })
  }
  return list
})

// Only list methods whose result actually differs from the fastest route.
const methodRows = computed(() =>
  open.value
    ? compareMethods(props.goal).filter(
        (row) => Math.abs(row.plan.hours - props.fast.hours) > 0.01 || Math.abs((row.plan.netGp ?? 0) - (props.fast.netGp ?? 0)) > 1,
      )
    : [],
)
</script>
