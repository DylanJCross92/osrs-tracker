<template>
  <div v-if="hasSkills" class="trk-plan">
    <template v-if="goals.length">
      <RouterLink class="btn btn-primary" :to="{ name: 'plannerNew', query }" @click="track('tracker_plan_levels', { kind })">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></svg>
        Plan these levels
      </RouterLink>
      <span class="trk-plan-note">
        A plan for the {{ goals.length }} skill{{ goals.length === 1 ? '' : 's' }} you still need to train<template v-if="req.quests.length">, including what {{ plural(req.quests.length, 'quest') }} first need</template>.
        <template v-if="!player">It starts every skill from level 1: add your name under "What to do next" for your own levels.</template>
      </span>
    </template>
    <p v-else class="trk-plan-done"><span aria-hidden="true">✓</span> You already have every level this needs<template v-if="req.quests.length">, including for the quests first</template>.</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTrackerPlayer } from '@/composables/useTrackerPlayer'
import { goalsForLevels, planQuery } from '@/utils/requirementPlan'
import { track } from '@/utils/analytics'

// "Plan these levels": opens the planner with a goal for every skill a quest or diary tier needs (and the quests it needs first), from the player's
// own XP when one is loaded. req: { skills, quests } from utils/requirementPlan.js.
const props = defineProps({ req: { type: Object, required: true }, kind: { type: String, default: 'quest' }, name: { type: String, default: '' } })
const { player, xp } = useTrackerPlayer()

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const hasSkills = computed(() => Object.keys(props.req.skills).length > 0)
const goals = computed(() => goalsForLevels(props.req.skills, xp.value))
const query = computed(() => planQuery({ goals: goals.value, username: player.value?.username || '', name: props.name }))
</script>
