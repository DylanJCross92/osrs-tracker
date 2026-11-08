import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'
import { track } from '@/utils/analytics'

const routes = [
  {
    path: '/',
    name: 'players',
    component: () => import('@/views/HomeView.vue'),
  },
  { path: '/about', name: 'about', component: () => import('@/views/AboutView.vue') },
  { path: '/privacy', name: 'privacy', component: () => import('@/views/PrivacyView.vue') },
  { path: '/contact', name: 'contact', component: () => import('@/views/ContactView.vue') },
  {
    path: '/discover',
    name: 'discover',
    component: () => import('@/views/DiscoverView.vue'),
  },
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
  return router
}

export default createAppRouter()
