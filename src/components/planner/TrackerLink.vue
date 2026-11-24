<template>
  <div class="ptl" :class="[`is-${variant}`]" role="status">
    <span class="ptl-ico" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
    </span>
    <div class="ptl-text">
      <span class="ptl-eyebrow">Quest and diary tracker</span>
      <b>{{ headline }}</b>
      <span>{{ sub }}</span>
    </div>
    <!-- What to do next: the quest that helps the plan being worked on, or the best thing to do next -->
    <RouterLink v-if="pick" class="ptl-next" :to="pickTo" @click="track('tracker_pick_click', { place, source: pick.source, kind: pick.kind })">
      <span class="ptl-next-label">{{ pick.source === 'plan' ? `Next for ${pick.planName}` : 'Do this next' }}</span>
      <b>{{ pick.name }}</b>
      <small>{{ pick.why }}</small>
      <em :class="`is-${pick.status}`">{{ pick.status === 'ready' ? 'You can start it now' : pick.note }}</em>
    </RouterLink>
    <RouterLink class="btn" :class="{ 'btn-primary': prominent }" :to="{ name: 'quests' }" @click="track('tracker_link_click', { place })">{{ cta }}</RouterLink>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRequirements } from '@/composables/useRequirements'
import { track } from '@/utils/analytics'

// A pointer from the planner to the quest and diary tracker, worded for where the person is: a plan with parts that depend on something they have
// not confirmed, nothing marked yet, or a tracker already in use. `unconfirmed` is how many skills in the plan use a method with an open requirement.
// `pick` is the suggestion to show (see utils/trackerPick.js): { name, why, note, status, source, planName, kind, id }.
const props = defineProps({ unconfirmed: { type: Number, default: 0 }, place: { type: String, default: 'planner' }, variant: { type: String, default: 'bar' }, pick: { type: Object, default: null } })
const { questStats, diaryStats } = useRequirements()

// Lands on the tracker with that quest or tier opened.
const pickTo = computed(() => ({ name: 'quests', query: { ...(props.pick?.kind === 'diary' ? { tab: 'diaries' } : {}), focus: props.pick?.id } }))
const none = computed(() => questStats.value.done === 0 && diaryStats.value.done === 0)
const prominent = computed(() => props.unconfirmed > 0 || none.value)
const headline = computed(() => {
  if (props.unconfirmed > 0) return `${props.unconfirmed} skill${props.unconfirmed === 1 ? '' : 's'} in this plan ${props.unconfirmed === 1 ? 'uses' : 'use'} methods that need a quest, diary or item`
  if (none.value) return 'Tell the planner which quests and diaries you have done'
  return `${questStats.value.done} quest${questStats.value.done === 1 ? '' : 's'} and ${diaryStats.value.done} diary tier${diaryStats.value.done === 1 ? '' : 's'} marked as done`
})
const sub = computed(() => {
  // (Where it is kept is said by the bar at the bottom of the screen for someone not signed in.)
  const keep = ''
  if (props.unconfirmed > 0) return `Tick what you have finished and the planner counts those methods as ready.${keep}`
  if (none.value) return `Mark them once and every method that needs them is counted as ready, finished quest XP is never counted twice, and you get suggestions for what to do next.${keep}`
  return `The planner is using them for every plan. Keep them up to date as you play.${keep}`
})
const cta = computed(() => (props.unconfirmed > 0 ? 'Review in the quest tracker' : 'Open the quest and diary tracker'))
</script>
