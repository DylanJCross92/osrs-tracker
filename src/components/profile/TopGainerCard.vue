<template>
  <section v-if="stats && stats.days > 0" class="card tg" aria-label="Days as top gainer">
    <span class="tg-ico" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path v-for="d in RECORD_ICONS.trophy" :key="d" :d="d" /></svg>
    </span>
    <div class="tg-main">
      <p class="tg-kicker">Top gainer</p>
      <p class="tg-count"><b>{{ headline.display }}</b> {{ headline.label }}</p>
      <p class="tg-meta">
        <span v-if="stats.tenure" class="tg-live"><i aria-hidden="true" />{{ tenureLine }}</span>
        <span v-if="stats.streak > 1 && !stats.tenure">{{ stats.streak }} in a row</span>
        <span v-if="stats.bestXp > 0">Best +{{ formatXp(stats.bestXp) }} XP</span>
      </p>
    </div>
    <button class="tg-share" type="button" aria-label="Share your top gainer days" title="Share" @click="open = true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in RECORD_ICONS.share" :key="d" :d="d" /></svg>
      <span>Share</span>
    </button>
  </section>

  <TopGainerShareModal v-if="open" :username="username" :display-name="displayName" :stats="stats" @close="open = false" />
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import TopGainerShareModal from '@/components/profile/TopGainerShareModal.vue'
import { topGainerApi } from '@/api/topGainer'
import { formatXp } from '@/utils/osrsSkills'
import { RECORD_ICONS } from '@/utils/recordText'

// How many days this player has been the top gainer on Discover. Shows nothing until they have been one.
const props = defineProps({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
})

const stats = ref(null)
// The headline is the hours on someone's first day at the top, otherwise the total days; the line under it says how long
// the current lead has lasted (in hours while it is under a day, in days after).
const headline = computed(() => stats.value?.headline || { display: String(stats.value?.days ?? 0), label: stats.value?.days === 1 ? 'day' : 'days', text: '' })
const tenureLine = computed(() => {
  const t = stats.value?.tenure
  if (!t) return ''
  // The same figure as the headline would only repeat it.
  return t.text === headline.value.text ? 'Leading now' : `Top gainer for ${t.text}`
})
const open = ref(false)
let stamp = 0
watch(
  () => props.username,
  async (name) => {
    const id = ++stamp
    try {
      const res = await topGainerApi.get(name)
      if (id === stamp) stats.value = res
    } catch {
      if (id === stamp) stats.value = null
    }
  },
  { immediate: true },
)
</script>
