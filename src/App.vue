<template>
  <div id="appShell">
    <header class="app-topbar">
      <RouterLink :to="{ name: 'players' }" class="app-logo">OSRS XP Tracker</RouterLink>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
    <ToastHost />
    <ConfirmDialog />
  </div>
</template>

<script setup>
import ToastHost from '@/components/ToastHost.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
</script>
