<template>
  <!-- Founder and admin: the gold shield. -->
  <span v-if="label" class="player-badge" :data-tip="label" :aria-label="label" role="img" tabindex="0">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3zm0 5.2l-1.6 3.3-3.6.5 2.6 2.5-.6 3.6 3.2-1.7 3.2 1.7-.6-3.6 2.6-2.5-3.6-.5L12 7.2z" />
    </svg>
  </span>
  <!-- A profile its owner has claimed: a green verified tick, so it never gets mixed up with the shield. A profile that
       already has a special badge (the founder shield) keeps just that one. -->
  <span v-else-if="claimed" class="player-badge is-claimed" :data-tip="mine ? 'Your profile' : 'Claimed profile'" :aria-label="mine ? 'Your profile' : 'Claimed profile'" role="img" tabindex="0">
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M7.4 12.6l3.1 3.1 6.1-6.6" fill="none" stroke="#16130e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </span>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' },
  claimed: { type: Boolean, default: false },
  // The signed-in visitor owns it: only changes the hover text.
  mine: { type: Boolean, default: false },
})
</script>
