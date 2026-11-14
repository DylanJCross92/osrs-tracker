<template>
  <div class="calc-dir planner">
    <section class="card calc-dir-hero">
      <div class="calc-dir-hero-main">
        <span class="calc-eyebrow">{{ guides.length }} plan guides</span>
        <h1>OSRS <span class="home-accent">Plan</span> Guides</h1>
        <p class="calc-lead">How long and how much XP the big account goals take, worked out skill by skill on the fastest routes. Open any plan in the Account Planner, enter your username, and it is recalculated from your own stats.</p>
      </div>
    </section>

    <section class="card">
      <ul class="calc-grid pg-grid">
        <li v-for="g in guides" :key="g.slug">
          <RouterLink :to="g.path" class="calc-card pg-card" @click="track('plan_guide_click', { guide: g.slug, source: 'index' })">
            <span>
              <b>{{ g.h1 }}</b>
              <small>{{ formatNum(g.totalXp) }} XP · about {{ g.hoursText }}</small>
              <small>{{ g.short }}</small>
            </span>
          </RouterLink>
        </li>
      </ul>
    </section>

    <section class="card">
      <h2>Prefer one skill at a time?</h2>
      <p class="calc-lead">Every skill has its own <RouterLink to="/calculators">calculator</RouterLink>, with routes and methods for goals like 1 to 99. The <RouterLink to="/osrs-xp-table">XP table</RouterLink> lists the XP for every level.</p>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { setPageMeta } from '@/utils/pageMeta'
import { track } from '@/utils/analytics'
import { GUIDE_DEFS, buildPlanGuide } from '@/data/planGuides'
import { formatNum } from '@/utils/planner'

setPageMeta({
  title: 'OSRS Plan Guides: Max Cape, All 90s and Total Level Plans',
  description: 'Plan guides for Old School RuneScape: how long and how much XP a max cape, all 90s, all 70s or a total level goal takes, with the plan ready to open in the Account Planner.',
  path: '/plans',
})

const guides = computed(() => GUIDE_DEFS.map(buildPlanGuide).filter(Boolean))
</script>
