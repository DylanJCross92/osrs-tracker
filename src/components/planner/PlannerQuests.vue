<template>
  <div v-if="options.length || doneList.length" class="planner-quests">
    <div class="planner-quests-head">
      <b>★ Quest shortcuts</b>
      <span>Free {{ skill }} XP, no gp and no grind. Great for ironmen. Tick the quests you plan to do. Quests you have already finished are skipped automatically.</span>
    </div>
    <label v-for="o in options" :key="o.quest.id" class="planner-quest" :class="{ locked: o.locked }">
      <input type="checkbox" :value="o.quest.id" :checked="modelValue.includes(o.quest.id)" :disabled="o.locked" @change="toggle(o.quest.id)" />
      <span class="planner-quest-name">
        {{ o.quest.name }}<NewTag :id="o.quest.id" /><i v-if="o.quest.suggest" class="planner-quest-tag">Short</i>
        <small v-if="o.locked">needs {{ o.lockText }}</small>
        <small v-else-if="o.quest.needs">needs {{ o.quest.needs }}</small>
        <small v-if="o.minutes">takes about {{ o.minutes }} min<template v-if="o.chainNames.length"> with {{ o.chainNames.join(' and ') }}</template></small>
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
      <RouterLink :to="{ name: 'quests' }">Open your quest and diary tracker</RouterLink>
      <template v-if="!loggedIn"> <RouterLink :to="{ name: 'signup', query: { next: '/quests' } }">Create a free account</RouterLink> to keep them on every device.</template>
    </small>
  </div>
</template>

<script setup>
import { track } from '@/utils/analytics'
import { computed } from 'vue'
import NewTag from '@/components/NewTag.vue'
import { useAuth } from '@/composables/useAuth'
import { useRequirements } from '@/composables/useRequirements'
import { getQuest, questChain, questsForSkill, withPrerequisites, withoutQuest } from '@/data/quests'
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

const candidates = computed(() => {
  const remaining = props.targetXp - props.currentXp
  if (remaining <= 0) return []
  const level = levelAtXp(props.currentXp, true)
  const base = planGoal({ skill: props.skill, currentXp: props.currentXp, targetXp: props.targetXp, methodId: props.methodId, gpValuePerHour: props.gpValue, quests: [] })
  const done = new Set(doneQuestIds.value)
  return questsForSkill(props.skill)
    .filter((quest) => !done.has(quest.id))
    .filter((quest) => quest.rewards[props.skill] <= remaining || props.modelValue.includes(quest.id))
    // The biggest rewards are looked at (there are many quests now), then the ones you can do and that save the most come first.
    .slice(0, 14)
    .map((quest) => {
      const xp = quest.rewards[props.skill]
      const need = quest.reqs[props.skill]
      // What has to be done first (and is not finished yet), its xp, and its time, so the saving is for the whole set.
      const before = questChain(quest.id).slice(0, -1).filter((id) => !done.has(id))
      const chain = [...before, quest.id]
      const beforeXp = before.reduce((sum, id) => sum + (getQuest(id).rewards[props.skill] || 0), 0)
      const withQuest = planGoal({ skill: props.skill, currentXp: props.currentXp, targetXp: props.targetXp, methodId: props.methodId, gpValuePerHour: props.gpValue, quests: chain })
      return {
        quest,
        xp,
        locked: need != null && levelAtXp(props.currentXp + beforeXp, true) < need,
        lockText: `${need} ${props.skill}`,
        levelsSkipped: levelAtXp(props.currentXp + xp + beforeXp, true) - level,
        hoursSaved: (base.hours || 0) - (withQuest.hours || 0) + (withQuest.questHours || 0),
        minutes: chain.reduce((sum, id) => sum + (getQuest(id).minutes || 0), 0),
        chainNames: before.map((id) => getQuest(id).name),
      }
    })
})

// Where each quest sits in the list. It is worked out the first time a quest shows (the ones you can do and that save the most first) and then
// kept, so ticking a quest, which changes the start xp and what the others save, never moves the list under your finger. It is worked out again
// when the goal itself changes (another skill, target, method, or a quest marked finished).
const ranks = new Map()
let rankKey = ''
const byValue = (a, b) => Number(a.locked) - Number(b.locked) || b.hoursSaved - a.hoursSaved
const options = computed(() => {
  const list = candidates.value
  const key = [props.skill, props.methodId, props.targetXp, doneQuestIds.value.length].join('|')
  if (key !== rankKey) {
    ranks.clear()
    rankKey = key
  }
  for (const o of [...list].sort(byValue)) if (!ranks.has(o.quest.id)) ranks.set(o.quest.id, ranks.size)
  const ordered = [...list].sort((a, b) => ranks.get(a.quest.id) - ranks.get(b.quest.id))
  // The first six, and any quest you have ticked that is not among them, each where it belongs.
  const top = new Set(ordered.slice(0, 6).map((o) => o.quest.id))
  return ordered.filter((o) => top.has(o.quest.id) || props.modelValue.includes(o.quest.id))
})

function markDone(quest) {
  track('planner_quest_marked_done', { quest: quest.id, skill: props.skill })
  // No longer something to do, so drop it from this goal's chosen shortcuts too.
  if (props.modelValue.includes(quest.id)) emit('update:modelValue', props.modelValue.filter((x) => x !== quest.id))
  setQuestDone(quest.name, true)
}

// Ticking a quest ticks what it needs first; unticking one unticks whatever needs it.
function toggle(id) {
  const on = !props.modelValue.includes(id)
  track('planner_quest_toggled', { quest: id, skill: props.skill, enabled: on })
  emit('update:modelValue', on ? withPrerequisites([...props.modelValue, id]) : withoutQuest(props.modelValue, id))
}
</script>
