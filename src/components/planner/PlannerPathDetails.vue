<template>
  <!-- Nothing to buy, no quests and no requirements: nothing is drawn at all. -->
  <div v-if="!allClear" class="pd">
    <button class="pd-bar" type="button" :aria-expanded="open" :aria-controls="`pd-${id}`" @click="open = !open">
      <span class="pd-title">Materials, quests and requirements</span>
      <span class="pd-sum">
        <span v-if="mats.rows.length" class="pd-chip" :class="{ 'is-live': cost != null }" :title="cost != null ? 'Cost at live Grand Exchange prices' : 'Items needed'">
          <i v-if="cost != null" class="gpb-dot" aria-hidden="true" />{{ mats.totals.length }} {{ mats.totals.length === 1 ? 'material' : 'materials' }}<template v-if="cost != null"> · {{ gpText(cost) }} gp</template>
        </span>
        <span v-if="plan.questList?.length" class="pd-chip">{{ plan.questList.length }} {{ plan.questList.length === 1 ? 'quest' : 'quests' }}</span>
        <span v-else-if="quests.options.length" class="pd-chip" title="Quests that would give free xp in this skill">{{ quests.options.length }} {{ quests.options.length === 1 ? 'quest' : 'quests' }} to consider</span>
        <span v-if="routeMethods.length" class="pd-chip" :class="{ 'is-bad': blocked }">{{ blocked ? `${blocked} missing` : `${routeMethods.length} ${routeMethods.length === 1 ? 'requirement set' : 'requirement sets'}` }}</span>
        <span v-if="mats.untracked.length || mats.supplies.length" class="pd-chip" title="Some of what this route uses up is not listed">some items not listed</span>
      </span>
      <svg class="pd-chev" :class="{ open }" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>

    <div v-if="open" :id="`pd-${id}`" class="pd-body">
      <section v-if="matsListed" class="pd-sec">
        <PlannerMaterials :plan="plan" />
      </section>

      <section v-if="hasQuestInfo" class="pd-sec">
        <h4 class="goal-section-title">Quests</h4>
        <template v-if="plan.questList?.length">
          <p class="pd-sub">In this plan</p>
          <ul class="pd-quests">
            <li v-for="q in plan.questList" :key="q.id">
              <b>{{ q.name }}</b>
              <span class="stat-gain">+{{ formatNum(q.xp) }} xp</span>
              <small v-if="q.minutes">about {{ q.minutes }} min</small>
            </li>
          </ul>
          <p class="planner-hint">These quests are done first for free {{ goal.skill }} xp, which takes {{ formatHours(plan.questHours || 0) }} and skips part of the training below.</p>
        </template>
        <template v-if="quests.options.length">
          <p class="pd-sub">{{ plan.questList?.length ? 'Could also be added' : 'Could be done for free xp' }}</p>
          <ul class="pd-quests is-options">
            <li v-for="o in quests.options" :key="o.quest.id" :class="{ 'is-locked': o.locked }">
              <b>{{ o.quest.name }}</b>
              <span class="stat-gain">+{{ formatNum(o.xp) }} xp</span>
              <small v-if="o.locked">needs {{ o.need }} {{ goal.skill }}</small>
              <small v-else-if="o.quest.needs">needs {{ o.quest.needs }}</small>
              <small v-else-if="o.quest.minutes">about {{ o.quest.minutes }} min</small>
            </li>
          </ul>
        </template>
        <p v-if="quests.done.length" class="pd-done">
          <span class="pd-done-label"><svg class="pd-tick" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Already finished</span>
          <span v-for="q in quests.done" :key="q.id" class="pd-done-chip">{{ q.name }}</span>
        </p>
        <button v-if="quests.options.length || plan.questList?.length" class="btn-text pd-quest-act" type="button" @click="$emit('edit', 'quests')">{{ plan.questList?.length ? 'Change quest shortcuts' : 'Choose quest shortcuts' }}</button>
      </section>

      <section v-if="routeMethods.length" class="pd-sec">
        <h4 class="goal-section-title">Requirements</h4>
        <div v-for="a in routeMethods" :key="a.method.id" class="goal-req-method" :class="`is-${a.state}`">
          <div class="goal-req-head">
            <b>{{ a.method.name }}</b>
            <span class="goal-req-state">{{ STATE_TEXT[a.state] }}</span>
          </div>
          <RequirementList :items="a.items" :method-name="a.method.name" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import PlannerMaterials from '@/components/planner/PlannerMaterials.vue'
import RequirementList from '@/components/planner/RequirementList.vue'
import { useRouteRequirements } from '@/composables/useRouteRequirements'
import { materialsForPlan } from '@/utils/plannerTools'
import { questsForSkill } from '@/data/quests'
import { useRequirements } from '@/composables/useRequirements'
import { formatHours, formatNum, levelAtXp } from '@/utils/planner'
import { buyOf } from '@/utils/priceBook'
import { gpText } from '@/utils/geFormat'

// Everything a skill's route needs, read-only: what to buy (at live Grand Exchange prices), which quests it does first, and what each method
// requires. It sits under the route on the plan page, folded to one line that says what is inside; the skill editor has the same things to change.
const props = defineProps({
  plan: { type: Object, required: true },
  goal: { type: Object, required: true },
})
defineEmits(['edit'])  // 'edit' carries the editor tab to open on ('quests')

const STATE_TEXT = { blocked: 'Requirement missing', unconfirmed: 'Needs confirming', planned: 'Your plan covers it', available: 'Requirements met' }
const open = ref(false)
const id = computed(() => props.goal.skill.toLowerCase())
const mats = computed(() => materialsForPlan(props.plan))
// Whether there is anything to list for the materials (a priced list, or a note that some items are not tracked).
const matsListed = computed(() => !!(mats.value.rows.length || mats.value.untracked.length || mats.value.supplies.length))
// A route with nothing to buy, no quests and no requirements has nothing to open.
// The quests that give free xp in this skill: what is in the plan, what could be added, and what is already finished.
const { doneQuestIds } = useRequirements()
const quests = computed(() => {
  const skill = props.goal.skill
  const all = questsForSkill(skill)
  const done = new Set(doneQuestIds.value)
  const planned = new Set((props.plan.questList || []).map((q) => q.id))
  const remaining = Math.max((props.plan.targetXp || 0) - (props.plan.currentXp || 0), 0)
  const level = levelAtXp(props.plan.currentXp || 0, true)
  const options = remaining
    ? all
        .filter((q) => !done.has(q.id) && !planned.has(q.id) && q.rewards[skill] <= remaining)
        .slice(0, 4)
        .map((quest) => ({ quest, xp: quest.rewards[skill], need: quest.reqs[skill], locked: quest.reqs[skill] != null && level < quest.reqs[skill] }))
    : []
  return { options, done: all.filter((q) => done.has(q.id)) }
})
const hasQuestInfo = computed(() => !!(props.plan.questList?.length || quests.value.options.length || quests.value.done.length))
const allClear = computed(() => !matsListed.value && !hasQuestInfo.value && !routeMethods.value.length)
// What the materials cost to buy now, or null when none of them has a price yet.
const cost = computed(() => {
  let total = 0
  let any = false
  for (const t of mats.value.totals) {
    const each = buyOf(t.name)
    if (each != null) {
      total += each * t.qty
      any = true
    }
  }
  return any ? Math.round(total) : null
})
const { routeMethods } = useRouteRequirements(computed(() => props.plan))
const blocked = computed(() => routeMethods.value.filter((a) => a.state === 'blocked').length)
</script>
