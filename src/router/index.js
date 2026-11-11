import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'
import { track } from '@/utils/analytics'
import { isStaleChunkError, reloadForNewVersion } from '@/utils/staleDeploy'
import { useRivals } from '@/composables/useRivals'
import { authReady, useAuth } from '@/composables/useAuth'

const routes = [
  {
    path: '/',
    name: 'players',
    component: () => import('@/views/HomeView.vue'),
  },
  { path: '/about', name: 'about', component: () => import('@/views/AboutView.vue') },
  { path: '/privacy', name: 'privacy', component: () => import('@/views/PrivacyView.vue') },
  { path: '/contact', name: 'contact', component: () => import('@/views/ContactView.vue') },
  { path: '/unsubscribe', name: 'unsubscribe', component: () => import('@/views/UnsubscribeView.vue') },
  {
    path: '/discover',
    name: 'discover',
    component: () => import('@/views/DiscoverView.vue'),
  },
  { path: '/calculators', name: 'calculators', component: () => import('@/views/CalculatorsView.vue') },
  { path: '/calculators/:skill', name: 'skillCalculator', component: () => import('@/views/SkillCalculatorView.vue') },
  { path: '/calculators/:skill/:goal', name: 'skillGoalCalculator', component: () => import('@/views/SkillGoalView.vue') },
  {
    path: '/leaderboard',
    name: 'leaderboard',
    component: () => import('@/views/LeaderboardView.vue'),
  },
  // A challenge link from a friend. With your own name saved it opens the head-to-head straight away, otherwise
  // Compare opens with the challenger filled in and your box waiting.
  {
    path: '/challenge/:username',
    redirect: (to) => {
      const them = to.params.username
      const { me } = useRivals()
      if (me.value && me.value.toLowerCase() === String(them).toLowerCase()) return { name: 'playerDetail', params: { username: them } }
      if (me.value) return { name: 'compare', params: { a: me.value, b: them }, query: { from: 'challenge' } }
      return { name: 'compare', query: { vs: them, from: 'challenge' } }
    },
  },
  // Accounts. Logging in, signing up and resetting a password share one view; the account page needs a login.
  { path: '/login', name: 'login', component: () => import('@/views/AuthView.vue'), props: { mode: 'login' }, meta: { guestOnly: true } },
  { path: '/signup', name: 'signup', component: () => import('@/views/AuthView.vue'), props: { mode: 'signup' }, meta: { guestOnly: true } },
  { path: '/forgot-password', name: 'forgotPassword', component: () => import('@/views/AuthView.vue'), props: { mode: 'forgot' } },
  { path: '/reset-password', name: 'resetPassword', component: () => import('@/views/AuthView.vue'), props: { mode: 'reset' } },
  { path: '/verify-email', name: 'verifyEmail', component: () => import('@/views/AuthView.vue'), props: { mode: 'verify' } },
  { path: '/admin/claims', name: 'adminClaims', component: () => import('@/views/AdminClaimsView.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/account', name: 'account', component: () => import('@/views/AccountView.vue'), meta: { requiresAuth: true } },
  { path: '/compare/:a?/:b?', name: 'compare', component: () => import('@/views/CompareView.vue') },
  {
    path: '/planner',
    name: 'planner',
    component: () => import('@/views/PlannerView.vue'),
  },
  {
    path: '/player/:username',
    name: 'playerDetail',
    component: () => import('@/views/PlayerDetailView.vue'),
  },
  // A shared record link: the server gives it a link preview, then it lands on the profile's Records tab.
  {
    path: '/player/:username/records/:key?',
    redirect: (to) => ({ name: 'playerDetail', params: { username: to.params.username }, query: { tab: 'records', ...(to.params.key ? { record: to.params.key } : {}) } }),
  },
  // A shared goal: the server gives it a link preview, then it lands on the profile's Goals tab.
  {
    path: '/player/:username/goals/:id',
    redirect: (to) => ({ name: 'playerDetail', params: { username: to.params.username }, query: { tab: 'goals', goal: to.params.id } }),
  },
  {
    path: '/player/:username/card/weekly/:slug?',
    name: 'weeklyShareCard',
    component: () => import('@/views/ShareCardView.vue'),
  },
]

export function createAppRouter() {
  const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(to) {
      // Footer links like /#features scroll to their section (below the sticky nav).
      if (to.hash) return { el: to.hash, top: 80, behavior: 'smooth' }
      return { top: 0 }
    },
  })

  // Account pages wait for the "who is signed in?" answer so they never flash the wrong state. Only those pages wait;
  // the rest of the site does not depend on it.
  router.beforeEach(async (to) => {
    if (!to.meta.requiresAuth && !to.meta.guestOnly) return true
    await authReady()
    const { loggedIn, isAdmin } = useAuth()
    if (to.meta.requiresAuth && !loggedIn.value) return { name: 'login', query: { next: to.fullPath } }
    if (to.meta.requiresAdmin && !isAdmin.value) return { name: 'players' }
    if (to.meta.guestOnly && loggedIn.value) return { name: 'account' }
    return true
  })

  // The GTM container fires its own page view on the first load; this reports
  // every later in-app navigation (the SPA never reloads the page). In GTM,
  // use a Custom Event trigger on "spa_page_view" for the GA4 page_view tag
  // (or GTM's built-in History Change trigger, not both, to avoid doubles).
  router.afterEach((to, from, failure) => {
    if (failure || from.name == null) return
    nextTick(() =>
      setTimeout(() => track('spa_page_view', { page_path: to.fullPath, page_title: document.title, route_name: String(to.name || '') }), 0),
    )
  })
  // A page whose file is gone after a deploy: load it fresh instead of leaving the tab stuck.
  router.onError((err, to) => {
    if (isStaleChunkError(err)) reloadForNewVersion(to?.fullPath)
  })
  return router
}

export default createAppRouter()
