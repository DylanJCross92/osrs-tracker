<template>
  <div class="trk">
    <TrackerSaveBanner place="panel" />

    <div class="trk-sum">
      <TrackerRing :value="questStats.done" :total="questStats.total" label="Quests" :sub="`${Math.floor(questStats.pct * 100)}% complete`" />
      <TrackerRing :value="qp.have" :total="qp.total" label="Quest points" :sub="qp.have >= qp.total ? 'Quest cape ready' : `${qp.total - qp.have} to go`" />
      <TrackerRing :value="diaryStats.done" :total="diaryStats.total" label="Diary tiers" :sub="diaryStats.cape ? 'Diary cape ready' : `${diaryStats.elites} of 12 Elite done`" />
    </div>

    <TrackerSuggest @focus="onFocus" />

    <div class="trk-tabs" role="tablist" aria-label="Tracker">
      <button type="button" role="tab" :aria-selected="tab === 'quests'" :class="{ active: tab === 'quests' }" @click="$emit('update:tab', 'quests')">Quests <small>{{ questStats.done }}/{{ questStats.total }}</small></button>
      <button type="button" role="tab" :aria-selected="tab === 'diaries'" :class="{ active: tab === 'diaries' }" @click="$emit('update:tab', 'diaries')">Achievement diaries <small>{{ diaryStats.done }}/{{ diaryStats.total }}</small></button>
    </div>

    <QuestsTab v-if="tab === 'quests'" :focus="focusTarget" @focused="focusTarget = null" />
    <DiariesTab v-else :focus="focusTarget" @focused="focusTarget = null" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRequirements } from '@/composables/useRequirements'
import { questPoints } from '@/utils/questProgress'
import { track } from '@/utils/analytics'
import TrackerSaveBanner from '@/components/tracker/TrackerSaveBanner.vue'
import TrackerRing from '@/components/tracker/TrackerRing.vue'
import TrackerSuggest from '@/components/tracker/TrackerSuggest.vue'
import QuestsTab from '@/components/tracker/QuestsTab.vue'
import DiariesTab from '@/components/tracker/DiariesTab.vue'

const props = defineProps({ tab: { type: String, default: 'quests' } })
const emit = defineEmits(['update:tab'])

const { questStats, diaryStats, confirmations } = useRequirements()
const qp = computed(() => questPoints(confirmations.value))

// "Details" on a suggestion: go to that quest or diary below, open it and scroll to it.
const focusTarget = ref(null)
async function onFocus(s) {
  track('tracker_suggestion_details', { kind: s.kind })
  const want = s.kind === 'diary' ? 'diaries' : 'quests'
  // The tab it belongs to picks this up as soon as it is on screen (straight away if it already is).
  if (props.tab !== want) emit('update:tab', want)
  focusTarget.value = { ...s, at: Date.now() }
}
</script>
