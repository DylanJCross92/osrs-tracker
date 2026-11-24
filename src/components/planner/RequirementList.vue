<template>
  <ul class="req-list">
    <li v-for="item in items" :key="item.req.id" class="req" :class="`is-${item.status}`">
      <span class="req-icon" tabindex="0" role="img" :aria-label="`Why: ${reason(item.req)}`">
        {{ ICONS[item.status] }}
        <span class="req-tip" role="tooltip"><b>Why is this a requirement?</b>{{ reason(item.req) }}</span>
      </span>
      <span class="req-main">
        <span class="req-label">{{ item.req.label }} <small class="req-kind">{{ KINDS[item.req.kind] }}</small></span>
        <span class="req-state">{{ stateText(item) }}</span>
        <span v-if="item.req.quests?.length" class="req-quests">
          <span class="req-quests-lead">{{ item.req.covers ? 'Unlocked by' : 'Comes from' }}</span>
          <button v-for="qr in behind(item.req)" :key="qr.id" type="button" class="req-quest" :class="{ done: qr.done }" :aria-pressed="qr.done" :title="qr.done ? 'Marked done. Click to undo' : 'Click to mark this quest done'" @click="toggleQuest(qr)">
            <span aria-hidden="true">{{ qr.done ? '✓' : '○' }}</span> {{ qr.label }}<small v-if="qr.partial"> (started is enough)</small>
          </button>
        </span>
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
import { MET, UNMET, UNKNOWN, PLANNED, confirmationFor, questsBehind, requirementReason } from '@/utils/requirements'
import { useRequirements } from '@/composables/useRequirements'
import { plannerRequirementContext } from '@/composables/plannerRequirementContext'

const props = defineProps({ items: { type: Array, required: true }, methodName: { type: String, default: '' } })
const reason = (req) => requirementReason(req, props.methodName)

const ICONS = { [MET]: '✓', [UNMET]: '✗', [UNKNOWN]: '?', [PLANNED]: '↗', info: 'i' }
const KINDS = { skill: 'level', quest: 'quest', diary: 'diary', equipment: 'item', unlock: 'unlock', note: 'note' }

const { confirmations, setAnswer, setDiaryDone } = useRequirements()
const ctx = inject(plannerRequirementContext, null)

// The quests that give an item or unlock, each tickable here the same way as in the quest tracker (the answer is saved under the quest's own id).
const behind = (req) => questsBehind(req, confirmations.value)
function toggleQuest(qr) {
  setAnswer(qr.id, qr.done ? null : 'have')
}

const isConfirmable = (req) => req.kind !== 'skill' && req.kind !== 'note'
const answer = (req) => confirmationFor(req, confirmations.value)
function choose(req, value) {
  // Pressing the answer that is already chosen goes back to "not sure".
  const next = answer(req) === value ? null : value
  // A diary tier needs the ones below it, so "I have this" ticks them too (the same as in the tracker).
  if (req.kind === 'diary' && next !== 'missing') setDiaryDone(req.id, next === 'have')
  else setAnswer(req.id, next)
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
  if (status === MET) return answer(req) === 'have' ? 'You confirmed this' : 'Covered by quests you finished'
  if (status === UNMET) return "You said you don't have this"
  return 'Not confirmed. TickGains cannot see this from the hiscores'
}
</script>
