<template>
  <section class="ps" aria-label="Start a plan">
    <div v-if="$slots.saved" class="ps-saved"><slot name="saved" /></div>

    <!-- The Smart Planner: a few questions and the steps they lead to -->
    <SmartPlanner :skills="skills" :has-player="hasPlayer" :player-label="playerLabel" @start="(profile) => $emit('smart', profile)" @ready-made="scrollToReadyMade" />

    <!-- Recommended plans: three to begin with, the rest on request -->
    <div id="ps-start" class="ps-block">
      <header class="ps-head">
        <h2>Start from a recommended plan</h2>
      </header>
      <p class="rp-sub">Pick one and every goal is set up for you, worked out from {{ hasPlayer ? `${playerLabel}'s` : 'your' }} stats{{ hasPlayer ? '' : ' (every skill starts from level 1 until you add your name)' }}. Change anything afterwards.</p>
      <RecommendedPlans
        quiet
        featured
        :skills="skills"
        :has-player="hasPlayer"
        :hours-per-day="hoursPerDay"
        :global-strategy="globalStrategy"
        :gp-value="gpValue"
        @use="(r) => $emit('use', r)"
      />
      <p v-if="canShowAll" class="ps-seemore"><button class="ps-all-toggle" type="button" aria-haspopup="dialog" @click="showAll = true">See more plans</button></p>
    </div>

    <PlannerPlansModal
      v-if="showAll"
      :skills="skills"
      :has-player="hasPlayer"
      :player-label="playerLabel"
      :hours-per-day="hoursPerDay"
      :global-strategy="globalStrategy"
      :gp-value="gpValue"
      @close="showAll = false"
      @use="onModalUse"
    />

    <div class="rp-or"><span>or build your own</span></div>

    <!-- Build one from scratch -->
    <div class="byo">
      <div class="byo-skills" role="group" aria-label="Start with a skill">
        <button v-for="s in SKILL_NAMES" :key="s" class="byo-skill" type="button" :title="s" :aria-label="`Start with ${s}`" @click="$emit('custom', s)">
          <img :src="skillIconSrc(s)" alt="" width="26" height="26" />
          <span>{{ s }}</span>
        </button>
      </div>
    </div>

    <!-- What a finished estimate looks like (only before there are stats to show a real one) -->
    <aside v-if="!hasPlayer && example" class="ps-example" aria-label="Example plan">
      <div class="ps-example-head">
        <span class="ps-example-tag">Example plan</span>
        <h3>{{ example.title }}</h3>
      </div>
      <dl class="ps-example-totals">
        <div><dt>Time</dt><dd>{{ formatHours(example.totalHours) }}</dd></div>
        <div v-if="example.netGp != null"><dt>{{ example.netGp >= 0 ? 'Profit' : 'GP cost' }}</dt><dd :class="example.netGp >= 0 ? 'planner-gain' : 'planner-cost'">{{ formatGp(example.netGp) }}</dd></div>
        <div v-if="example.days != null"><dt>At {{ hoursPerDay }} h/day</dt><dd>{{ example.days.toLocaleString('en-US') }} day{{ example.days === 1 ? '' : 's' }}</dd></div>
      </dl>
      <ul class="ps-example-rows">
        <li v-for="e in example.rows" :key="e.skill">
          <img :src="skillIconSrc(e.skill)" alt="" width="18" height="18" />
          <span>{{ e.skill }}</span>
          <small>1 to {{ e.to }}</small>
          <i :style="{ width: `${e.share}%` }" aria-hidden="true" />
          <b>{{ formatHours(e.hours) }}</b>
        </li>
      </ul>
      <p class="ps-example-note">Only an example, worked out from level 1. Yours uses your own stats and training choices.</p>
    </aside>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import RecommendedPlans from '@/components/planner/RecommendedPlans.vue'
import SmartPlanner from '@/components/planner/SmartPlanner.vue'
import PlannerPlansModal from '@/components/planner/PlannerPlansModal.vue'
import { SKILL_NAMES, skillIconSrc } from '@/utils/osrsSkills'
import { formatGp, formatHours, levelAtXp, planGoal } from '@/utils/planner'
import { resolveGoal } from '@/utils/plannerTools'
import { levelPlan, recommendedPlans, skillStates } from '@/utils/recommendedPlans'

const props = defineProps({
  // The player's hiscores skills ({ Mining: { xp, level } }), or null with no player.
  skills: { type: Object, default: null },
  hasPlayer: { type: Boolean, default: false },
  playerLabel: { type: String, default: '' },
  hoursPerDay: { type: Number, default: 2 },
  globalStrategy: { type: String, default: 'auto-fast' },
  gpValue: { type: Number, default: 2_000_000 },
})
const emit = defineEmits(['use', 'custom', 'smart'])
const scrollToReadyMade = () => document.getElementById('ps-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

const allCount = computed(() => recommendedPlans(props.skills).length)
const canShowAll = computed(() => allCount.value > 3)
const showAll = ref(false)
function onModalUse(r) {
  showAll.value = false
  emit('use', r)
}

// A small, real calculation from level 1, so the example is the same kind of estimate the planner gives.
const EXAMPLE_SKILLS = ['Woodcutting', 'Fishing', 'Mining']
const EXAMPLE_LEVEL = 70
const example = computed(() => {
  const goals = levelPlan(skillStates(null), EXAMPLE_LEVEL, EXAMPLE_SKILLS)
  const plans = goals.map((g) => planGoal(resolveGoal(g, props.globalStrategy, props.gpValue)))
  const totalHours = plans.reduce((sum, p) => sum + (p.hours || 0), 0)
  if (!goals.length || !(totalHours > 0)) return null
  const gpPlans = plans.filter((p) => p.netGp != null)
  const hpd = Number(props.hoursPerDay) > 0 ? Number(props.hoursPerDay) : null
  return {
    title: `${EXAMPLE_SKILLS.slice(0, -1).join(', ')} and ${EXAMPLE_SKILLS.at(-1)} to ${EXAMPLE_LEVEL}`,
    rows: goals.map((g, i) => ({ skill: g.skill, to: levelAtXp(g.targetXp, true), hours: plans[i].hours || 0, share: Math.max(6, Math.round(((plans[i].hours || 0) / totalHours) * 100)) })),
    totalHours,
    netGp: gpPlans.length ? gpPlans.reduce((sum, p) => sum + p.netGp, 0) : null,
    days: hpd ? Math.ceil(totalHours / hpd) : null,
  }
})
</script>
