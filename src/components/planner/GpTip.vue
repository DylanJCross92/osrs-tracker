<template>
  <span v-if="method" ref="root" class="gp-tip" :class="{ 'is-open': open, 'is-below': below }" tabindex="0" :aria-label="`${method.name}. ${text} ${rateText}`" :aria-expanded="open" @click.stop="toggle" @mouseenter="place" @focus="place" @keydown.esc="close">
    <slot />
    <span class="gp-tip-bubble gpt" role="tooltip">
      <span class="gpt-head">
        <span class="gpt-title">{{ method.name }}</span>
        <span v-if="method.gpPerHour != null" class="gpt-rate" :class="method.gpPerHour >= 0 ? 'is-gain' : 'is-cost'">{{ formatGp(method.gpPerHour) }}<small>/h</small></span>
      </span>
      <span class="gpt-why">{{ text }}</span>

      <span v-if="live" class="gpt-sec">
        <span class="gpt-sec-title">Each hour, at live prices</span>
        <span v-for="l in live.lines" :key="l.kind + l.name" class="gpt-row">
          <span class="gpt-kind" :class="`is-${l.kind}`">{{ KIND_LABEL[l.kind] }}</span>
          <span class="gpt-item">
            <span class="gpt-name">{{ l.name }}</span>
            <small v-if="l.kind !== 'fee'">{{ formatNum(l.qty) }} × {{ gpText(l.each) }} gp</small>
            <small v-if="l.detail">{{ l.detail }}</small>
          </span>
          <span class="gpt-amt" :class="l.total >= 0 ? 'planner-gain' : 'planner-cost'">{{ signedGp(l.total) }}</span>
        </span>
        <span v-if="live.lines.length > 1" class="gpt-net"><span>Net each hour</span><b :class="live.gpPerHour >= 0 ? 'planner-gain' : 'planner-cost'">{{ formatGp(live.gpPerHour) }}</b></span>
      </span>
      <span v-if="live && live.note" class="gpt-note">{{ live.note }}</span>

      <span v-if="hours != null && method.gpPerHour != null" class="gpt-stretch">
        <span>This stretch: <b>{{ formatHours(hours) }}</b> at {{ formatGp(method.gpPerHour) }}/h</span>
        <b :class="method.gpPerHour >= 0 ? 'planner-gain' : 'planner-cost'">{{ formatGp(Math.round(method.gpPerHour * hours)) }}</b>
      </span>

      <small v-if="live" class="gpt-foot">Grand Exchange prices ({{ priceBasis === 'instant' ? 'instant buy and sell' : 'middle price' }}), after the 2% tax.</small>
      <small v-else-if="hasRecipe" class="gpt-foot">A saved estimate. Live prices are not loaded.</small>
    </span>
  </span>
  <span v-else><slot /></span>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { gpExplain } from '@/data/gpNotes'
import { formatGp, formatHours, formatNum } from '@/utils/planner'
import { ECONOMY } from '@/data/methodEconomy'
import { economyFor } from '@/utils/methodPricing'
import { gpText, signedGp } from '@/utils/geFormat'
import { priceBasis } from '@/utils/priceBook'

const props = defineProps({
  method: { type: Object, default: null },
  hours: { type: Number, default: null },
})

// Hovering shows the breakdown. Clicking the amount keeps it open (so it can be read, and its text selected) until you click anywhere outside it
// or press Escape. The click does not reach the row behind, which would otherwise open the method list.
const root = ref(null)
const open = ref(false)
const close = () => {
  open.value = false
}
// The bubble opens above the amount; when the amount is near the top of the screen there is not room (the page header covers the rest), so it
// opens below instead.
const below = ref(false)
function place() {
  const el = root.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const needed = 190 + (live.value?.lines.length || 0) * 46 + 70
  below.value = r.top < needed && window.innerHeight - r.bottom > r.top
}
function toggle() {
  place()
  open.value = !open.value
}
const onOutside = (e) => {
  if (root.value && !root.value.contains(e.target)) close()
}
watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', onOutside, true)
  else document.removeEventListener('pointerdown', onOutside, true)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside, true))

const KIND_LABEL = { out: 'Sell', in: 'Buy', fee: 'Fee' }
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
