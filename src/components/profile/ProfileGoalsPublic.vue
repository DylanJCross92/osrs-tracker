<template>
  <section class="card pg">
    <header class="pg-head">
      <div>
        <h2>{{ isOwner ? 'Your public goals' : `${displayName}'s goals` }}</h2>
        <p class="pg-sub">{{ isOwner ? 'Goals you pick show on your profile with a progress bar that moves as you train.' : 'Progress updates as they train.' }}</p>
      </div>
    </header>

    <ul v-if="goals.length" class="pg-list">
      <li v-for="g in goals" :key="g.id" class="pg-goal" :class="{ 'is-done': g.reached, 'is-target': targetId === g.id }">
        <div class="pg-top">
          <img :src="skillIconSrc(g.skill)" alt="" width="26" height="26" />
          <b>{{ g.title }}</b>
          <span v-if="g.pinned" class="pg-pin" title="Pinned to the top of the profile">Pinned</span>
          <span v-if="g.reached" class="pg-done">Reached</span>
          <span class="pg-pct">{{ g.percent }}%</span>
        </div>
        <div class="level-progress-track"><div class="level-progress-fill" :style="{ width: `${g.percent}%` }" /></div>
        <p class="pg-meta">{{ g.reached ? 'Goal reached!' : `${formatXp(g.currentXp)} of ${formatXp(g.targetXp)} XP · ${formatXp(g.remainingXp)} to go` }}</p>
        <div class="pg-actions">
          <button class="btn btn-ghost" type="button" @click="$emit('share', g)">Share</button>
          <template v-if="isOwner">
            <button class="btn-text" type="button" @click="togglePin(g)">{{ g.pinned ? 'Unpin' : 'Pin to profile' }}</button>
            <button class="btn-text pg-del" type="button" @click="remove(g)">Remove</button>
          </template>
        </div>
      </li>
    </ul>
    <p v-else class="pg-empty">{{ isOwner ? 'No goals yet. Add one below.' : 'No public goals yet.' }}</p>

    <form v-if="isOwner" class="pg-form" novalidate @submit.prevent="add">
      <h3>Add a goal</h3>
      <div class="pg-row">
        <select v-model="form.skill" aria-label="Skill"><option v-for="s in SKILL_NAMES" :key="s" :value="s">{{ s }}</option></select>
        <select v-model="form.type" aria-label="Goal type"><option value="level">Level</option><option value="xp">XP</option></select>
        <input :value="form.target" type="text" inputmode="numeric" autocomplete="off" :maxlength="form.type === 'level' ? 3 : 9" :placeholder="form.type === 'level' ? 'Level, 2 to 126' : 'XP, up to 200M'" aria-label="Target" data-1p-ignore @input="onTarget" @keydown="onKey" />
        <button class="btn btn-primary" type="submit" :disabled="busy || !targetOk">{{ busy ? 'Adding…' : 'Add goal' }}</button>
      </div>
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <p v-else class="pg-hint">{{ form.type === 'level' ? 'A level from 2 to 126.' : 'An XP amount up to 200,000,000.' }}</p>
    </form>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ApiError } from '@/api/client'
import { goalsApi } from '@/api/goals'
import { SKILL_NAMES, formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { track } from '@/utils/analytics'

const props = defineProps({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  goals: { type: Array, required: true },
  isOwner: { type: Boolean, default: false },
  // A goal to point at (from a shared link).
  targetId: { type: Number, default: null },
})
const emit = defineEmits(['update', 'share'])

const form = reactive({ skill: 'Mining', type: 'level', target: 99 })
// The target box only takes digits and never goes past what a goal can be: a level from 2 to 126, or up to 200M XP.
const limits = computed(() => (form.type === 'level' ? { min: 2, max: 126 } : { min: 1, max: 200_000_000 }))
const targetOk = computed(() => Number.isInteger(form.target) && form.target >= limits.value.min && form.target <= limits.value.max)
function onTarget(e) {
  const digits = e.target.value.replace(/\D/g, '')
  const n = digits === '' ? null : Math.min(Number(digits), limits.value.max)
  form.target = n
  // Write back what was kept, so a pasted "12abc" or a too-big number is corrected on screen too.
  e.target.value = n === null ? '' : String(n)
}
// Letters, signs and decimal points never get in (keys that edit or move the cursor still work).
function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.key.length > 1) return
  if (!/^\d$/.test(e.key)) e.preventDefault()
}
watch(() => form.type, () => {
  if (form.target !== null) form.target = Math.min(form.target, limits.value.max)
})
const busy = ref(false)
const error = ref('')
const message = (err) => (err instanceof ApiError ? err.message : 'Something went wrong, please try again.')

async function add() {
  busy.value = true
  error.value = ''
  try {
    emit('update', (await goalsApi.add(props.username, { skill: form.skill, type: form.type, target: form.target })).goals)
    track('goal_added', { type: form.type })
  } catch (err) {
    error.value = message(err)
  } finally {
    busy.value = false
  }
}
async function togglePin(g) {
  try {
    emit('update', (await goalsApi.pin(props.username, g.id, !g.pinned)).goals)
  } catch (err) {
    error.value = message(err)
  }
}
async function remove(g) {
  if (!window.confirm(`Remove the goal "${g.title}"?`)) return
  try {
    emit('update', (await goalsApi.remove(props.username, g.id)).goals)
  } catch (err) {
    error.value = message(err)
  }
}
</script>
