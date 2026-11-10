<template>
  <div class="card">
    <div class="chart-header">
      <h2>Suggested goals</h2>
      <RouterLink class="btn btn-primary" :to="{ name: 'planner', query: { u: player.username } }">Plan This Player's Goals</RouterLink>
    </div>
    <p class="profile-note">Auto-generated from {{ player.displayName }}'s current stats, suggestions, not commitments. Custom goals in the planner never change this profile.</p>
    <div class="profile-goal-grid">
      <div v-for="g in goals" :key="g.title" class="profile-goal">
        <div class="goal-head">
          <img v-if="g.skill" :src="skillIconSrc(g.skill)" :alt="g.skill" width="28" height="28" />
          <span v-else class="achievement-total-icon">★</span>
          <b>{{ g.title }}</b>
        </div>
        <div class="goal-meta">{{ g.currentLabel }} → {{ g.targetLabel }}</div>
        <div class="level-progress-track"><div class="level-progress-fill" :style="{ width: `${Math.min(g.percent, 100)}%` }" /></div>
        <div class="goal-stats">
          <span>{{ g.percent }}%</span>
          <span v-if="g.remainingXp != null">{{ g.remainingXp.toLocaleString('en-US') }} XP to go</span>
          <span v-else>{{ g.remainingLevels.toLocaleString('en-US') }} levels to go</span>
          <span v-if="g.hours">≈ {{ g.hours < 100 ? Math.round(g.hours * 10) / 10 : Math.round(g.hours).toLocaleString('en-US') }} h</span>
        </div>
        <RouterLink class="btn-text" :to="{ name: 'planner', query: g.plannerQuery }">Open in planner →</RouterLink>
      </div>
    </div>
    <p v-if="!goals.length" class="empty-hint">This player has nothing left to suggest, maxed!</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import { suggestedGoals } from '@/utils/profile'

const props = defineProps({ player: { type: Object, required: true }, snapshots: { type: Array, required: true } })
const goals = computed(() => suggestedGoals(props.snapshots[props.snapshots.length - 1], props.player.username))
</script>
