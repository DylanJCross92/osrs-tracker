<template>
  <div class="hub-stack">
    <div class="ho-tiles">
      <button class="ho-tile" type="button" @click="$emit('go', 'plans')">
        <span>Plans</span>
        <b>{{ planCount }}</b>
        <small>{{ publicCount ? `${publicCount} public` : 'saved to your account' }}</small>
      </button>
      <button class="ho-tile" type="button" @click="$emit('go', 'quests')">
        <span>Quests</span>
        <b>{{ questStats.done }}<i>/{{ questStats.total }}</i></b>
        <small>{{ Math.floor(questStats.pct * 100) }}% complete</small>
      </button>
      <button class="ho-tile" type="button" @click="$emit('go', 'goals')">
        <span>Profiles</span>
        <b>{{ profiles.length }}</b>
        <small>{{ profiles.length ? 'goals and records' : 'none claimed yet' }}</small>
      </button>
      <button class="ho-tile" type="button" @click="$emit('go', 'notifications')">
        <span>Unread</span>
        <b>{{ unread }}</b>
        <small>notification{{ unread === 1 ? '' : 's' }}</small>
      </button>
    </div>

    <section class="card hub-card">
      <h2>Your profiles</h2>
      <p v-if="!profiles.length" class="acc-empty">You have not claimed a profile yet. Open a profile page and press Claim, and its goals and records show up here.</p>
      <ul v-else class="ho-profiles">
        <li v-for="p in profiles" :key="p.username">
          <span class="ho-av"><PlayerAvatar :name="p.username" /></span>
          <div>
            <b>{{ p.displayName }}</b>
            <div class="ho-links">
              <RouterLink :to="{ name: 'playerDetail', params: { username: p.username } }">Profile</RouterLink>
              <RouterLink :to="{ name: 'planner', query: { u: p.username } }">Planner</RouterLink>
              <button type="button" @click="$emit('go', 'goals', p.username)">Goals</button>
              <button type="button" @click="$emit('go', 'records', p.username)">Records</button>
            </div>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="latestPlan" class="card hub-card">
      <h2>Pick up where you left off</h2>
      <p class="acc-note">Your most recently saved plan.</p>
      <div class="hp-row">
        <div class="hp-main">
          <RouterLink class="hp-name" :to="{ name: 'planner', query: { plan: latestPlan.id } }">{{ latestPlan.name }}</RouterLink>
          <div class="hp-meta">
            <span v-if="latestPlan.player?.rsn">For {{ latestPlan.player.rsn }}</span>
            <span>{{ latestPlan.goals.length }} goal{{ latestPlan.goals.length === 1 ? '' : 's' }}</span>
            <span>Updated {{ formatRelative(latestPlan.updatedAt) }}</span>
          </div>
        </div>
        <div class="hp-actions"><RouterLink class="btn btn-primary" :to="{ name: 'planner', query: { plan: latestPlan.id } }">Open plan</RouterLink></div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { useSharedPlans } from '@/composables/useSharedPlans'
import { useRequirements } from '@/composables/useRequirements'
import { listSavedPlans } from '@/utils/plannerTools'
import { formatRelative } from '@/utils/time'

defineProps({ profiles: { type: Array, required: true }, unread: { type: Number, default: 0 } })
defineEmits(['go'])

const { questStats } = useRequirements()
const { shareFor } = useSharedPlans()
const plans = listSavedPlans()
const planCount = plans.length
const publicCount = computed(() => plans.filter((p) => shareFor(p.id)).length)
const latestPlan = plans[0] || null
</script>
