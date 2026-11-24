<template>
  <div class="modal-overlay agm-overlay" @click.self="$emit('close')" @keydown.esc="$emit('close')">
    <div class="modal-card add-goal-modal agm" role="dialog" aria-modal="true" aria-label="Add skill goal">
      <div class="share-modal-header">
        <h2>Add skill goal</h2>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <!-- 1. What to train, and between which levels -->
      <div class="agm-top">
        <label class="agm-skill">
          <span>Skill</span>
          <div class="planner-skill-select">
            <span class="planner-skill-icon"><img :src="skillIconSrc(form.skill)" :alt="form.skill" width="24" height="24" /></span>
            <select v-model="form.skill" @change="onSkillChange">
              <option v-for="s in SKILL_NAMES" :key="s" :value="s" :disabled="taken.has(s)">{{ s }}{{ taken.has(s) ? ' (in plan)' : '' }}</option>
            </select>
          </div>
        </label>
        <template v-if="!showXp">
          <label>
            <span>From level</span>
            <NumberInput v-model="currentLevelModel" :min="1" :max="126" />
          </label>
          <label>
            <span>To level</span>
            <NumberInput v-model="form.targetLevel" :min="1" :max="126" @update:model-value="syncTarget" />
          </label>
        </template>
        <template v-else>
          <label>
            <span>Current XP</span>
            <NumberInput v-model="form.currentXp" :min="0" :max="MAX_XP" />
          </label>
          <label>
            <span>Target XP</span>
            <NumberInput v-model="form.targetXp" :min="0" :max="MAX_XP" />
          </label>
        </template>
      </div>
      <div class="agm-quick">
        <template v-if="!showXp && chips.length">
          <span>Aim for</span>
          <button v-for="l in chips" :key="l" type="button" :class="{ active: form.targetLevel === l }" @click="setTarget(l)">{{ l }}</button>
        </template>
        <button class="btn-text agm-xp-toggle" type="button" @click="toggleXp">{{ showXp ? 'Use levels instead' : 'Use XP instead' }}</button>
      </div>
      <p v-if="player" class="planner-hint agm-hint">Starting stats come from {{ player.displayName }}'s latest snapshot. You can edit them.</p>

      <!-- 2. How to get there: the best method for each set of levels, changeable one by one -->
      <section class="agm-route" aria-label="Your route">
        <div class="agm-route-head">
          <h3>Your route</h3>
          <AccountTypeToggle v-model="draftMembers" />
          <div class="range-tabs agm-strategy" role="group" aria-label="Training strategy">
            <button v-for="s in STRATEGIES" :key="s" type="button" :class="{ active: strategy === s }" :aria-pressed="strategy === s" :title="STRATEGY_HINTS[s]" @click="setStrategy(s)">{{ STRATEGY_LABELS[s] }}</button>
          </div>
        </div>

        <p v-if="!draftMembers && !hasFreeRoute" class="acct-note" role="status">We have no free-to-play route for {{ form.skill }} yet, so it is worked out with members methods.</p>
        <template v-if="preview">
          <p class="agm-route-help">The best method for each set of levels, {{ STRATEGY_LABELS[strategy].toLowerCase() }}. Press <b>Choose method</b> on any step to see the options and pick your own.</p>
          <PlannerRoute :segments="preview.segments" :quests="preview.questList" :skill="form.skill" @set="setRange" />
          <p v-if="preview.warning" class="planner-warning">⚠ {{ preview.warning }}</p>
          <p v-if="form.overrides.length" class="agm-reset">
            You chose the method for {{ form.overrides.length }} set{{ form.overrides.length === 1 ? '' : 's' }} of levels.
            <button class="btn-text" type="button" @click="form.overrides = []">Back to recommended</button>
          </p>
          <div class="agm-total" role="status">
            <span><b>{{ formatNum(preview.remainingXp) }}</b> xp</span>
            <span><b>{{ formatHours(preview.hours) }}</b></span>
            <span v-if="preview.netGp != null" :class="preview.netGp >= 0 ? 'planner-gain' : 'planner-cost'"><b>{{ formatGp(preview.netGp) }}</b></span>
          </div>
        </template>
        <p v-else class="agm-route-help">Pick a target above your current level to see the route.</p>
      </section>

      <p v-if="error" class="planner-error">{{ error }}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" @click="$emit('close')">Cancel</button>
        <button class="btn btn-primary" type="button" @click="submit">Add to plan</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import AccountTypeToggle from '@/components/AccountTypeToggle.vue'
import { applyMembership, freeMethodIds } from '@/utils/membership'
import { computed, reactive, ref } from 'vue'
import NumberInput from '@/components/NumberInput.vue'
import PlannerRoute from '@/components/planner/PlannerRoute.vue'
import { SKILL_NAMES, skillIconSrc } from '@/utils/osrsSkills'
import { MAX_XP, xpAtLevel, levelAtXp, planGoal, suggestedQuests, setOverrideRange, AUTO_FAST, AUTO_CHEAP, AUTO_BALANCED, GLOBAL_STRATEGIES, GLOBAL_STRATEGY, formatNum, formatHours, formatGp } from '@/utils/planner'
import { STRATEGY_LABELS, resolveGoal } from '@/utils/plannerTools'

const props = defineProps({
  player: { type: Object, default: null },
  existingSkills: { type: Array, default: () => [] },
  globalStrategy: { type: String, required: true },
  gpValue: { type: Number, required: true },
  // A skill to start on (picked from the build-your-own panel).
  initialSkill: { type: String, default: '' },
  // Methods the planner skips and quests already finished, so the route here matches the one the goal will get.
  blockedMethodIds: { type: Array, default: () => [] },
  doneQuestIds: { type: Array, default: () => [] },
  // Free-to-play or members, as the plan has it now (changed here, it applies to the whole plan when the goal is added).
  members: { type: Boolean, default: true },
})
const emit = defineEmits(['add', 'close'])

const STRATEGIES = GLOBAL_STRATEGIES
const STRATEGY_HINTS = {
  [AUTO_FAST]: 'Minimises training time, whatever it costs.',
  [AUTO_CHEAP]: 'Minimises net gp spent, even if it is slower.',
  [AUTO_BALANCED]: 'A middle ground between speed and cost.',
}

const draftMembers = ref(props.members)
const hasFreeRoute = computed(() => freeMethodIds(form.skill).length > 0)

const taken = computed(() => new Set(props.existingSkills))
const firstFree = SKILL_NAMES.find((s) => !props.existingSkills.includes(s)) || SKILL_NAMES[0]

const startSkill = SKILL_NAMES.includes(props.initialSkill) && !props.existingSkills.includes(props.initialSkill) ? props.initialSkill : firstFree
// methodId stays "follow the global strategy" until a different strategy is picked here.
const form = reactive({ skill: startSkill, currentXp: 0, targetMode: 'level', targetLevel: 99, targetXp: xpAtLevel(99), methodId: GLOBAL_STRATEGY, overrides: [] })
const error = ref('')
const showXp = ref(false)

const strategy = computed(() => (form.methodId === GLOBAL_STRATEGY ? props.globalStrategy : form.methodId))
function setStrategy(s) {
  form.methodId = s === props.globalStrategy ? GLOBAL_STRATEGY : s
}

const playerXp = (skill) => props.player?.latest?.skills?.[skill]?.xp ?? null
const currentLevel = computed(() => levelAtXp(form.currentXp || 0, true))
const currentLevelModel = computed({
  get: () => currentLevel.value,
  set: (v) => {
    if (v != null) form.currentXp = xpAtLevel(Math.min(Math.max(v, 1), 126))
  },
})
const targetXp = computed(() => (form.targetMode === 'level' ? xpAtLevel(form.targetLevel || 1) : Math.min(Math.floor(form.targetXp || 0), MAX_XP)))
// Quick targets above where the player is now.
const chips = computed(() => [70, 80, 90, 99].filter((l) => l > currentLevel.value))

function setTarget(level) {
  form.targetMode = 'level'
  form.targetLevel = level
  syncTarget()
}
function toggleXp() {
  showXp.value = !showXp.value
  if (showXp.value) {
    syncTarget()
    form.targetMode = 'xp'
  } else {
    form.targetLevel = Math.min(Math.max(levelAtXp(form.targetXp || 0, true), 1), 126)
    form.targetMode = 'level'
    syncTarget()
  }
}

// Fill the starting stats from the selected player (or a sane default) and aim at 99 or the next level.
function onSkillChange() {
  form.currentXp = playerXp(form.skill) ?? (form.skill === 'Hitpoints' ? xpAtLevel(10) : 0)
  form.targetLevel = currentLevel.value < 99 ? 99 : Math.min(currentLevel.value + 1, 126)
  // Methods differ from skill to skill, so choices made for the last skill do not carry over.
  form.overrides = []
  syncTarget()
  error.value = ''
}
function syncTarget() {
  if (form.targetMode === 'level') form.targetXp = xpAtLevel(form.targetLevel || 1)
}
onSkillChange()

function setRange({ fromLevel, toLevel, methodId }) {
  form.overrides = setOverrideRange(form.overrides, fromLevel, toLevel, methodId)
}

// The goal as the planner would run it, plus the short XP quests that pay off for it (or that a method on its route needs).
const baseGoal = computed(() => {
  const cur = Math.min(Math.max(Math.floor(form.currentXp || 0), 0), MAX_XP)
  if (targetXp.value <= cur) return null
  const id = strategy.value
  const goal = resolveGoal({ skill: form.skill, currentXp: cur, targetXp: targetXp.value, methodId: id, quests: [], overrides: form.overrides, blockedMethodIds: props.blockedMethodIds, doneQuestIds: props.doneQuestIds }, id, props.gpValue)
  return applyMembership([goal], draftMembers.value)[0]
})
const suggested = computed(() => (baseGoal.value ? suggestedQuests(baseGoal.value) : []))
const preview = computed(() => (baseGoal.value ? planGoal({ ...baseGoal.value, quests: suggested.value }) : null))

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
  const goal = { skill: form.skill, currentXp, targetXp: target, methodId: form.methodId, customXpPerHour: 0, quests: [...suggested.value] }
  if (form.overrides.length) goal.overrides = form.overrides.map((o) => ({ ...o }))
  emit('add', applyMembership([goal], draftMembers.value)[0], draftMembers.value)
}
</script>
