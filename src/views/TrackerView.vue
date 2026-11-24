<template>
  <article class="trk-page" :class="{ 'has-bar': !loggedIn }">
    <header class="pgh">
      <div class="pgh-title">
        <h1>Quest and diary tracker</h1>
        <p class="pgh-sub">Tick off what you have done once. The planner uses it, skips XP you already took, and suggests what to do next. No account needed to start.</p>
      </div>
    </header>
    <!-- The three tips are for someone who has not used the tracker yet; once a quest or diary is ticked they go away. -->
    <div v-if="!inUse" class="trk-head">
      <ul class="trk-uses" aria-label="How your progress is used">
        <li>
          <span class="trk-uses-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg></span>
          <span><b>Methods marked ready</b><small>Gauntlets, Ancient Magicks, diary perks and more are counted once their quests and tiers are done.</small></span>
        </li>
        <li>
          <span class="trk-uses-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></svg></span>
          <span><b>Plans that skip what you did</b><small>Quest XP is never counted twice, and the Smart Planner leaves finished quests out.</small></span>
        </li>
        <li>
          <span class="trk-uses-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg></span>
          <span><b>A next step, always</b><small>The suggestions below rank what is left by what it opens up for you.</small></span>
        </li>
      </ul>
    </div>
    <TrackerPanel v-model:tab="tab" />
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { setPageMeta } from '@/utils/pageMeta'
import { useRequirements } from '@/composables/useRequirements'
import { useAuth } from '@/composables/useAuth'
import TrackerPanel from '@/components/tracker/TrackerPanel.vue'

setPageMeta({
  title: 'OSRS Quest and Achievement Diary Tracker',
  description: 'Free Old School RuneScape quest tracker and Achievement Diary checklist: tick off every quest and diary tier, see your quest points, and get suggestions for what to do next and which training methods they open up in the account planner.',
  path: '/quests',
})

const { questStats, diaryStats } = useRequirements()
const { loggedIn } = useAuth()
const inUse = computed(() => questStats.value.done > 0 || diaryStats.value.done > 0)

const route = useRoute()
const router = useRouter()
// The section is in the address (?tab=diaries), so a link can land on it and the back button works.
const tab = computed({
  get: () => (route.query.tab === 'diaries' ? 'diaries' : 'quests'),
  set: (v) => router.replace({ query: { ...route.query, tab: v === 'diaries' ? 'diaries' : undefined } }),
})
</script>
