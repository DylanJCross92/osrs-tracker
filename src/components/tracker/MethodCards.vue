<template>
  <ul class="trk-methods">
    <li v-for="u in shown" :key="u.name">
      <img v-if="icon(u)" :src="icon(u)" alt="" width="28" height="28" loading="lazy" />
      <img v-else :src="skillIconSrc(u.skills[0])" alt="" width="24" height="24" loading="lazy" />
      <span class="trk-methods-main">
        <b>{{ u.name }}<NewTag :id="u.method.id" /></b>
        <small>{{ u.melee ? 'Attack, Strength, Defence' : u.skills.join(', ') }}<template v-if="u.method.xpPerHour"> · {{ formatNum(u.method.xpPerHour) }} xp/h</template></small>
      </span>
    </li>
    <li v-if="more" class="trk-methods-more">and {{ more }} more</li>
  </ul>
</template>

<script setup>
import { computed } from 'vue'
import NewTag from '@/components/NewTag.vue'
import { methodIconSrc } from '@/data/methodIcons'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatNum } from '@/utils/planner'

// The training methods something opens in the planner, each with its icon, skill and xp per hour. unlocks: from utils/trackerUnlocks.js.
const props = defineProps({ unlocks: { type: Array, default: () => [] }, max: { type: Number, default: 6 } })
const shown = computed(() => props.unlocks.slice(0, props.max))
const more = computed(() => Math.max(props.unlocks.length - props.max, 0))
const icon = (u) => methodIconSrc(u.method)
</script>
