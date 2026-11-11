<template>
  <div v-if="options.length || doneList.length" class="planner-quests">
    <div class="planner-quests-head">
      <b>★ Quest shortcuts</b>
      <span>Free {{ skill }} XP, no gp and no grind. Great for ironmen. Tick the quests you plan to do. Quests you have already finished are skipped automatically.</span>
    </div>
    <label v-for="o in options" :key="o.quest.id" class="planner-quest" :class="{ locked: o.locked }">
      <input type="checkbox" :value="o.quest.id" :checked="modelValue.includes(o.quest.id)" :disabled="o.locked" @change="toggle(o.quest.id)" />
      <span class="planner-quest-name">
        {{ o.quest.name }}
        <small v-if="o.locked">needs {{ o.lockText }}</small>
        <small v-else-if="o.quest.needs">needs {{ o.quest.needs }}</small>
      </span>
      <span class="planner-quest-xp stat-gain">+{{ formatNum(o.xp) }} xp<small v-if="o.levelsSkipped > 0"> · ~{{ o.levelsSkipped }} level{{ o.levelsSkipped === 1 ? '' : 's' }} skipped</small></span>
      <span class="planner-quest-hours">{{ !o.locked && o.hoursSaved > 0.05 ? `saves ~${formatHours(o.hoursSaved)}` : '' }}</span>
      <button class="planner-quest-done" type="button" title="Mark this quest as finished. It is saved and skipped everywhere in the planner." @click.prevent="markDone(o.quest)">Already done</button>
    </label>
    <p v-if="doneList.length" class="planner-quests-done">
      <span aria-hidden="true">✓</span> Already finished, so not counted:
      <button v-for="q in doneList" :key="q.id" class="planner-quest-undo" type="button" title="Not finished after all? Click to count it again." @click="setQuestDone(q.name, false)">{{ q.name }} ×</button>
    </p>
    <small class="planner-quests-note">
      Rewards are the fixed XP listed on the OSRS Wiki, so check each quest's full requirements first.
      <RouterLink v-if="loggedIn" :to="{ name: 'account', hash: '#quests' }">Open your quest tracker</RouterLink>
      <RouterLink v-else :to="{ name: 'login', query: { next: '/account' } }">Log in to save your finished quests to your account</RouterLink>
    </small>
  </div>
</template>

<script setup>
import { track } from '@/utils/analytics'
import { computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRequirements } from '@/composables/useRequirements'
import { questsForSkill } from '@/data/quests'
import { AUTO_FAST, planGoal, levelAtXp, formatNum, formatHours } from '@/utils/planner'

const props = defineProps({
  skill: { type: String, required: true },
  currentXp: { type: Number, default: 0 },
  targetXp: { type: Number, default: 0 },
  modelValue: { type: Array, default: () => [] },
  methodId: { type: String, default: AUTO_FAST },
  gpValue: { type: Number, default: undefined },
})
const emit = defineEmits(['update:modelValue'])
const { loggedIn } = useAuth()
const { doneQuestIds, setQuestDone } = useRequirements()

// Finished quests are not offered (they cannot give their reward again); they are listed so they can be undone.
const doneList = computed(() => questsForSkill(props.skill).filter((q) => doneQuestIds.value.includes(q.id)))

const options = computed(() => {
  const remaining = props.targetXp - props.currentXp
  if (remaining <= 0) return []
  const level = levelAtXp(props.currentXp, true)
  const base = planGoal({ skill: props.skill, currentXp: props.currentXp, targetXp: props.targetXp, methodId: props.methodId, gpValuePerHour: props.gpValue, quests: [] })
  return questsForSkill(props.skill)
    .filter((quest) => !doneQuestIds.value.includes(quest.id))
    .filter((quest) => quest.rewards[props.skill] <= remaining || props.modelValue.includes(quest.id))
    .slice(0, 5)
    .map((quest) => {
      const xp = quest.rewards[props.skill]
      const need = quest.reqs[props.skill]
      const withQuest = planGoal({ skill: props.skill, currentXp: props.currentXp, targetXp: props.targetXp, methodId: props.methodId, gpValuePerHour: props.gpValue, quests: [quest.id] })
      return {
        quest,
        xp,
        locked: need != null && level < need,
        lockText: `${need} ${props.skill}`,
        levelsSkipped: levelAtXp(props.currentXp + xp, true) - level,
        hoursSaved: (base.hours || 0) - (withQuest.hours || 0),
      }
    })
})

function markDone(quest) {
  track('planner_quest_marked_done', { quest: quest.id, skill: props.skill })
  // No longer something to do, so drop it from this goal's chosen shortcuts too.
  if (props.modelValue.includes(quest.id)) emit('update:modelValue', props.modelValue.filter((x) => x !== quest.id))
  setQuestDone(quest.name, true)
}

function toggle(id) {
  track('planner_quest_toggled', { quest: id, skill: props.skill, enabled: !props.modelValue.includes(id) })
  const next = props.modelValue.includes(id) ? props.modelValue.filter((x) => x !== id) : [...props.modelValue, id]
  emit('update:modelValue', next)
}
</script>
