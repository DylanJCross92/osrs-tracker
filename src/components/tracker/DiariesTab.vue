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
    <div class="trk-ctl">
      <TrackerSearch v-model="search" :items="searchItems" placeholder="Search diaries, e.g. Karamja or Hard Falador" aria-label="Search diaries" @pick="pickDiary" />
    </div>
    <p v-if="!regions.length" class="acc-empty">No diary matches. <button class="btn-text" type="button" @click="search = ''">Clear the search</button></p>
    <DiaryRegion v-for="d in regions" :key="d.slug" :region="d" :focus="local || focus" @focused="onFocused" />
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
import { computed, ref } from 'vue'
import TrackerSearch from '@/components/tracker/TrackerSearch.vue'
import DiaryRegion from '@/components/tracker/DiaryRegion.vue'

defineProps({ focus: { type: Object, default: null } })
const emit = defineEmits(['focused'])
const { diaryStats: stats, setMany, confirmations } = useRequirements()

const search = ref('')
const local = ref(null)
// Every region and every tier by name ("Karamja", "Hard Karamja Diary"), for the search box.
const searchItems = DIARIES.flatMap((d) => [
  { label: d.name, value: d.slug, sub: 'Region', tier: null },
  ...d.tiers.map((t) => ({ label: t.name, value: t.id, sub: 'Tier', tier: t })),
])
// A region shows when what is typed is in its name or in the name of one of its tiers.
const regions = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return DIARIES
  return DIARIES.filter((d) => d.name.toLowerCase().includes(term) || d.tiers.some((t) => t.name.toLowerCase().includes(term)))
})
// Picking a suggestion opens that region (on that tier) and brings it into view.
function pickDiary(item) {
  const region = DIARIES.find((d) => d.slug === item.value || d.tiers.some((t) => t.id === item.value))
  const tier = item.tier || region.tiers.find((t) => !tierDone(t.id, confirmations.value)) || region.tiers[3]
  local.value = { kind: 'diary', id: tier.id, at: Date.now() }
  track('tracker_search_pick', { kind: 'diary' })
}
function onFocused() {
  local.value = null
  emit('focused')
}

function clearAll() {
  if (!window.confirm('Clear all your diary answers?')) return
  setMany(Object.fromEntries(ALL_DIARY_TIERS.map((t) => [t.id, null])))
  track('diary_tracker_bulk', { done: false })
}
</script>
