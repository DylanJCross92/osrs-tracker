<template>
  <article class="trk-page">
    <header class="trk-head">
      <h1>Quest and diary tracker</h1>
      <p>Tick off the quests and Achievement Diary tiers you have finished. The Account Planner uses them: a method that needs a quest, a diary or an item they give is counted as ready, and a quest's XP is not counted twice. No account needed to start.</p>
    </header>
    <TrackerPanel v-model:tab="tab" />
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { setPageMeta } from '@/utils/pageMeta'
import TrackerPanel from '@/components/tracker/TrackerPanel.vue'

setPageMeta({
  title: 'OSRS Quest and Achievement Diary Tracker',
  description: 'Free Old School RuneScape quest tracker and Achievement Diary checklist: tick off every quest and diary tier, see the quest points you have, and which training methods they open up in the account planner.',
  path: '/quests',
})

const route = useRoute()
const router = useRouter()
// The section is in the address (?tab=diaries), so a link can land on it and the back button works.
const tab = computed({
  get: () => (route.query.tab === 'diaries' ? 'diaries' : 'quests'),
  set: (v) => router.replace({ query: { ...route.query, tab: v === 'diaries' ? 'diaries' : undefined } }),
})
</script>
