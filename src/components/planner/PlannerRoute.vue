<template>
  <ol v-if="segments.length" class="planner-route">
    <li v-for="(seg, k) in segments" :key="k" :class="['planner-step', `planner-step-${seg.kind}`, { 'planner-step-gap': !seg.method }]">
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
      <span class="planner-step-gp" :class="gpClass(seg.netGp)"><GpTip :method="seg.method && seg.method.gpPerHour !== undefined && seg.method.id ? seg.method : null" :hours="seg.hours">{{ seg.netGp == null ? 'Unpriced' : formatGp(seg.netGp) }}</GpTip></span>
      <span class="planner-step-hours">{{ seg.hours == null ? '-' : formatHours(seg.hours) }}</span>
    </li>
  </ol>
</template>

<script setup>
import GpTip from '@/components/planner/GpTip.vue'
import { formatNum, formatHours, formatGp } from '@/utils/planner'

defineProps({ segments: { type: Array, required: true } })

const gpClass = (gp) => (gp == null ? '' : gp >= 0 ? 'planner-gain' : 'planner-cost')
</script>
