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
        <span v-if="routeMethods.length" class="pd-chip" :class="{ 'is-bad': blocked }">{{ blocked ? `${blocked} missing` : `${routeMethods.length} ${routeMethods.length === 1 ? 'requirement set' : 'requirement sets'}` }}</span>
        <span v-if="mats.untracked.length || mats.supplies.length" class="pd-chip" title="Some of what this route uses up is not listed">some items not listed</span>
      </span>
      <svg class="pd-chev" :class="{ open }" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>

    <div v-if="open" :id="`pd-${id}`" class="pd-body">
      <section v-if="matsListed" class="pd-sec">
        <PlannerMaterials :plan="plan" />
      </section>

      <section v-if="plan.questList?.length" class="pd-sec">
        <h4 class="goal-section-title">Quests</h4>
        <ul class="pd-quests">
          <li v-for="q in plan.questList" :key="q.id">
            <b>{{ q.name }}</b>
            <span class="stat-gain">+{{ formatNum(q.xp) }} xp</span>
            <small v-if="q.minutes">about {{ q.minutes }} min</small>
          </li>
        </ul>
        <p class="planner-hint">These quests are done first for free {{ goal.skill }} xp, which takes {{ formatHours(plan.questHours || 0) }} and skips part of the training below.</p>
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
import { formatHours, formatNum } from '@/utils/planner'
import { buyOf } from '@/utils/priceBook'
import { gpText } from '@/utils/geFormat'

// Everything a skill's route needs, read-only: what to buy (at live Grand Exchange prices), which quests it does first, and what each method
// requires. It sits under the route on the plan page, folded to one line that says what is inside; the skill editor has the same things to change.
const props = defineProps({
  plan: { type: Object, required: true },
  goal: { type: Object, required: true },
})
defineEmits(['edit'])

const STATE_TEXT = { blocked: 'Requirement missing', unconfirmed: 'Needs confirming', planned: 'Your plan covers it', available: 'Requirements met' }
const open = ref(false)
const id = computed(() => props.goal.skill.toLowerCase())
const mats = computed(() => materialsForPlan(props.plan))
// Whether there is anything to list for the materials (a priced list, or a note that some items are not tracked).
const matsListed = computed(() => !!(mats.value.rows.length || mats.value.untracked.length || mats.value.supplies.length))
// A route with nothing to buy, no quests and no requirements has nothing to open.
const allClear = computed(() => !matsListed.value && !props.plan.questList?.length && !routeMethods.value.length)
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
