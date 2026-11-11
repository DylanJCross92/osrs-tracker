<template>
  <ol v-if="segments.length" class="planner-route">
    <li v-for="(seg, k) in segments" :key="k" :class="['planner-step', `planner-step-${seg.kind}`, { 'planner-step-gap': !seg.method }]">
      <span class="planner-step-levels">{{ seg.startLevel }} → {{ seg.endLevel }}</span>
      <span class="planner-step-name">
        {{ seg.method ? seg.method.name : 'No catalog method' }}
        <i v-if="flag(seg)" class="route-req" :class="`is-${flag(seg).state}`" :title="flag(seg).text">{{ flag(seg).state === 'blocked' ? '⚠' : '?' }}</i>
        <em v-if="seg.kind === 'main'">your chosen method</em>
        <em v-else-if="seg.kind === 'prep'">to unlock it</em>
        <em v-else-if="seg.kind === 'post'">after it caps out</em>
      </span>
      <span class="planner-step-meta">
        {{ formatNum(seg.xp) }} xp<template v-if="seg.xpPerHour"> · ~{{ formatNum(seg.xpPerHour) }} xp/h</template>
      </span>
      <span class="planner-step-gp" :class="gpClass(seg.netGp)"><GpTip :method="seg.method && seg.method.gpPerHour !== undefined && seg.method.id ? seg.method : null" :hours="seg.hours">{{ seg.netGp == null ? 'Unpriced' : formatGp(seg.netGp) }}</GpTip></span>
      <span class="planner-step-hours">{{ seg.hours == null ? '-' : formatHours(seg.hours) }}</span>
    </li>
  </ol>
</template>

<script setup>
import { inject } from 'vue'
import GpTip from '@/components/planner/GpTip.vue'
import { methodAvailability, unmetText } from '@/utils/requirements'
import { plannerRequirementContext } from '@/composables/plannerRequirementContext'
import { formatNum, formatHours, formatGp } from '@/utils/planner'

defineProps({ segments: { type: Array, required: true } })

const reqCtx = inject(plannerRequirementContext, null)
// A marker next to a step whose method has a missing or unconfirmed requirement.
function flag(seg) {
  if (!seg.method?.requirements || !reqCtx) return null
  const a = methodAvailability(seg.method, reqCtx.value)
  if (a.state === 'blocked') return { state: 'blocked', text: `Missing requirement: ${unmetText(a)}` }
  if (a.state === 'unconfirmed') return { state: 'unconfirmed', text: 'Some requirements are not confirmed yet' }
  return null
}
const gpClass = (gp) => (gp == null ? '' : gp >= 0 ? 'planner-gain' : 'planner-cost')
</script>
