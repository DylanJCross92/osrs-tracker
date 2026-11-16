<template>
  <section id="plan-panel-route" class="card plan-section pr" role="tabpanel" aria-labelledby="plan-tab-route">
    <header class="pr-head">
      <div class="pr-title">
        <h2>Training route</h2>
        <span class="pr-count">{{ countText }}</span>
      </div>
      <div class="range-tabs pr-views" role="group" aria-label="How to order the route">
        <button type="button" :class="{ active: view === 'order' }" :aria-pressed="view === 'order'" @click="view = 'order'">Optimal training order</button>
        <button type="button" :class="{ active: view === 'grouped' }" :aria-pressed="view === 'grouped'" @click="view = 'grouped'">Grouped by skill</button>
      </div>
    </header>

    <!-- Filters: by what is done, and by skill -->
    <div v-if="steps.length" class="pr-filters">
      <div v-if="anyDone" class="pr-status range-tabs" role="group" aria-label="Show steps by status">
        <button v-for="f in STATUS_FILTERS" :key="f.key" type="button" :class="{ active: status === f.key }" :aria-pressed="status === f.key" @click="status = f.key">{{ f.label }}<i>{{ counts[f.key] }}</i></button>
      </div>
      <label v-if="skills.length > 1" class="pr-skill">
        <span>Skill</span>
        <select v-model="skill" aria-label="Filter the route by skill">
          <option value="">All skills</option>
          <option v-for="s in skills" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
    </div>

    <p v-if="!steps.length" class="planner-hint">Every goal is already reached, so there is nothing left to train.</p>
    <p v-else-if="!filtered.length" class="planner-hint">No steps match these filters.</p>

    <!-- A checklist, in the order the plan trains things -->
    <ol v-else-if="view === 'order'" class="pr-list pr-check">
      <li v-for="s in shownSteps" :key="s.id" class="pr-step" :class="[{ open: isOpen(s), done: s.done }, `cat-${categoryOf(s.skill)}`]">
        <PlannerRouteStep :step="s" :open="isOpen(s)" show-skill @toggle="toggle(s)" @open-goal="$emit('open-goal', s.goalIndex)" />
      </li>
    </ol>

    <!-- The same steps under each skill -->
    <div v-else class="pr-groups">
      <article v-for="g in shownGroups" :key="g.skill" class="pr-group" :class="`cat-${categoryOf(g.skill)}`">
        <header class="pr-group-head">
          <img :src="skillIconSrc(g.skill)" :alt="g.skill" width="26" height="26" />
          <b>{{ g.skill }}</b>
          <em>{{ g.startLevel }} → {{ g.endLevel }}</em>
          <span class="pr-group-totals">{{ formatHours(g.hours) }}<template v-if="g.netGp != null"> · <i :class="g.netGp >= 0 ? 'planner-gain' : 'planner-cost'">{{ formatGp(g.netGp) }}</i></template></span>
          <button class="btn-text" type="button" @click="$emit('open-goal', g.goalIndex)">Edit goal</button>
        </header>
        <ol class="pr-list pr-check">
          <li v-for="s in g.steps" :key="s.id" class="pr-step" :class="{ open: isOpen(s), done: s.done }">
            <PlannerRouteStep :step="s" :open="isOpen(s)" @toggle="toggle(s)" @open-goal="$emit('open-goal', s.goalIndex)" />
          </li>
        </ol>
      </article>
    </div>

    <div v-if="filtered.length > limit" class="pr-more">
      <button class="btn btn-ghost" type="button" :aria-expanded="full" @click="full = !full">{{ full ? `Show only the first ${limit}` : `View full route (${filtered.length - limit} more)` }}</button>
    </div>

    <p class="planner-hint pr-note">GP and time figures are rough estimates from approximate community rates, not guarantees. GP is net per hour of training, so it already nets out supplies and any loot.</p>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import PlannerRouteStep from '@/components/planner/PlannerRouteStep.vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatGp, formatHours } from '@/utils/planner'
import { groupBySkill, ROUTE_PREVIEW } from '@/utils/planSteps'
import { categoryOfSkill } from '@/utils/plannerTools'

const props = defineProps({
  // Every step in order, each with `done` (see withCompleted in utils/planSteps.js).
  steps: { type: Array, required: true },
  limit: { type: Number, default: ROUTE_PREVIEW },
})
defineEmits(['open-goal'])

const STATUS_FILTERS = [
  { key: 'todo', label: 'To do' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' },
]
const view = ref('order')
const full = ref(false)
const status = ref('todo')
const skill = ref('')
const openIds = ref(new Set())
const isOpen = (s) => openIds.value.has(s.id)
function toggle(s) {
  const next = new Set(openIds.value)
  if (next.has(s.id)) next.delete(s.id)
  else next.add(s.id)
  openIds.value = next
}
const categoryOf = categoryOfSkill

const anyDone = computed(() => props.steps.some((s) => s.done))
const skills = computed(() => [...new Set(props.steps.map((s) => s.skill))])
const counts = computed(() => ({ todo: props.steps.filter((s) => !s.done).length, done: props.steps.filter((s) => s.done).length, all: props.steps.length }))
// Without any finished step there is nothing to filter by status, so everything is shown. A skill that drops out of the plan clears its filter.
const effectiveStatus = computed(() => (anyDone.value ? status.value : 'all'))
// When nothing is left to do, the checklist shows everything (the finished steps) instead of an empty list.
watch(
  counts,
  (c) => {
    if (status.value === 'todo' && c.done > 0 && c.todo === 0) status.value = 'all'
  },
  { immediate: true },
)
watch(skills, (list) => {
  if (skill.value && !list.includes(skill.value)) skill.value = ''
})
const filtered = computed(() => props.steps.filter((s) => (effectiveStatus.value === 'all' || (effectiveStatus.value === 'done') === s.done) && (!skill.value || s.skill === skill.value)))
const shownSteps = computed(() => (full.value ? filtered.value : filtered.value.slice(0, props.limit)))
const shownGroups = computed(() => groupBySkill(shownSteps.value))
const countText = computed(() => {
  const n = filtered.value.length
  if (!props.steps.length) return ''
  return shownSteps.value.length === n ? `${n} step${n === 1 ? '' : 's'}` : `First ${shownSteps.value.length} of ${n} steps`
})
</script>
