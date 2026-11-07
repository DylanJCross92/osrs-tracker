<template>
  <span v-if="label" class="player-badge" :title="label">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3zm0 5.2l-1.6 3.3-3.6.5 2.6 2.5-.6 3.6 3.2-1.7 3.2 1.7-.6-3.6 2.6-2.5-3.6-.5L12 7.2z" />
    </svg>
    {{ label }}
  </span>
</template>

<script setup>
defineProps({ label: { type: String, default: '' } })
</script>
