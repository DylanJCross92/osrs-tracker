import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'players',
    component: () => import('@/views/PlayersView.vue'),
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
  return createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior() {
      return { top: 0 }
    },
  })
}

export default createAppRouter()
