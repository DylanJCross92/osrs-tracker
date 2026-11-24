<template>
  <div class="trk-diaries">
    <div class="trk-cape">
      <div>
        <b>Achievement diary cape</b>
        <span v-if="stats.cape">Every Elite diary is done, so the cape counts as yours in the planner.</span>
        <span v-else>The cape needs all 12 Elite diaries. Methods that need it open up when you finish.</span>
      </div>
      <ol class="trk-cape-dots" :aria-label="`${stats.elites} of 12 Elite diaries done`">
        <li v-for="d in DIARIES" :key="d.slug" :class="{ on: tierDone(d.tiers[3].id, confirmations) }" :title="`${d.name} Elite`" />
      </ol>
    </div>
    <p class="trk-hint">Tick the tiers you have finished. A tier needs the ones before it, so ticking Hard also ticks Easy and Medium.</p>
    <DiaryRegion v-for="d in DIARIES" :key="d.slug" :region="d" :focus="focus" @focused="$emit('focused')" />
    <div class="trk-bulk">
      <button class="btn-text" type="button" :disabled="stats.done === 0" @click="clearAll">Clear every diary tier</button>
    </div>
  </div>
</template>

<script setup>
import { DIARIES, ALL_DIARY_TIERS } from '@/data/diaries'
import { useRequirements } from '@/composables/useRequirements'
import { track } from '@/utils/analytics'
import { tierDone } from '@/utils/diaryProgress'
import DiaryRegion from '@/components/tracker/DiaryRegion.vue'

defineProps({ focus: { type: Object, default: null } })
defineEmits(['focused'])
const { diaryStats: stats, setMany, confirmations } = useRequirements()

function clearAll() {
  if (!window.confirm('Clear all your diary answers?')) return
  setMany(Object.fromEntries(ALL_DIARY_TIERS.map((t) => [t.id, null])))
  track('diary_tracker_bulk', { done: false })
}
</script>
