<template>
  <div class="card info-page">
    <h1>Contact</h1>
    <p>Found a bug, have an idea, or want a tracked username removed? We'd like to hear from you.</p>
    <p><a :href="DISCORD_URL" class="btn btn-primary" target="_blank" rel="noopener">Join the TickGains Discord</a></p>
    <p v-if="CONTACT_EMAIL"><a :href="`mailto:${CONTACT_EMAIL}`" class="btn btn-ghost">{{ CONTACT_EMAIL }}</a></p>
    <p class="planner-hint">The Discord is the quickest way to report a bug, share an idea or ask for a username to be removed.</p>
  </div>
</template>

<script setup>
import { setPageMeta } from '@/utils/pageMeta'
import { CONTACT_EMAIL, DISCORD_URL } from '@/config'
setPageMeta({ title: 'Contact', description: 'Contact TickGains with feedback, bug reports or removal requests.', path: '/contact' })
</script>
