<template>
  <div id="appShell">
    <header class="app-topbar">
      <RouterLink :to="{ name: 'players' }" class="app-logo">
        <img src="/logo.svg" alt="TickGains" class="app-logo-img" />
      </RouterLink>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
    <ToastHost />
  </div>
</template>

<script setup>
import ToastHost from '@/components/ToastHost.vue'
</script>
