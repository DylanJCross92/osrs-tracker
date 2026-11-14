<template>
  <div v-if="show" class="pf">
    <div v-if="streak || pinned || canPin" class="pf-row">
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
      <button v-else-if="canPin" type="button" class="pf-pin is-empty" @click="$emit('customize')">+ Pin an achievement</button>
    </div>

    <div v-if="badges.capes.length || badges.totalLevel || badges.totalXp" class="pf-badges" aria-label="Milestone badges">
      <span v-if="badges.capes.length" class="pf-capes">
        <b>{{ badges.capes.length }} × 99</b>
        <span class="pf-capes-icons">
          <img v-for="c in badges.capes" :key="c.skill" class="pf-cape" :class="{ 'is-max': c.max }" :src="skillIconSrc(c.skill)" :alt="`99 ${c.skill}${c.max ? ' and 200M XP' : ''}`" :title="`99 ${c.skill}${c.max ? ', 200M XP' : ''}`" width="22" height="22" />
        </span>
      </span>
      <span v-if="badges.totalLevel" class="pf-chip" :title="badges.totalLevel.title">{{ badges.totalLevel.value.toLocaleString('en-US') }} total level</span>
      <span v-if="badges.totalXp" class="pf-chip" :title="badges.totalXp.title">{{ formatXp(badges.totalXp.value) }} total XP</span>
      <button type="button" class="pf-all" @click="$emit('open-achievements')">{{ badges.earned }} of {{ badges.total }} achievements</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { flairBadges, pinnedAchievement, streakFlair } from '@/utils/badges'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'

const props = defineProps({
  streak: { type: Object, default: null },
  achievements: { type: Array, default: () => [] },
  pinnedKey: { type: String, default: '' },
  isOwner: { type: Boolean, default: false },
})
defineEmits(['open-achievements', 'customize'])

const streak = computed(() => streakFlair(props.streak))
const badges = computed(() => flairBadges(props.achievements))
const pinned = computed(() => pinnedAchievement(props.achievements, props.pinnedKey))
// The owner is offered the pin once there is something to pin.
const canPin = computed(() => props.isOwner && badges.value.earned > 0)
const show = computed(() => Boolean(streak.value || pinned.value || canPin.value || badges.value.capes.length || badges.value.totalLevel || badges.value.totalXp))
</script>
