<template>
  <div id="appShell">
    <header class="app-topbar">
      <div class="app-topbar-inner">
        <RouterLink :to="{ name: 'players' }" class="app-logo">
          <img src="/logo.svg" alt="TickGains" class="app-logo-img" />
        </RouterLink>
        <nav class="app-nav" aria-label="Main">
          <RouterLink :to="{ name: 'players' }" class="app-nav-link" :class="{ 'is-active': route.name === 'players' || route.name === 'playerDetail' || route.name === 'weeklyShareCard' }">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-9" /><path d="M15 6h6v6" /></svg>
            Player Gains
          </RouterLink>
          <RouterLink :to="{ name: 'planner' }" class="app-nav-link" :class="{ 'is-active': route.name === 'planner' }">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></svg>
            Account Planner
          </RouterLink>
        </nav>
      </div>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
    <ToastHost />
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import ToastHost from '@/components/ToastHost.vue'

const route = useRoute()
</script>
