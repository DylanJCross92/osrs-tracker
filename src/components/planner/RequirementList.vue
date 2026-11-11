<template>
  <ul class="req-list">
    <li v-for="item in items" :key="item.req.id" class="req" :class="`is-${item.status}`">
      <span class="req-icon" aria-hidden="true">{{ ICONS[item.status] }}</span>
      <span class="req-main">
        <span class="req-label">{{ item.req.label }} <small class="req-kind">{{ KINDS[item.req.kind] }}</small></span>
        <span class="req-state">{{ stateText(item) }}</span>
      </span>
      <span v-if="isConfirmable(item.req)" class="req-actions" role="group" :aria-label="`Do you have ${item.req.label}?`">
        <button type="button" :class="{ on: answer(item.req) === 'have' }" :aria-pressed="answer(item.req) === 'have'" @click="choose(item.req, 'have')">I have this</button>
        <button type="button" :class="{ on: answer(item.req) === 'missing' }" :aria-pressed="answer(item.req) === 'missing'" @click="choose(item.req, 'missing')">I don't</button>
      </span>
    </li>
  </ul>
</template>

<script setup>
import { inject } from 'vue'
import { MET, UNMET, UNKNOWN, PLANNED, confirmationFor } from '@/utils/requirements'
import { useRequirements } from '@/composables/useRequirements'
import { plannerRequirementContext } from '@/composables/plannerRequirementContext'

defineProps({ items: { type: Array, required: true } })

const ICONS = { [MET]: '✓', [UNMET]: '✗', [UNKNOWN]: '?', [PLANNED]: '↗', info: 'i' }
const KINDS = { skill: 'level', quest: 'quest', diary: 'diary', equipment: 'item', unlock: 'unlock', note: 'note' }

const { confirmations, setAnswer } = useRequirements()
const ctx = inject(plannerRequirementContext, null)

const isConfirmable = (req) => req.kind !== 'skill' && req.kind !== 'note'
const answer = (req) => confirmationFor(req, confirmations.value)
function choose(req, value) {
  // Pressing the answer that is already chosen goes back to "not sure".
  setAnswer(req.id, answer(req) === value ? null : value)
}
function stateText(item) {
  const { req, status } = item
  if (req.kind === 'note') return 'Recommended'
  if (req.kind === 'skill') {
    const level = ctx?.value?.levels?.[req.skill]
    if (status === MET) return `You are level ${level}`
    if (status === PLANNED) return `You are level ${level}; your plan trains it`
    if (status === UNMET) return `You are level ${level}. Not met yet`
    return 'Load a player to check this'
  }
  if (status === MET) return answer(req) === 'have' ? 'You confirmed this' : 'Covered by a quest you completed'
  if (status === UNMET) return "You said you don't have this"
  return 'Not confirmed. TickGains cannot see this from the hiscores'
}
</script>
