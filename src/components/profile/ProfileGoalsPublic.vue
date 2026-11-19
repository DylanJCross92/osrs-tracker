<template>
  <section class="card pg">
    <header class="pg-head">
      <div>
        <h2>{{ isOwner ? 'Your goal' : `${displayName}'s goal` }}</h2>
        <p v-if="isOwner && !plan && !otherGoals.length" class="pg-sub pg-howto">Open the planner, open your plan's <b>Plan settings</b> and turn on <b>Show this plan on my profile</b>. Its progress then appears here, in your profile header and on your dashboard.</p>
        <p v-else class="pg-sub">{{ isOwner ? 'The plan you show on your profile, with progress that moves as you train.' : 'Progress updates as they train.' }}</p>
      </div>
    </header>

    <!-- The plan on the profile: the whole plan is the goal -->
    <div v-if="plan" class="pg-plan-card">
      <div class="pg-plan-top">
        <b class="pg-plan-name">{{ plan.name }}</b>
        <span class="pg-pct">{{ plan.percent }}%</span>
      </div>
      <div class="level-progress-track"><div class="level-progress-fill" :style="{ width: `${plan.percent}%` }" /></div>
      <p class="pg-meta">{{ plan.reached }} of {{ plan.count }} {{ plan.count === 1 ? 'skill' : 'skills' }} reached</p>
      <ul class="pg-list">
        <li v-for="g in planGoals" :key="g.id" class="pg-goal" :class="{ 'is-done': g.reached, 'is-target': targetId === g.id }">
          <div class="pg-top">
            <img :src="skillIconSrc(g.skill)" alt="" width="26" height="26" />
            <b>{{ g.title }}</b>
            <span v-if="g.reached" class="pg-done">Reached</span>
            <span class="pg-pct">{{ g.percent }}%</span>
          </div>
          <div class="level-progress-track"><div class="level-progress-fill" :style="{ width: `${g.percent}%` }" /></div>
          <p class="pg-meta">{{ g.reached ? 'Goal reached!' : `${formatXp(g.currentXp)} of ${formatXp(g.targetXp)} XP · ${formatXp(g.remainingXp)} to go` }}</p>
          <div class="pg-actions"><button class="btn btn-ghost" type="button" @click="$emit('share', g)">Share</button></div>
        </li>
      </ul>
      <p v-if="isOwner" class="pg-owner-note">Change it, or turn it off, in the plan's settings in the planner.</p>
    </div>

    <!-- Goals set one by one before plans could be shown (still here until removed) -->
    <template v-if="otherGoals.length">
      <h3 v-if="plan" class="pg-other-h">Other goals</h3>
      <ul class="pg-list">
        <li v-for="g in otherGoals" :key="g.id" class="pg-goal" :class="{ 'is-done': g.reached, 'is-target': targetId === g.id }">
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
              <button v-if="!plan" class="btn-text" type="button" @click="togglePin(g)">{{ g.pinned ? 'Unpin' : 'Pin to profile' }}</button>
              <button class="btn-text pg-del" type="button" @click="remove(g)">Remove from profile</button>
            </template>
          </div>
        </li>
      </ul>
    </template>

    <p v-if="!isOwner && !plan && !otherGoals.length" class="pg-empty">No public goal yet.</p>
    <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

    <!-- The goal is a plan, made in the planner -->
    <div class="pg-plan">
      <RouterLink class="btn" :class="isOwner && !plan ? 'btn-primary' : 'btn-ghost'" :to="planLink" @click="track('profile_goals_plan_click', { owner: isOwner })">
        {{ isOwner ? (plan ? 'Open the plan' : 'Plan your goals in the planner') : `Plan ${displayName}'s next goals` }} <span aria-hidden="true">→</span>
      </RouterLink>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ApiError } from '@/api/client'
import { goalsApi } from '@/api/goals'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { track } from '@/utils/analytics'

const props = defineProps({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  goals: { type: Array, required: true },
  // The plan on the profile ({ planId, name, percent, reached, count }) or null.
  plan: { type: Object, default: null },
  isOwner: { type: Boolean, default: false },
  // A goal to point at (from a shared link).
  targetId: { type: Number, default: null },
})
const emit = defineEmits(['update', 'share'])

const planGoals = computed(() => props.goals.filter((g) => g.fromPlan))
const otherGoals = computed(() => props.goals.filter((g) => !g.fromPlan))
// The owner's own plan opens directly; anyone else (or no plan) goes to the planner for this player.
const planLink = computed(() => (props.isOwner && props.plan ? { name: 'plannerPlan', params: { id: props.plan.planId } } : { name: 'planner', query: { u: props.username } }))
const error = ref('')
const message = (err) => (err instanceof ApiError ? err.message : 'Something went wrong, please try again.')

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
