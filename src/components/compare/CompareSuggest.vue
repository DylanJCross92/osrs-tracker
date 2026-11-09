<template>
  <div class="cmp-suggest" role="listbox" :aria-label="heading" @mousedown.prevent>
    <span class="cmp-suggest-head">{{ heading }}</span>
    <button v-for="(o, i) in options" :key="o.username" type="button" class="cmp-suggest-item" :class="{ active: i === active }" role="option" :aria-selected="i === active" @click="$emit('pick', o)" @mouseenter="$emit('hover', i)">
      <span class="cmp-suggest-avatar" aria-hidden="true"><img v-if="o.icon" :src="o.icon" alt="" width="20" height="20" /></span>
      <span class="cmp-suggest-name">{{ o.displayName }}</span>
      <span class="cmp-suggest-meta">
        <small v-if="o.overallLevel != null">Overall {{ o.overallLevel.toLocaleString('en-US') }}</small>
        <small v-if="o.weekGain > 0" class="cmp-gain">+{{ formatXp(o.weekGain) }} this week</small>
      </span>
    </button>
  </div>
</template>

<script setup>
import { formatXp } from '@/utils/osrsSkills'

defineProps({
  options: { type: Array, required: true },
  heading: { type: String, default: '' },
  active: { type: Number, default: -1 },
})
defineEmits(['pick', 'hover'])
</script>
