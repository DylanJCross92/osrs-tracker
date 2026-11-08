<template>
  <div class="card info-page">
    <h1>Contact</h1>
    <p>Found a bug, have an idea, or want a tracked username removed? We'd like to hear from you.</p>
    <p v-if="CONTACT_EMAIL"><a :href="`mailto:${CONTACT_EMAIL}`" class="btn btn-primary">{{ CONTACT_EMAIL }}</a></p>
    <p v-else class="empty-hint">Contact details are being set up, please check back soon.</p>
  </div>
</template>

<script setup>
import { setPageMeta } from '@/utils/pageMeta'
import { CONTACT_EMAIL } from '@/config'
setPageMeta({ title: 'Contact', description: 'Contact TickGains with feedback, bug reports or removal requests.', path: '/contact' })
</script>
