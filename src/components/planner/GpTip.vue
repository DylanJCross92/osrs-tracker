<template>
  <span v-if="method" class="gp-tip" tabindex="0" :aria-label="`${text} ${rateText}`">
    <slot />
    <span class="gp-tip-bubble" role="tooltip">
      <b>{{ method.name }}</b>
      <span>{{ text }}</span>
      <small>{{ rateText }}</small>
      <template v-if="live">
        <small class="gp-tip-live">Live Grand Exchange prices, after the 2% tax:</small>
        <small v-for="l in live.lines" :key="l.kind + l.name" class="gp-tip-line">
          {{ l.kind === 'out' ? 'Sell' : 'Buy' }} {{ formatNum(l.qty) }} {{ l.name }} at {{ gpText(l.each) }} = <span :class="l.total >= 0 ? 'planner-gain' : 'planner-cost'">{{ signedGp(l.total) }}</span>
        </small>
      </template>
      <small v-else-if="hasRecipe" class="gp-tip-live">Saved estimate (live prices are not loaded).</small>
    </span>
  </span>
  <span v-else><slot /></span>
</template>

<script setup>
import { computed } from 'vue'
import { gpExplain } from '@/data/gpNotes'
import { formatGp, formatHours, formatNum } from '@/utils/planner'
import { ECONOMY } from '@/data/methodEconomy'
import { economyFor } from '@/utils/methodPricing'
import { gpText, signedGp } from '@/utils/geFormat'

const props = defineProps({
  method: { type: Object, default: null },
  hours: { type: Number, default: null },
})

const text = computed(() => gpExplain(props.method))
// The recipe behind a live figure: what is bought and sold an hour at the current prices.
const hasRecipe = computed(() => !!props.method && !!ECONOMY[props.method.id])
const live = computed(() => (props.method && hasRecipe.value ? economyFor(props.method.id, props.method.xpPerHour) : null))
const rateText = computed(() => {
  const m = props.method
  if (!m || m.gpPerHour == null) return ''
  const rate = `Net rate: ${formatGp(m.gpPerHour)} per hour`
  return props.hours != null ? `${rate} × ${formatHours(props.hours)} = ${formatGp(Math.round(m.gpPerHour * props.hours))}` : rate
})
</script>
