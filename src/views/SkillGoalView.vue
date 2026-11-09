<template>
  <SkillCalculatorLayout v-if="ctx" :key="`${ctx.info.slug}/${ctx.goal.slug}`" :info="ctx.info" :goal-page="pageGoal">
    <template #after-results><CalcGoalContent :content="ctx.content" /></template>
  </SkillCalculatorLayout>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SkillCalculatorLayout from '@/components/calculators/SkillCalculatorLayout.vue'
import CalcGoalContent from '@/components/calculators/CalcGoalContent.vue'
import { setPageMeta } from '@/utils/pageMeta'
import { SKILL_BY_SLUG } from '@/data/skillInfo'
import { findGoal, buildGoalContent } from '@/data/calculatorGoals'

const route = useRoute()
const router = useRouter()

// null for an unknown skill, a goal we do not offer, or a goal the catalog cannot plan end to end.
const ctx = computed(() => {
  const info = SKILL_BY_SLUG[String(route.params.skill || '').toLowerCase()]
  if (!info) return null
  const goal = findGoal(info, route.params.goal)
  if (!goal) return null
  const content = buildGoalContent(info, goal.from, goal.to)
  return content ? { info, goal, content } : null
})
const pageGoal = computed(() => (ctx.value ? { from: ctx.value.goal.from, to: ctx.value.goal.to, slug: ctx.value.goal.slug, label: ctx.value.goal.label, lead: ctx.value.content.lead } : null))

watch(
  [ctx, () => route.params],
  ([c]) => {
    if (!c) {
      const info = SKILL_BY_SLUG[String(route.params.skill || '').toLowerCase()]
      return router.replace(info ? `/calculators/${info.slug}` : '/calculators')
    }
    setPageMeta({ title: c.content.title.replace(' | TickGains', ''), description: c.content.description, path: c.content.path })
  },
  { immediate: true },
)
</script>
