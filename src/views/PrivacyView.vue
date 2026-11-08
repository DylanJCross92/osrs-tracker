<template>
  <div class="card info-page">
    <h1>Privacy</h1>
    <p class="info-updated">Plain-language summary of how TickGains handles data.</p>
    <h2>What we store</h2>
    <ul>
      <li>
        <b>Public OSRS hiscores data</b> for the usernames people choose to track: skill XP, levels and ranks, saved as
        timestamped snapshots, plus history imported from Wise Old Man where available. This is public information.
      </li>
      <li>Derived data such as milestones and achievements calculated from those snapshots.</li>
    </ul>
    <h2>What we don't do</h2>
    <ul>
      <li>There are no accounts, passwords or sign-ups, and TickGains never asks for your OSRS login.</li>
      <li>Searching or tracking a name doesn't change anything on the OSRS account.</li>
    </ul>
    <h2>Usage analytics</h2>
    <p>
      TickGains uses Google Tag Manager and Google Analytics to understand which pages and features are used. These
      tools may set cookies and collect technical information such as pages visited, device and approximate location.
      You can block them with your browser's privacy settings or an extension.
    </p>
    <h2>Your browser</h2>
    <p>Some preferences (like your selected gains period or a saved plan in the planner) are kept in your browser's local storage on your own device.</p>
    <h2>Questions or removal requests</h2>
    <p>If you'd like a tracked username removed, get in touch via the <RouterLink to="/contact">contact page</RouterLink>.</p>
  </div>
</template>

<script setup>
import { setPageMeta } from '@/utils/pageMeta'
setPageMeta({ title: 'Privacy', description: 'How TickGains handles data: public OSRS hiscores snapshots, no accounts, and usage analytics.', path: '/privacy' })
</script>
