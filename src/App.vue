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
      <div class="app-footer-cols">
        <div class="app-footer-about">
          <span class="app-footer-brand">TickGains</span>
          <p>Free OSRS XP tracking, hiscores history and account planning. No sign-up, just your RSN.</p>
        </div>
        <nav v-for="col in footerCols" :key="col.title" :aria-label="col.title" class="app-footer-col">
          <h4>{{ col.title }}</h4>
          <component :is="link.to ? 'RouterLink' : 'a'" v-for="link in col.links" :key="link.label" :to="link.to" :href="link.href" :target="link.href ? '_blank' : undefined" :rel="link.href ? 'noopener' : undefined" @click="track('footer_link', { section: col.title, label: link.label })">{{ link.label }}</component>
        </nav>
      </div>
      <p class="app-footer-note">TickGains is a fan-made tool and is not affiliated with or endorsed by Jagex Ltd. Old School RuneScape is a trademark of Jagex Ltd.</p>
    </footer>
    <ToastHost />
  </div>
</template>

<script setup>
import { track } from '@/utils/analytics'
import { onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ToastHost from '@/components/ToastHost.vue'

const route = useRoute()

// One delegated listener for clicks that appear all over the site: any link to a
// player profile (with the page section it was in) and links that leave the site.
function onDocClick(e) {
  const a = e.target instanceof Element ? e.target.closest('a[href]') : null
  if (!a) return
  const href = a.getAttribute('href') || ''
  if (href.startsWith('/player/')) {
    const holder = a.closest('[id]') || a.closest('section')
    track('player_link_click', { page: String(route.name || ''), section: holder?.id || holder?.classList?.[0] || 'other' })
  } else if (/^https?:\/\//.test(href) && !href.startsWith(window.location.origin)) {
    try {
      track('outbound_click', { host: new URL(href).hostname, page: String(route.name || '') })
    } catch {
      /* ignore malformed links */
    }
  }
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

const footerCols = [
  {
    title: 'Track',
    links: [
      { label: 'Start tracking', to: { name: 'players' } },
      { label: 'Features', to: { name: 'players', hash: '#features' } },
      { label: 'How it works', to: { name: 'players', hash: '#how-it-works' } },
    ],
  },
  {
    title: 'Discover',
    links: [
      { label: 'Live activity', to: { name: 'discover', hash: '#live-activity' } },
      { label: 'Leaderboards', to: { name: 'leaderboard' } },
    ],
  },
  {
    title: 'Plan',
    links: [
      { label: 'Account Planner', to: { name: 'planner' } },
      { label: 'Skill calculators', to: { name: 'calculators' } },
      { label: 'Add a skill goal', to: { name: 'planner', hash: '#add-goal' } },
    ],
  },
  {
    title: 'Site',
    links: [
      { label: 'About', to: { name: 'about' } },
      { label: 'Contact', to: { name: 'contact' } },
      { label: 'Privacy', to: { name: 'privacy' } },
    ],
  },
]
</script>
