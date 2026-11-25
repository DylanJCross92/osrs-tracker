<template>
  <div class="rp" :class="{ compact, three: featured, tight: tight || featured }">
    <p v-if="!hasPlayer && !compact && !featured && !quiet" class="rp-hint">Enter your OSRS name above and these are worked out from your own stats. Without it they start every skill from level 1.</p>
    <p v-if="!shown.length" class="rp-none">Nothing to recommend: every goal on offer is already done. Add a goal of your own to keep going.</p>
    <ul v-else class="rp-grid">
      <li v-for="r in shown" :key="r.id" class="rp-card" :class="`kind-${r.kind}`">
        <span class="rp-kicker">{{ KIND_LABELS[r.kind] }}</span>
        <h3><button class="rp-open" type="button" aria-haspopup="dialog" :title="`Open ${r.title} without saving it`" @click="$emit('open', r)">{{ r.title }}</button></h3>
        <p class="rp-desc">{{ r.description }}</p>
        <div class="rp-icons" aria-hidden="true">
          <img v-for="g in r.goals.slice(0, MAX_ICONS)" :key="g.skill" :src="skillIconSrc(g.skill)" :alt="g.skill" width="20" height="20" :title="g.skill" />
          <span v-if="r.goals.length > MAX_ICONS" class="rp-more">+{{ r.goals.length - MAX_ICONS }}</span>
        </div>
        <dl class="rp-meta" :class="{ gp: summaries[r.id].netGp != null }">
          <div><dt>Goals</dt><dd>{{ r.skillCount }} skill{{ r.skillCount === 1 ? '' : 's' }}</dd></div>
          <div><dt>Time</dt><dd>{{ formatHours(summaries[r.id].totalHours) }}</dd></div>
          <div><dt>At {{ hoursPerDay }} h/day</dt><dd>{{ summaries[r.id].days != null ? formatDays(summaries[r.id].days) : formatHours(summaries[r.id].totalHours) }}</dd></div>
          <div v-if="summaries[r.id].netGp != null" class="gp-figure" :title="live ? 'Worked out from live Grand Exchange prices, after the 2% tax' : 'An estimate from saved prices'">
            <dt>{{ summaries[r.id].netGp >= 0 ? 'Profit' : 'GP cost' }}</dt>
            <dd :class="summaries[r.id].netGp >= 0 ? 'planner-gain' : 'planner-cost'"><i v-if="live" class="rp-live" aria-hidden="true" />{{ formatGp(summaries[r.id].netGp).replace(/ gp$/, '') }}</dd>
          </div>
        </dl>
        <button class="btn btn-primary rp-use" type="button" @click="$emit('use', r)">Use this plan</button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { applyRules } from '@/utils/builds'
import { freeMethodIds } from '@/utils/membership'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatDays, formatGp, formatHours } from '@/utils/planner'
import { priceStatus } from '@/utils/priceBook'
import { summarizePlan } from '@/utils/plannerTools'
import { featuredPlans, recommendedPlans, suggestedPlans } from '@/utils/recommendedPlans'

const props = defineProps({
  // What kind of account the plans are for: { members, iron, ironKind, build }.
  account: { type: Object, default: () => ({ members: true, iron: false, ironKind: 'standard', build: 'main' }) },
  // Lead with the featured plans (All skills to 70, Combat to 99, Max account) instead of the whole catalogue.
  featured: { type: Boolean, default: false },
  // No hint line (the screen around the cards already says it).
  quiet: { type: Boolean, default: false },
  // Shorter cards (used for the leading plans and in the list of every plan).
  tight: { type: Boolean, default: false },
  // The player's hiscores skills ({ Mining: { xp, level } }), or null before one is loaded.
  skills: { type: Object, default: null },
  hasPlayer: { type: Boolean, default: false },
  playerLabel: { type: String, default: '' },
  hoursPerDay: { type: Number, default: 2 },
  globalStrategy: { type: String, default: 'auto-fast' },
  gpValue: { type: Number, default: 2_000_000 },
  // Show only the few most relevant plans (for players who already have one).
  limit: { type: Number, default: 0 },
  compact: { type: Boolean, default: false },
})
defineEmits(['use', 'open'])

// True once the Grand Exchange prices have loaded, so the gp figure on each card is the live one.
const live = computed(() => priceStatus.value.loaded && !priceStatus.value.stale)
const MAX_ICONS = 8
const KIND_LABELS = { levels: 'All skills', combat: 'Combat', total: 'Total level' }

// The plans are for the account chosen on the setup above them: its build decides which skills they cover and where they stop.
const rules = computed(() => ({ members: props.account.members, build: props.account.build, iron: props.account.iron, ironKind: props.account.ironKind }))
const all = computed(() => recommendedPlans(props.skills, props.account))
const shown = computed(() => (props.featured ? featuredPlans(all.value) : props.limit ? suggestedPlans(all.value, props.limit) : all.value))
// Time for each card, worked out with the plan's own settings, from the player's stats (or from level 1 with no player).
const summaries = computed(() => {
  const out = {}
  for (const r of shown.value) out[r.id] = summarizePlan({ goals: applyRules(r.goals, rules.value, null, freeMethodIds), globalStrategy: props.globalStrategy, gpValue: props.gpValue, hoursPerDay: props.hoursPerDay })
  return out
})
</script>
