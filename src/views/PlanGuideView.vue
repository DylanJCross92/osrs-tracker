<template>
  <div v-if="page" class="calc-dir planner pg">
    <section class="card calc-dir-hero">
      <div class="calc-dir-hero-main">
        <nav class="calc-crumbs" aria-label="Breadcrumb"><RouterLink to="/plans">Plan guides</RouterLink> <span aria-hidden="true">/</span> <span>{{ page.name }}</span></nav>
        <h1>{{ page.h1 }}</h1>
        <p class="calc-lead">{{ page.lead }}</p>
        <div class="pg-cta">
          <RouterLink class="btn btn-primary" :to="page.plannerHref" @click="track('plan_guide_open_planner', { guide: page.slug })">Open this plan in the planner</RouterLink>
          <span class="pg-cta-note">Enter your username there and every goal is recalculated from your own stats.</span>
        </div>
      </div>
    </section>

    <section class="pg-tiles" aria-label="Summary">
      <div class="pg-tile"><span>XP to gain</span><b>{{ formatNum(page.totalXp) }}</b><small>{{ page.skillCount }} skills</small></div>
      <div class="pg-tile"><span>Training time</span><b>{{ page.hoursText }}</b><small>fastest routes, from a new account</small></div>
      <div class="pg-tile"><span>Calendar time</span><b>{{ page.daysAt[0].days }} days</b><small>at {{ page.daysAt[0].hoursPerDay }} h a day · {{ page.daysAt[1].days }} days at {{ page.daysAt[1].hoursPerDay }} h</small></div>
    </section>

    <section class="card">
      <h2>Skill by skill, in training order</h2>
      <div class="planner-table-scroll">
        <table class="planner-table">
          <caption class="sr-only">Each skill in the plan</caption>
          <thead><tr><th>#</th><th>Skill</th><th>Levels</th><th class="num">XP</th><th class="num">Time</th><th class="num">Net GP</th></tr></thead>
          <tbody>
            <tr v-for="s in page.skills" :key="s.skill">
              <td>{{ s.order }}</td>
              <td><span class="pg-skill"><img :src="skillIconSrc(s.skill)" alt="" width="20" height="20" /><RouterLink :to="s.calcPath">{{ s.skill }}</RouterLink></span></td>
              <td>{{ s.from }} to {{ s.to }}</td>
              <td class="num">{{ formatNum(s.xp) }}</td>
              <td class="num">{{ s.hoursText }}</td>
              <td class="num">{{ s.gpText }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="planner-hint">Quickest wins first. Estimates from community training rates and typical prices, assuming a new account. Your own gear, quests and stats change them, which is what the planner is for.</p>
    </section>

    <section class="card goal-faq">
      <h2>Common questions</h2>
      <div v-for="f in page.faq" :key="f.q" class="goal-faq-item">
        <h3>{{ f.q }}</h3>
        <p>{{ f.a }}</p>
      </div>
    </section>

    <section class="card">
      <h2>More plan guides</h2>
      <p class="pg-more">
        <RouterLink v-for="g in others" :key="g.slug" :to="g.path">{{ g.name }}</RouterLink>
      </p>
      <p class="calc-lead"><RouterLink to="/plans">All plan guides</RouterLink> · <RouterLink to="/osrs-xp-table">OSRS XP table</RouterLink> · <RouterLink to="/calculators">Skill calculators</RouterLink></p>
    </section>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { setPageMeta } from '@/utils/pageMeta'
import { track } from '@/utils/analytics'
import { GUIDE_DEFS, buildPlanGuide, guideDef } from '@/data/planGuides'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatNum } from '@/utils/planner'

const route = useRoute()
const router = useRouter()

const def = computed(() => guideDef(route.params.slug))
const page = computed(() => (def.value ? buildPlanGuide(def.value) : null))
const others = computed(() => GUIDE_DEFS.filter((g) => g.slug !== def.value?.slug))

watch(
  page,
  (p) => {
    if (!p) return router.replace('/plans')
    setPageMeta({ title: p.title.replace(' | TickGains', ''), description: p.description, path: p.path })
  },
  { immediate: true },
)
</script>
