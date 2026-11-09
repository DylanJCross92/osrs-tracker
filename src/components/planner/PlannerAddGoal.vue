<template>
  <div class="modal-overlay" @click.self="$emit('close')" @keydown.esc="$emit('close')">
    <div class="modal-card add-goal-modal" role="dialog" aria-modal="true" aria-label="Add skill goal">
      <div class="share-modal-header">
        <h2>Add skill goal</h2>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <div class="planner-form add-goal-form">
        <label>
          <span>Skill</span>
          <div class="planner-skill-select">
            <span class="planner-skill-icon"><img :src="skillIconSrc(form.skill)" :alt="form.skill" width="24" height="24" /></span>
            <select v-model="form.skill" @change="onSkillChange">
              <option v-for="s in SKILL_NAMES" :key="s" :value="s" :disabled="taken.has(s)">{{ s }}{{ taken.has(s) ? ' (in plan)' : '' }}</option>
            </select>
          </div>
        </label>
        <label>
          <span>Current level</span>
          <NumberInput v-model="currentLevelModel" :min="1" :max="126" />
        </label>
        <label>
          <span>Current XP</span>
          <NumberInput v-model="form.currentXp" :min="0" :max="MAX_XP" />
        </label>
        <label>
          <span>Goal</span>
          <select v-model="form.targetMode" @change="syncTarget">
            <option value="level">Target level</option>
            <option value="xp">Target XP</option>
            <option value="max">200M XP</option>
          </select>
        </label>
        <label v-if="form.targetMode === 'level'">
          <span>Target level</span>
          <NumberInput v-model="form.targetLevel" :min="1" :max="126" />
        </label>
        <label v-else-if="form.targetMode === 'xp'">
          <span>Target XP</span>
          <NumberInput v-model="form.targetXp" :min="0" :max="MAX_XP" />
        </label>
        <label v-else><span>Target XP</span><input type="text" :value="formatNum(MAX_XP)" disabled /></label>
        <label class="add-goal-strategy">
          <span>Training strategy</span>
          <select v-model="form.methodId">
            <option :value="GLOBAL_STRATEGY">Follow global strategy ({{ STRATEGY_LABELS[globalStrategy] }})</option>
            <option :value="AUTO_FAST">Fastest</option>
            <option :value="AUTO_CHEAP">Cheapest</option>
            <option :value="AUTO_BALANCED">Balanced</option>
          </select>
        </label>
      </div>
      <p v-if="player" class="planner-hint">Starting stats come from {{ player.displayName }}'s latest TickGains snapshot. You can edit them.</p>

      <div v-if="preview" class="planner-preview-head add-goal-preview">
        <b>Preview</b>
        <span>{{ formatNum(preview.remainingXp) }} xp</span>
        <span>{{ formatHours(preview.hours) }}</span>
        <span v-if="preview.netGp != null" :class="preview.netGp >= 0 ? 'planner-gain' : 'planner-cost'">{{ formatGp(preview.netGp) }}</span>
      </div>
      <p v-if="error" class="planner-error">{{ error }}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" @click="$emit('close')">Cancel</button>
        <button class="btn btn-primary" type="button" @click="submit">Add to plan</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import NumberInput from '@/components/NumberInput.vue'
import { SKILL_NAMES, skillIconSrc } from '@/utils/osrsSkills'
import { MAX_XP, xpAtLevel, levelAtXp, planGoal, AUTO_FAST, AUTO_CHEAP, AUTO_BALANCED, GLOBAL_STRATEGY, formatNum, formatHours, formatGp } from '@/utils/planner'
import { STRATEGY_LABELS, resolveGoal } from '@/utils/plannerTools'

const props = defineProps({
  player: { type: Object, default: null },
  existingSkills: { type: Array, default: () => [] },
  globalStrategy: { type: String, required: true },
  gpValue: { type: Number, required: true },
})
const emit = defineEmits(['add', 'close'])

const taken = computed(() => new Set(props.existingSkills))
const firstFree = SKILL_NAMES.find((s) => !props.existingSkills.includes(s)) || SKILL_NAMES[0]

const form = reactive({ skill: firstFree, currentXp: 0, targetMode: 'level', targetLevel: 99, targetXp: xpAtLevel(99), methodId: GLOBAL_STRATEGY })
const error = ref('')

const playerXp = (skill) => props.player?.latest?.skills?.[skill]?.xp ?? null
const currentLevel = computed(() => levelAtXp(form.currentXp || 0, true))
const currentLevelModel = computed({
  get: () => currentLevel.value,
  set: (v) => {
    if (v != null) form.currentXp = xpAtLevel(Math.min(Math.max(v, 1), 126))
  },
})
const targetXp = computed(() => {
  if (form.targetMode === 'max') return MAX_XP
  if (form.targetMode === 'level') return xpAtLevel(form.targetLevel || 1)
  return Math.min(Math.floor(form.targetXp || 0), MAX_XP)
})

// Fill the starting stats from the selected player (or a sane default) and aim at 99 or the next level.
function onSkillChange() {
  form.currentXp = playerXp(form.skill) ?? (form.skill === 'Hitpoints' ? xpAtLevel(10) : 0)
  form.targetLevel = currentLevel.value < 99 ? 99 : Math.min(currentLevel.value + 1, 126)
  syncTarget()
  error.value = ''
}
function syncTarget() {
  if (form.targetMode === 'level') form.targetXp = xpAtLevel(form.targetLevel || 1)
  else if (form.targetMode === 'max') form.targetXp = MAX_XP
}
onSkillChange()

const preview = computed(() => {
  const cur = Math.min(Math.max(Math.floor(form.currentXp || 0), 0), MAX_XP)
  if (targetXp.value <= cur) return null
  const id = form.methodId === GLOBAL_STRATEGY ? props.globalStrategy : form.methodId
  return planGoal(resolveGoal({ skill: form.skill, currentXp: cur, targetXp: targetXp.value, methodId: id, quests: [] }, id, props.gpValue))
})

function submit() {
  error.value = ''
  syncTarget()
  if (taken.value.has(form.skill)) {
    error.value = `${form.skill} is already in your plan. Edit that goal instead.`
    return
  }
  const currentXp = Math.min(Math.max(Math.floor(form.currentXp || 0), 0), MAX_XP)
  const target = Math.min(Math.floor(targetXp.value || 0), MAX_XP)
  if (form.targetMode === 'level' && !(form.targetLevel >= 1 && form.targetLevel <= 126)) {
    error.value = 'Target level must be between 1 and 126.'
    return
  }
  if (currentXp >= MAX_XP) {
    error.value = 'You already have 200M XP in this skill.'
    return
  }
  if (target <= currentXp) {
    error.value = 'Your target has to be higher than your current XP.'
    return
  }
  emit('add', { skill: form.skill, currentXp, targetXp: target, methodId: form.methodId, customXpPerHour: 0, quests: [] })
}
</script>
