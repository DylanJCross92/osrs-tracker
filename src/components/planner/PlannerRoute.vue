<template>
  <ol v-if="segments.length" class="planner-route">
    <template v-for="(seg, k) in segments" :key="k">
      <li :class="['planner-step', `planner-step-${seg.kind}`, { 'planner-step-gap': !seg.method, editing: editing === k }]">
        <span class="planner-step-levels">{{ seg.startLevel }} → {{ seg.endLevel }}</span>
        <span class="planner-step-name">
          {{ seg.method ? seg.method.name : 'No catalog method' }}
          <i v-if="flag(seg)" class="route-req" :class="`is-${flag(seg).state}`" :title="flag(seg).text">{{ flag(seg).state === 'blocked' ? '⚠' : '?' }}</i>
          <em v-if="seg.kind === 'manual'">your pick for these levels</em>
          <em v-else-if="seg.kind === 'main'">your chosen method</em>
          <em v-else-if="seg.kind === 'prep'">to unlock it</em>
          <em v-else-if="seg.kind === 'post'">after it caps out</em>
          <button v-if="skill" class="route-change" type="button" :aria-expanded="editing === k" :aria-label="`Choose a method for levels ${seg.startLevel} to ${seg.endLevel}`" @click="toggle(k)">
            {{ editing === k ? 'Close' : seg.kind === 'manual' ? 'Change' : 'Choose method' }}
          </button>
        </span>
        <span class="planner-step-meta">
          {{ formatNum(seg.xp) }} xp<template v-if="seg.xpPerHour"> · ~{{ formatNum(seg.xpPerHour) }} xp/h</template>
        </span>
        <span class="planner-step-gp" :class="gpClass(seg.netGp)"><GpTip :method="seg.method && seg.method.gpPerHour !== undefined && seg.method.id ? seg.method : null" :hours="seg.hours">{{ seg.netGp == null ? 'Unpriced' : formatGp(seg.netGp) }}</GpTip></span>
        <span class="planner-step-hours">{{ seg.hours == null ? '-' : formatHours(seg.hours) }}</span>
      </li>
      <li v-if="skill && editing === k" class="planner-step-edit">
        <MethodPicker
          inline
          :model-value="seg.kind === 'manual' && seg.method?.id ? seg.method.id : '__recommended'"
          :methods="candidates(seg.startLevel, seg.endLevel)"
          :routes="[{ value: '__recommended', label: 'Recommended for these levels', sub: 'Let the planner pick' }]"
          :allow-custom="false"
          @update:model-value="(id) => choose(seg, id)"
        />
      </li>
    </template>
  </ol>
</template>

<script setup>
import { inject, ref } from 'vue'
import GpTip from '@/components/planner/GpTip.vue'
import MethodPicker from '@/components/planner/MethodPicker.vue'
import { methodAvailability, unmetText } from '@/utils/requirements'
import { plannerRequirementContext } from '@/composables/plannerRequirementContext'
import { methodsForSkill } from '@/data/trainingMethods'
import { formatNum, formatHours, formatGp } from '@/utils/planner'

// With a skill, every step can be changed: the player picks the method for that set of levels and the parent stores it.
const props = defineProps({
  segments: { type: Array, required: true },
  skill: { type: String, default: '' },
})
const emit = defineEmits(['set'])

const editing = ref(-1)
const toggle = (k) => (editing.value = editing.value === k ? -1 : k)

// Methods that work for every level from `from` up to (but not including) `to`.
const candidates = (from, to) => methodsForSkill(props.skill).filter((m) => m.minLevel <= from && (m.maxLevel == null || m.maxLevel >= to - 1))
function choose(seg, id) {
  emit('set', { fromLevel: seg.startLevel, toLevel: seg.endLevel, methodId: id === '__recommended' ? null : id })
  editing.value = -1
}

const reqCtx = inject(plannerRequirementContext, null)
// A marker next to a step whose method has a missing or unconfirmed requirement.
function flag(seg) {
  if (!seg.method?.requirements || !reqCtx) return null
  const a = methodAvailability(seg.method, reqCtx.value)
  if (a.state === 'blocked') return { state: 'blocked', text: `Missing requirement: ${unmetText(a)}` }
  if (a.state === 'unconfirmed') return { state: 'unconfirmed', text: 'Some requirements are not confirmed yet' }
  return null
}
const gpClass = (gp) => (gp == null ? '' : gp >= 0 ? 'planner-gain' : 'planner-cost')
</script>
