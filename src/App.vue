<template>
  <div id="appShell" :class="{ 'has-save-bar': saveBar }">
    <header class="app-topbar">
      <div class="app-topbar-inner">
        <RouterLink :to="{ name: 'players' }" class="app-logo">
          <img src="/logo.svg?v=2" alt="TickGains" class="app-logo-img" />
        </RouterLink>
        <NavSearch />
        <nav class="app-nav" aria-label="Main">
          <RouterLink :to="{ name: 'players' }" class="app-nav-link" :class="{ 'is-active': route.name === 'players' || route.name === 'playerDetail' || route.name === 'weeklyShareCard' }">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
            Home
          </RouterLink>
          <RouterLink :to="{ name: 'discover' }" class="app-nav-link" :class="{ 'is-active': route.name === 'discover' }">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            Discover
          </RouterLink>
          <RouterLink :to="{ name: 'clans' }" class="app-nav-link" :class="{ 'is-active': ['clans', 'clan', 'clanNew', 'clanJoin', 'competition'].includes(route.name) }">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2" /><path d="M3 20c.6-3.6 3-5.4 6-5.4s5.4 1.8 6 5.4" /><circle cx="17.2" cy="9.2" r="2.4" /><path d="M16.4 14.6c2.6.2 4.2 1.8 4.6 4.8" /></svg>
            Clans
          </RouterLink>
          <RouterLink :to="{ name: 'planner' }" class="app-nav-link" title="Account Planner" aria-label="Account Planner" :class="{ 'is-active': String(route.name || '').startsWith('planner') }">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></svg>
            Planner
          </RouterLink>
          <RouterLink :to="{ name: 'items' }" class="app-nav-link" title="Grand Exchange prices" aria-label="Grand Exchange prices" :class="{ 'is-active': ['items', 'item'].includes(route.name) }">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M14.8 9.2C14.3 8.4 13.3 8 12 8c-1.7 0-2.8.8-2.8 2s1 1.7 2.8 2c1.8.3 2.8.8 2.8 2s-1.1 2-2.8 2c-1.4 0-2.4-.5-2.9-1.4" /><path d="M12 6.5V8m0 8v1.5" /></svg>
            GE Prices
          </RouterLink>
        </nav>
        <AccountMenu />
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
          <EmailSignup source="footer" />
        </div>
        <nav v-for="col in footerCols" :key="col.title" :aria-label="col.title" class="app-footer-col">
          <h4>{{ col.title }}</h4>
          <component :is="link.to ? 'RouterLink' : 'a'" v-for="link in col.links" :key="link.label" :to="link.to" :href="link.href" :target="link.href ? '_blank' : undefined" :rel="link.href ? 'noopener' : undefined" @click="track('footer_link', { section: col.title, label: link.label })">{{ link.label }}</component>
        </nav>
      </div>
      <p class="app-footer-note">TickGains is a fan-made tool and is not affiliated with or endorsed by Jagex Ltd. Old School RuneScape is a trademark of Jagex Ltd.</p>
    </footer>
    <GuestSaveBar @visible="(v) => (saveBar = v)" />
    <FeedbackWidget />
    <ToastHost />
    <ItemModal v-if="modalSlug" :slug="modalSlug" @close="closeItemModal" />
  </div>
</template>

<script setup>
import { track } from '@/utils/analytics'
import { DISCORD_URL } from '@/config'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ToastHost from '@/components/ToastHost.vue'
import ItemModal from '@/components/ItemModal.vue'
import { closeItemModal, modalSlug } from '@/composables/useItemModal'
import FeedbackWidget from '@/components/FeedbackWidget.vue'
import GuestSaveBar from '@/components/guest/GuestSaveBar.vue'
import NavSearch from '@/components/NavSearch.vue'
import EmailSignup from '@/components/EmailSignup.vue'
import AccountMenu from '@/components/AccountMenu.vue'
import { initAuth, useAuth } from '@/composables/useAuth'
import { startVisitorPlans } from '@/utils/visitorPlans'
import { initModalScrollLock } from '@/utils/modalScrollLock'

const route = useRoute()
// Whether the signed-out save bar is showing, so the page leaves room for it at the bottom.
const saveBar = ref(false)
// The item popup closes when the page changes underneath it.
watch(() => route.fullPath, closeItemModal)
const { loggedIn } = useAuth()
// Find out right away whether this browser is signed in (the answer also restores saved settings).
initAuth()

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
// While any modal is open the page behind it does not scroll (see utils/modalScrollLock.js).
let stopScrollLock = () => {}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  stopScrollLock = initModalScrollLock()
  startVisitorPlans(() => loggedIn.value)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  stopScrollLock()
})

const footerCols = computed(() => [
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
      { label: 'Compare players', to: { name: 'compare' } },
      { label: 'Clans', to: { name: 'clans' } },
      { label: 'Grand Exchange prices', to: { name: 'items' } },
    ],
  },
  {
    title: 'Plan',
    links: [
      { label: 'Account Planner', to: { name: 'planner' } },
      { label: 'Skill calculators', to: { name: 'calculators' } },
      { label: 'Quest & diary tracker', to: { name: 'quests' } },
      { label: 'Plan guides', to: { name: 'planGuides' } },
      { label: 'OSRS XP table', to: { name: 'xpTable' } },
      { label: 'Add a skill goal', to: { name: 'planner', hash: '#add-goal' } },
    ],
  },
  {
    title: 'Site',
    links: [
      { label: 'About', to: { name: 'about' } },
      { label: 'Join our Discord', href: DISCORD_URL },
      { label: 'Release notes', to: { name: 'releaseNotes' } },
      { label: 'Contact', to: { name: 'contact' } },
      { label: 'Privacy', to: { name: 'privacy' } },
      loggedIn.value ? { label: 'Your account', to: { name: 'account' } } : { label: 'Log in or sign up', to: { name: 'login' } },
    ],
  },
])
</script>
