<template>
  <header class="hero" aria-label="Plan summary">
    <div class="pgh">
      <div class="pgh-title">
        <div class="pgh-eyebrow">
          <RouterLink v-if="backTo" class="hero-back" :to="backTo">← Your plans</RouterLink>
          <span v-else class="pt-badge">Your plan</span>
        </div>
        <h1>{{ name }}</h1>
        <p class="pgh-sub">
          <template v-if="player">
            <RouterLink :to="{ name: 'playerDetail', params: { username: player.username } }">{{ player.displayName }}</RouterLink>
            <span aria-hidden="true">·</span>
          </template>
          <span>{{ goalCount }} skill{{ goalCount === 1 ? '' : 's' }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ strategyLabel }} strategy</span>
          <span aria-hidden="true">·</span>
          <span>{{ hoursPerDay }} h/day</span>
        </p>
      </div>
      <div class="pgh-actions">
        <slot name="actions" />
        <button class="btn btn-ghost hero-edit" type="button" @click="$emit('settings')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
          Settings
        </button>
      </div>
    </div>

    <!-- The finish line goes here -->
    <slot name="summary" />

    <div class="hero-notes"><slot /></div>
  </header>
</template>

<script setup>
// The finished plan at a glance. Nothing here can be typed into: changes happen in edit mode.
defineProps({
  name: { type: String, required: true },
  player: { type: Object, default: null },
  strategyLabel: { type: String, default: '' },
  hoursPerDay: { type: Number, required: true },
  goalCount: { type: Number, default: 0 },
  // A link back to the overview of plans.
  backTo: { type: Object, default: null },
})
defineEmits(['settings'])
</script>
