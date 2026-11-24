<template>
  <div class="trk-diaries">
    <p class="trk-cape">
      <b>Achievement diary cape</b>
      <span v-if="stats.cape">Every Elite diary is done, so the cape counts as yours in the planner.</span>
      <span v-else>{{ stats.elites }} of 12 Elite diaries done. The cape needs all twelve; methods that need it open up when you finish.</span>
    </p>
    <DiaryRegion v-for="d in DIARIES" :key="d.slug" :region="d" />
    <div class="trk-bulk">
      <button class="btn-text" type="button" :disabled="stats.done === 0" @click="clearAll">Clear every diary tier</button>
    </div>
  </div>
</template>

<script setup>
import { DIARIES, ALL_DIARY_TIERS } from '@/data/diaries'
import { useRequirements } from '@/composables/useRequirements'
import { track } from '@/utils/analytics'
import DiaryRegion from '@/components/tracker/DiaryRegion.vue'

const { diaryStats: stats, setMany } = useRequirements()

function clearAll() {
  if (!window.confirm('Clear all your diary answers?')) return
  setMany(Object.fromEntries(ALL_DIARY_TIERS.map((t) => [t.id, null])))
  track('diary_tracker_bulk', { done: false })
}
</script>
