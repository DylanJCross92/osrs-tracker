<template>
  <SkillCalculatorLayout v-if="info" :key="info.slug" :info="info" />
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SkillCalculatorLayout from '@/components/calculators/SkillCalculatorLayout.vue'
import { setPageMeta } from '@/utils/pageMeta'
import { SKILL_BY_SLUG, calculatorTitle, calculatorDescription } from '@/data/skillInfo'

const route = useRoute()
const router = useRouter()
const info = computed(() => SKILL_BY_SLUG[String(route.params.skill || '').toLowerCase()] || null)

watch(
  info,
  (i) => {
    // Unknown skill names go back to the directory.
    if (!i) return router.replace('/calculators')
    setPageMeta({ title: calculatorTitle(i).replace(' | TickGains', ''), description: calculatorDescription(i), path: `/calculators/${i.slug}` })
  },
  { immediate: true },
)
</script>
