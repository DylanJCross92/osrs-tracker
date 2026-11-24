<template>
  <article class="trk-page gb-page">
    <header class="pgh">
      <div class="pgh-title">
        <h1>Restore your data</h1>
        <p class="pgh-sub">Add what you saved on another device to this browser. Nothing here is removed.</p>
      </div>
    </header>
    <GuestBackup start="restore" :initial="initial" />
  </article>
</template>

<script setup>
import { setPageMeta } from '@/utils/pageMeta'
import GuestBackup from '@/components/guest/GuestBackup.vue'

setPageMeta({ title: 'Restore your TickGains data', description: 'Add a TickGains save code to this browser.', path: '/restore', noindex: true })

// A restore link carries the code after the # (which the site never receives).
const initial = typeof window !== 'undefined' ? decodeURIComponent(window.location.hash.replace(/^#/, '')) : ''
</script>
