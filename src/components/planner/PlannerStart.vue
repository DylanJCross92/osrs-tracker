<template>
  <section class="ps" aria-label="Start a plan">
    <div v-if="$slots.saved" class="ps-saved"><slot name="saved" /></div>

    <!-- What kind of account the plans are for: asked before any plan is shown -->
    <AccountSetup v-if="!seen" :account="account" :skills="skills" :player-label="playerLabel" @change="(patch) => $emit('account', patch)" @done="markSeen" />

    <!-- Recommended plans: the top three, always shown; every plan is in the Ready-made plan window -->
    <div id="ps-start" class="ps-block">
      <header class="ps-head">
        <h2>Recommended plans</h2>
      </header>
      <p class="rp-sub">Pick one and every goal is set up for you, worked out from {{ hasPlayer ? `${playerLabel}'s` : 'your' }} stats{{ hasPlayer ? '' : ' (every skill starts from level 1 until you add your name)' }}. Change anything afterwards.</p>
      <RecommendedPlans
        quiet
        :account="account"
        featured
        :skills="skills"
        :has-player="hasPlayer"
        :player-label="playerLabel"
        :hours-per-day="hoursPerDay"
        :global-strategy="globalStrategy"
        :gp-value="gpValue"
        @use="(r) => $emit('use', r)"
        @open="(r) => $emit('open', r)"
      />
      <p v-if="canShowAll" class="ps-seemore"><button class="ps-all-toggle" type="button" aria-haspopup="dialog" @click="showAll = true">See all ready-made plans</button></p>
    </div>

    <!-- Two ways side by side: build one from a skill, or let the Smart Planner decide -->
    <div class="ps-split">
      <section id="ps-skill" class="ps-split-col ps-split-skill" aria-labelledby="ps-skill-h">
        <h2 id="ps-skill-h" class="ps-split-h">Or build your own</h2>
        <p class="ps-split-sub">Pick a skill and set your own goal, then fine-tune the route.{{ hasPlayer ? ` The number is ${playerLabel}'s level now.` : '' }}</p>
        <div class="byo byo-split">
          <div class="byo-skills" role="group" aria-label="Start with a skill">
            <button v-for="s in SKILL_NAMES" :key="s" class="byo-skill" :class="{ 'is-locked': locked.has(s) }" type="button" :disabled="locked.has(s)" :title="locked.has(s) ? lockText(s) : s" :aria-label="locked.has(s) ? `${s}, locked for your account` : `Start with ${s}`" @click="$emit('custom', s)">
              <img :src="skillIconSrc(s)" alt="" width="26" height="26" />
              <span>{{ s }}</span>
              <i v-if="levelOf(s) != null" class="byo-lvl" :class="{ maxed: levelOf(s) >= 99 }" :title="`${playerLabel || 'Your'} level ${levelOf(s)}`">{{ levelOf(s) }}</i>
            </button>
          </div>
        </div>
      </section>
      <section class="ps-split-col ps-split-smart" aria-labelledby="ps-smart-h">
        <h2 id="ps-smart-h" class="ps-split-h">Or let the Smart Planner decide</h2>
        <p class="ps-split-sub">Not sure where to start? A few questions and your real levels.</p>
        <SmartPlanner :skills="skills" :has-player="hasPlayer" :player-label="playerLabel" @start="(profile) => $emit('smart', profile)" @ready-made="showPlans(true)" @open-change="(open) => $emit('smart-open', open)">
          <template #name-box><slot name="name-box" /></template>
        </SmartPlanner>
      </section>
    </div>

    <TrackerLink class="ps-tracker" place="start" />

    <PlannerPlansModal
      v-if="showAll"
      :skills="skills"
      :account="account"
      :has-player="hasPlayer"
      :player-label="playerLabel"
      :hours-per-day="hoursPerDay"
      :global-strategy="globalStrategy"
      :gp-value="gpValue"
      @close="showAll = false"
      @use="onModalUse"
      @open="onModalOpen"
    />

    <!-- What a finished estimate looks like (only before there are stats to show a real one) -->
    <aside v-if="!hasPlayer && example" class="ps-example" aria-label="Example plan">
      <div class="ps-example-head">
        <span class="ps-example-tag">Example plan</span>
        <h3>{{ example.title }}</h3>
      </div>
      <dl class="ps-example-totals">
        <div><dt>Time</dt><dd>{{ formatHours(example.totalHours) }}</dd></div>
        <div v-if="example.netGp != null" class="gp-figure"><dt>{{ example.netGp >= 0 ? 'Profit' : 'GP cost' }}</dt><dd :class="example.netGp >= 0 ? 'planner-gain' : 'planner-cost'">{{ formatGp(example.netGp) }}</dd></div>
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
import { computed, nextTick, ref } from 'vue'
import AccountSetup from '@/components/planner/AccountSetup.vue'
import RecommendedPlans from '@/components/planner/RecommendedPlans.vue'
import { buildOf } from '@/data/builds'
import { useAccountSetupSeen } from '@/composables/useAccountSetupSeen'
import { lockReason, lockedSkills } from '@/utils/builds'
import SmartPlanner from '@/components/planner/SmartPlanner.vue'
import PlannerPlansModal from '@/components/planner/PlannerPlansModal.vue'
import TrackerLink from '@/components/planner/TrackerLink.vue'
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
  // What kind of account the plans are for (the loaded player's own settings): { members, iron, ironKind, build }.
  account: { type: Object, default: () => ({ members: true, iron: false, ironKind: 'standard', build: 'main' }) },
})
const emit = defineEmits(['use', 'open', 'custom', 'smart', 'smart-open', 'account'])
// The ready-made plans are at the top of the page; the links that point at them scroll there.
async function showPlans(scroll = false) {
  if (!scroll) return
  await nextTick()
  document.getElementById('ps-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
defineExpose({ showPlans })

// Skills the chosen build never trains are shown but cannot be picked.
const { seen, markSeen } = useAccountSetupSeen()
const locked = computed(() => new Set(lockedSkills(props.account)))
const build = computed(() => props.account.build)
const lockText = (s) => (lockReason(props.account, s) === 'members' ? `${s} is members-only` : `${s} is locked for a ${buildOf(build.value).short.toLowerCase()}`)

// The player's current level in a skill, when a player is chosen
const levelOf = (skill) => (props.hasPlayer ? props.skills?.[skill]?.level ?? null : null)
const allCount = computed(() => recommendedPlans(props.skills, props.account).length)
const canShowAll = computed(() => allCount.value > 3)
const showAll = ref(false)
function onModalOpen(r) {
  showAll.value = false
  emit('open', r)
}
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
