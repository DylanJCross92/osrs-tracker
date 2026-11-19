<template>
  <div v-if="show" class="pf">
    <span v-if="streak" class="pf-streak" :class="`is-${streak.kind}`" :title="streak.hint">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2c1.2 3.2 4.6 4.7 4.6 9.2a4.6 4.6 0 01-9.2 0c0-1.9.9-3.2 1.8-4.3.3 1.3 1.1 2 1.8 2C11 6.2 11 4.3 12 2z" /></svg>
      <b>{{ streak.text }}</b>
      <small v-if="streak.best">best {{ streak.best.toLocaleString('en-US') }}</small>
    </span>
    <button v-if="pinned" type="button" class="pf-pin" :title="pinned.description" @click="$emit('open-achievements')">
      <svg class="pf-pin-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 14v7" /></svg>
      <img v-if="pinned.skill" :src="skillIconSrc(pinned.skill)" alt="" width="18" height="18" />
      <b>{{ pinned.title }}</b>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { pinnedAchievement, streakFlair } from '@/utils/badges'
import { skillIconSrc } from '@/utils/osrsSkills'

// The streak and the achievement the owner pinned, shown beside the follower counts. (The milestone totals are the stat chips
// below, and the achievement count lives on the Achievements tab; the owner pins from Customize.)
const props = defineProps({
  streak: { type: Object, default: null },
  achievements: { type: Array, default: () => [] },
  pinnedKey: { type: String, default: '' },
})
defineEmits(['open-achievements'])

const streak = computed(() => streakFlair(props.streak))
const pinned = computed(() => pinnedAchievement(props.achievements, props.pinnedKey))
const show = computed(() => Boolean(streak.value || pinned.value))
</script>
