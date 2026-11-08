<template>
  <div id="appShell">
    <header class="app-topbar">
      <div class="app-topbar-inner">
        <RouterLink :to="{ name: 'players' }" class="app-logo">
          <img src="/logo.svg?v=2" alt="TickGains" class="app-logo-img" />
        </RouterLink>
        <nav class="app-nav" aria-label="Main">
          <RouterLink :to="{ name: 'players' }" class="app-nav-link" :class="{ 'is-active': route.name === 'players' || route.name === 'playerDetail' || route.name === 'weeklyShareCard' }">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
            Home
          </RouterLink>
          <RouterLink :to="{ name: 'discover' }" class="app-nav-link" :class="{ 'is-active': route.name === 'discover' }">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            Discover
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
    <footer class="app-footer">
      <div class="app-footer-inner">
        <span class="app-footer-brand">TickGains <small>· OSRS XP tracking, no sign-up</small></span>
        <nav aria-label="Footer">
          <RouterLink :to="{ name: 'about' }">About</RouterLink>
          <RouterLink :to="{ name: 'players', hash: '#features' }">Features</RouterLink>
          <RouterLink :to="{ name: 'privacy' }">Privacy</RouterLink>
          <RouterLink :to="{ name: 'contact' }">Contact</RouterLink>
        </nav>
      </div>
      <p class="app-footer-note">TickGains is a fan-made tool and is not affiliated with or endorsed by Jagex Ltd. Old School RuneScape is a trademark of Jagex Ltd.</p>
    </footer>
    <ToastHost />
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import ToastHost from '@/components/ToastHost.vue'

const route = useRoute()
</script>
