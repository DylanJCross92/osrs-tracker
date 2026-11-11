<template>
  <div class="rp" :class="{ compact }">
    <p v-if="!hasPlayer && !compact" class="rp-hint">Enter your OSRS name above and these are worked out from your own stats. Without it they start every skill from level 1.</p>
    <p v-if="!shown.length" class="rp-none">Nothing to recommend: every goal on offer is already done. Add a goal of your own to keep going.</p>
    <ul v-else class="rp-grid">
      <li v-for="r in shown" :key="r.id" class="rp-card" :class="`kind-${r.kind}`">
        <span class="rp-kicker">{{ KIND_LABELS[r.kind] }}</span>
        <h3>{{ r.title }}</h3>
        <p class="rp-desc">{{ r.description }}</p>
        <div class="rp-icons" aria-hidden="true">
          <img v-for="g in r.goals.slice(0, 9)" :key="g.skill" :src="skillIconSrc(g.skill)" :alt="g.skill" width="20" height="20" :title="g.skill" />
          <span v-if="r.goals.length > 9" class="rp-more">+{{ r.goals.length - 9 }}</span>
        </div>
        <dl class="rp-meta">
          <div><dt>Goals</dt><dd>{{ r.skillCount }} skill{{ r.skillCount === 1 ? '' : 's' }}</dd></div>
          <div v-if="hasPlayer && summaries[r.id]"><dt>Training time</dt><dd>{{ formatHours(summaries[r.id].totalHours) }}</dd></div>
          <div v-if="hasPlayer && summaries[r.id]?.days != null"><dt>At {{ hoursPerDay }} h/day</dt><dd>{{ summaries[r.id].days.toLocaleString('en-US') }} days</dd></div>
        </dl>
        <button class="btn btn-primary rp-use" type="button" @click="$emit('use', r)">Use this plan</button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatHours } from '@/utils/planner'
import { summarizePlan } from '@/utils/plannerTools'
import { recommendedPlans, suggestedPlans } from '@/utils/recommendedPlans'

const props = defineProps({
  // The player's hiscores skills ({ Mining: { xp, level } }), or null before one is loaded.
  skills: { type: Object, default: null },
  hasPlayer: { type: Boolean, default: false },
  hoursPerDay: { type: Number, default: 2 },
  globalStrategy: { type: String, default: 'auto-fast' },
  gpValue: { type: Number, default: 2_000_000 },
  // Show only the few most relevant plans (for players who already have one).
  limit: { type: Number, default: 0 },
  compact: { type: Boolean, default: false },
})
defineEmits(['use'])

const KIND_LABELS = { levels: 'All skills', combat: 'Combat', total: 'Total level' }

const all = computed(() => recommendedPlans(props.skills))
const shown = computed(() => (props.limit ? suggestedPlans(all.value, props.limit) : all.value))
// Time and GP for each card, worked out with the plan's own settings. Only when there is a player to measure from.
const summaries = computed(() => {
  if (!props.hasPlayer) return {}
  const out = {}
  for (const r of shown.value) out[r.id] = summarizePlan({ goals: r.goals, globalStrategy: props.globalStrategy, gpValue: props.gpValue, hoursPerDay: props.hoursPerDay })
  return out
})
</script>
