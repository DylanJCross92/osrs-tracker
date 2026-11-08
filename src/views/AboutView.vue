<template>
  <div class="card info-page">
    <h1>About TickGains</h1>
    <p>
      TickGains is a free tracker for Old School RuneScape. Enter any OSRS username and it saves a snapshot of that
      player's public hiscores every hour, so you can see XP gains, level-ups and milestones over time — no account
      needed.
    </p>
    <h2>What it does</h2>
    <ul>
      <li><b>Tracks automatically.</b> Skill XP, levels and ranks, updated every hour.</li>
      <li><b>Imports history.</b> Where Wise Old Man has older data, TickGains brings it in so a new profile isn't blank.</li>
      <li><b>Plans your goals.</b> The Account Planner turns XP targets into training routes, hours and GP estimates.</li>
      <li><b>Helps you discover players.</b> Leaderboards, achievements and recent activity across tracked players.</li>
    </ul>
    <h2>Good to know</h2>
    <p>
      Everything shown is derived from public OSRS hiscores data. XP/hour and GP/hour figures in the planner are
      approximate community estimates, not guarantees. TickGains is a fan project and isn't affiliated with Jagex Ltd.
    </p>
    <RouterLink to="/" class="btn btn-primary">Start tracking</RouterLink>
  </div>
</template>

<script setup>
import { setPageMeta } from '@/utils/pageMeta'
setPageMeta({
  title: 'About',
  description: 'TickGains is a free OSRS XP tracker: automatic hiscores snapshots, historical imports, an account planner and player discovery — no sign-up.',
  path: '/about',
})
</script>
