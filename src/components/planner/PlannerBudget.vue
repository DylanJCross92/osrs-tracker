<template>
  <div class="planner-budget">
    <div class="planner-compare-head">
      <b>GP budget</b>
      <span>Optional. The fastest combination of routes that stays within the most gp you are willing to spend.</span>
    </div>
    <label class="budget-input">
      <span>Maximum GP to spend</span>
      <NumberInput :model-value="budget" :min="0" :max="100000000000" @update:model-value="$emit('update:budget', $event || null)" />
    </label>

    <template v-if="budget && result">
      <p v-if="!result.feasible" class="planner-error">
        No route combination fits a {{ formatNum(budget) }} gp budget. The cheapest plan still costs {{ formatGp(result.netGp) }}, which is
        {{ formatNum(result.shortBy) }} gp over.
      </p>
      <p v-else class="budget-ok">
        Fastest plan within budget: <b>{{ formatHours(result.hours) }}</b> for <b :class="result.netGp >= 0 ? 'planner-gain' : 'planner-cost'">{{ formatGp(result.netGp) }}</b>
        <small>(net-budget estimate, not a guaranteed cash-flow plan)</small>
      </p>
      <p v-if="result.unpriced" class="gp-incomplete">Some routes include unpriced steps, so their gp is treated as zero here.</p>

      <div class="planner-table-scroll">
        <table class="planner-table">
          <thead><tr><th>Skill</th><th>Route</th><th class="num">Hours</th><th class="num">Net GP</th></tr></thead>
          <tbody>
            <tr v-for="p in result.picks" :key="p.skill">
              <td>{{ p.skill }}</td>
              <td>{{ p.option.label }}</td>
              <td class="num">{{ formatHours(p.option.hours) }}</td>
              <td class="num" :class="p.option.gp >= 0 ? 'planner-gain' : 'planner-cost'">{{ p.option.unpriced && !p.option.gp ? 'Unpriced' : formatGp(p.option.gp) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="result.feasible && startNeeded > budget" class="planner-warning">
        ⚠ In the current goal order this plan needs about {{ formatNum(startNeeded) }} gp up front, more than your budget, because profit from later skills cannot fund earlier ones.
      </p>
      <div class="budget-actions">
        <button class="btn btn-primary" type="button" :disabled="!result.picks.length" @click="$emit('apply', result.picks)">Apply these routes to my goals</button>
        <small>Sets a route on each goal, you can still change any of them.</small>
      </div>
    </template>
    <p v-else class="planner-hint">Leave empty to ignore budgets. Positive net gp is profit, negative is spending.</p>
  </div>
</template>

<script setup>
import NumberInput from '@/components/NumberInput.vue'
import { formatNum, formatHours, formatGp } from '@/utils/planner'

defineProps({
  budget: { type: Number, default: null },
  result: { type: Object, default: null },
  startNeeded: { type: Number, default: 0 },
})
defineEmits(['update:budget', 'apply'])
</script>
