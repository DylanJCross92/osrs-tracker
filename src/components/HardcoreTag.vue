<template>
  <span class="hw-tag" :class="{ 'is-short': short }" :data-tip="TITLE" :aria-label="TITLE" role="note" tabindex="0">
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c-4.4 0-8 3.2-8 7.5 0 2.4 1.1 4.2 2.7 5.4V19h10.6v-3.1c1.6-1.2 2.7-3 2.7-5.4C20 6.2 16.4 3 12 3z" /><circle cx="9" cy="11" r="1.3" /><circle cx="15" cy="11" r="1.3" /></svg>
    <span>{{ short ? 'HC Worlds' : 'Hardcore Worlds' }}</span>
  </span>
</template>

<script setup>
// Marks a player as a Hardcore Worlds character wherever their name shows up: their stats come from the Hardcore Worlds hiscores, which are separate from the
// main hiscores (a different table, a different rank, and a character that starts again when it dies).
defineProps({ short: { type: Boolean, default: false } })
const TITLE = 'Hardcore Worlds character. These stats are from the Hardcore Worlds hiscores, not the main hiscores, so ranks, XP and levels are separate from any main account.'
</script>
