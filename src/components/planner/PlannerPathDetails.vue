<template>
  <!-- Nothing to buy, no quests and no requirements: nothing is drawn at all. -->
  <div v-if="!allClear" class="pd">
    <button class="pd-bar" type="button" :aria-expanded="open" :aria-controls="`pd-${id}`" @click="open = !open">
      <span class="pd-title">Materials, quests and requirements</span>
      <span class="pd-sum">
        <span v-if="mats.rows.length" class="pd-chip" :class="{ 'is-live': cost != null }" :title="cost != null ? 'Cost at live Grand Exchange prices' : 'Items needed'">
          <i v-if="cost != null" class="gpb-dot gp-figure" aria-hidden="true" />{{ mats.totals.length }} {{ mats.totals.length === 1 ? (ironModeRef ? 'supply' : 'material') : (ironModeRef ? 'supplies' : 'materials') }}<span v-if="cost != null" class="gp-figure"> · {{ gpText(cost) }} gp</span>
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
        <p class="pd-sub">Tick a quest to do it first for free {{ goal.skill }} xp</p>
        <ul class="pd-quests is-pick">
          <li v-for="r in quests.rows" :key="r.id" :class="{ 'is-on': r.on, 'is-locked': r.locked }">
            <label class="pd-q">
              <input type="checkbox" :checked="r.on" :disabled="r.locked && !r.on" :aria-label="`Do ${r.name} first`" @change="toggleQuest(r.id)" />
              <span class="pd-q-main">
                <b>{{ r.name }}</b>
                <span class="stat-gain">+{{ formatNum(r.xp) }} xp</span>
                <small v-if="r.first" class="pd-q-first">needed first by a quest you ticked</small>
                <small v-else-if="r.locked">needs {{ r.need }} {{ goal.skill }}</small>
                <small v-else-if="r.needs">needs {{ r.needs }}</small>
                <small v-else-if="r.minutes">about {{ r.minutes }} min</small>
              </span>
            </label>
            <button v-if="!r.on" class="pd-q-done" type="button" title="Mark this quest as finished. It is saved and skipped everywhere in the planner." @click="markDone(r)">Already done</button>
          </li>
        </ul>
        <p v-if="plan.questList?.length" class="planner-hint">These quests are done first, which takes {{ formatHours(plan.questHours || 0) }} and skips part of the training below.</p>
        <p v-if="quests.done.length" class="pd-done">
          <span class="pd-done-label"><svg class="pd-tick" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Already finished</span>
          <button v-for="q in quests.done" :key="q.id" class="pd-done-chip" type="button" title="Not finished after all? Click to count it again." @click="setQuestDone(q.name, false)">{{ q.name }} ×</button>
        </p>
      </section>

      <section v-if="routeMethods.length" class="pd-sec">
        <h4 class="goal-section-title">Requirements <RouterLink class="pd-track" :to="{ name: 'quests' }">Tick off quests and diaries in the tracker</RouterLink></h4>
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
import { ironModeRef } from '@/composables/useAccountType'
import { computed, ref } from 'vue'
import PlannerMaterials from '@/components/planner/PlannerMaterials.vue'
import RequirementList from '@/components/planner/RequirementList.vue'
import { useRouteRequirements } from '@/composables/useRouteRequirements'
import { materialsForPlan } from '@/utils/plannerTools'
import { getQuest, questsForSkill, withPrerequisites, withoutQuest } from '@/data/quests'
import { track } from '@/utils/analytics'
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
const emit = defineEmits(['patch'])

const STATE_TEXT = { blocked: 'Requirement missing', unconfirmed: 'Needs confirming', planned: 'Your plan covers it', available: 'Requirements met' }
const open = ref(false)
const id = computed(() => props.goal.skill.toLowerCase())
const mats = computed(() => materialsForPlan(props.plan))
// Whether there is anything to list for the materials (a priced list, or a note that some items are not tracked).
const matsListed = computed(() => !!(mats.value.rows.length || mats.value.untracked.length || mats.value.supplies.length))
// A route with nothing to buy, no quests and no requirements has nothing to open.
// The quests that give free xp in this skill: what is in the plan, what could be added, and what is already finished.
const { doneQuestIds, setQuestDone } = useRequirements()
const quests = computed(() => {
  const skill = props.goal.skill
  const all = questsForSkill(skill)
  const done = new Set(doneQuestIds.value)
  const plannedList = props.plan.questList || []
  const planned = new Set(plannedList.map((q) => q.id))
  const remaining = Math.max((props.plan.targetXp || 0) - (props.plan.currentXp || 0), 0)
  const level = levelAtXp(props.plan.currentXp || 0, true)
  // The same few quests are always offered (the four biggest rewards you can still use), so ticking one never brings new ones in. The only rows
  // that can be added are the quests a ticked one needs first, which the plan has to do too: those say so.
  const offered = new Set(all.filter((x) => !done.has(x.id) && x.rewards[skill] <= remaining).slice(0, 4).map((x) => x.id))
  const rows = []
  if (remaining) {
    for (const quest of all.filter((x) => offered.has(x.id))) {
      const on = planned.has(quest.id)
      const need = quest.reqs[skill]
      rows.push({ id: quest.id, name: quest.name, xp: quest.rewards[skill], need, needs: quest.needs, minutes: quest.minutes, on, locked: !on && need != null && level < need, first: false })
    }
  }
  for (const q of plannedList) {
    if (offered.has(q.id)) continue
    const full = getQuest(q.id)
    rows.push({ id: q.id, name: q.name, xp: q.xp, needs: full?.needs || '', minutes: q.minutes || full?.minutes || 0, on: true, locked: false, first: true })
  }
  const position = new Map(all.map((q, i) => [q.id, i]))
  rows.sort((a, b) => (position.get(a.id) ?? 1e9) - (position.get(b.id) ?? 1e9))
  return { rows, options: rows.filter((r) => !r.on), done: all.filter((q) => done.has(q.id)) }
})
// Ticking a quest ticks what it needs first; unticking one unticks whatever needs it. The plan changes as you click.
function toggleQuest(id) {
  const current = props.goal.quests || []
  const on = !current.includes(id)
  track('planner_quest_toggled', { quest: id, skill: props.goal.skill, enabled: on, source: 'details' })
  emit('patch', { quests: on ? withPrerequisites([...current, id]) : withoutQuest(current, id) })
}
function markDone(row) {
  track('planner_quest_marked_done', { quest: row.id, skill: props.goal.skill, source: 'details' })
  setQuestDone(row.name, true)
}
const hasQuestInfo = computed(() => !!(quests.value.rows.length || quests.value.done.length))
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
