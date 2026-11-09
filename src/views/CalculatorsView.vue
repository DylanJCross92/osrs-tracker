<template>
  <div class="calc-dir planner">
    <section class="card">
      <h1>OSRS Skill Calculators</h1>
      <p class="calc-lead">Pick a skill to calculate the XP, hours and gp it takes to reach your goal. No account needed, and you can load your stats by username.</p>
      <label class="calc-dir-search">
        <span class="sr-only">Search skills</span>
        <input v-model.trim="query" type="search" placeholder="Search skills (for example Agility)" autocomplete="off" data-1p-ignore />
      </label>
    </section>

    <section v-for="cat in groups" :key="cat.name" class="card">
      <h2>{{ cat.name }}</h2>
      <ul class="calc-grid">
        <li v-for="s in cat.skills" :key="s.slug">
          <RouterLink :to="`/calculators/${s.slug}`" class="calc-card" @click="track('calc_directory_click', { skill: s.name })">
            <img :src="skillIconSrc(s.name)" :alt="`${s.name} icon`" width="36" height="36" />
            <span><b>{{ s.name }} calculator</b><small>{{ s.short }}</small></span>
          </RouterLink>
        </li>
      </ul>
    </section>
    <p v-if="!groups.length" class="empty-hint">No skill matches "{{ query }}".</p>

    <section class="card">
      <h2>Planning more than one skill?</h2>
      <p class="calc-lead">The <RouterLink to="/planner">Account Planner</RouterLink> combines goals from every skill, compares strategies, and totals your time and gp. Every calculator has an "Add to Account Planner" button.</p>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { setPageMeta } from '@/utils/pageMeta'
import { track } from '@/utils/analytics'
import { skillIconSrc } from '@/utils/osrsSkills'
import { SKILL_INFO, CALCULATOR_CATEGORIES } from '@/data/skillInfo'

setPageMeta({
  title: 'OSRS Skill Calculators',
  description: 'Free OSRS skill calculators for every skill. Work out the XP, training hours and gp needed to reach your next level, or level 99, with real training methods.',
  path: '/calculators',
})

const query = ref('')
const groups = computed(() => {
  const q = query.value.toLowerCase()
  return CALCULATOR_CATEGORIES.map((name) => ({
    name,
    skills: SKILL_INFO.filter((s) => s.category === name && (!q || s.name.toLowerCase().includes(q) || s.short.toLowerCase().includes(q))),
  })).filter((g) => g.skills.length)
})
</script>
