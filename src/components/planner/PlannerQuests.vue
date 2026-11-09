<template>
  <div v-if="options.length" class="planner-quests">
    <div class="planner-quests-head">
      <b>★ Quest shortcuts</b>
      <span>Free {{ skill }} XP, no gp and no grind. Great for ironmen.</span>
    </div>
    <label v-for="o in options" :key="o.quest.id" class="planner-quest" :class="{ locked: o.locked }">
      <input type="checkbox" :value="o.quest.id" :checked="modelValue.includes(o.quest.id)" :disabled="o.locked" @change="toggle(o.quest.id)" />
      <span class="planner-quest-name">
        {{ o.quest.name }}
        <small v-if="o.locked">needs {{ o.lockText }}</small>
        <small v-else-if="o.quest.needs">needs {{ o.quest.needs }}</small>
      </span>
      <span class="planner-quest-xp stat-gain">+{{ formatNum(o.xp) }} xp</span>
      <span class="planner-quest-hours">{{ !o.locked && o.hoursSaved > 0.05 ? `saves ~${formatHours(o.hoursSaved)}` : '' }}</span>
    </label>
    <small class="planner-quests-note">Skip any you have already finished. Rewards are the fixed XP listed on the OSRS Wiki, so check each quest's full requirements first.</small>
  </div>
</template>

<script setup>
import { track } from '@/utils/analytics'
import { computed } from 'vue'
import { questsForSkill } from '@/data/quests'
import { AUTO_FAST, planGoal, levelAtXp, formatNum, formatHours } from '@/utils/planner'

const props = defineProps({
  skill: { type: String, required: true },
  currentXp: { type: Number, default: 0 },
  targetXp: { type: Number, default: 0 },
  modelValue: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])

const options = computed(() => {
  const remaining = props.targetXp - props.currentXp
  if (remaining <= 0) return []
  const level = levelAtXp(props.currentXp, true)
  const base = planGoal({ skill: props.skill, currentXp: props.currentXp, targetXp: props.targetXp, methodId: AUTO_FAST, quests: [] })
  return questsForSkill(props.skill)
    .filter((quest) => quest.rewards[props.skill] <= remaining || props.modelValue.includes(quest.id))
    .slice(0, 5)
    .map((quest) => {
      const xp = quest.rewards[props.skill]
      const need = quest.reqs[props.skill]
      const withQuest = planGoal({ skill: props.skill, currentXp: props.currentXp, targetXp: props.targetXp, methodId: AUTO_FAST, quests: [quest.id] })
      return {
        quest,
        xp,
        locked: need != null && level < need,
        lockText: `${need} ${props.skill}`,
        hoursSaved: (base.hours || 0) - (withQuest.hours || 0),
      }
    })
})

function toggle(id) {
  track('planner_quest_toggled', { quest: id, skill: props.skill, enabled: !props.modelValue.includes(id) })
  const next = props.modelValue.includes(id) ? props.modelValue.filter((x) => x !== id) : [...props.modelValue, id]
  emit('update:modelValue', next)
}
</script>
