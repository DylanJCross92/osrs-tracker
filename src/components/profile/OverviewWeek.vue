<template>
  <section class="card ov-week" aria-label="This week">
    <header class="ov-week-head">
      <div>
        <h2>This week</h2>
        <p class="ov-sub">Tap a day for its recap.</p>
      </div>
      <div class="ov-week-total">
        <b :class="{ 'stat-gain': total > 0 }">{{ total > 0 ? `+${total.toLocaleString('en-US')}` : '-' }}</b>
        <span>XP in 7 days<template v-if="monthGain > 0"> · <b class="stat-gain">+{{ formatXp(monthGain) }}</b> in 30</template></span>
      </div>
    </header>

    <div class="ov-week-body">
      <div class="ov-bars" role="list">
        <button v-for="d in bars" :key="d.key" type="button" role="listitem" class="ov-bar" :class="{ 'is-best': d.best, 'is-empty': d.xp === 0, 'is-today': d.today }" :aria-label="`${d.label}: ${d.xp > 0 ? '+' + d.xp.toLocaleString('en-US') + ' XP' : 'no XP'}. Open day recap`" @click="$emit('day', d.raw)">
          <span class="ov-bar-xp">{{ d.xp > 0 ? formatXp(d.xp) : '-' }}</span>
          <span class="ov-bar-track"><i :style="{ height: `${d.pct}%` }" /></span>
          <span class="ov-bar-day">{{ d.today ? 'Today' : d.label }}</span>
          <svg v-if="d.best" class="ov-bar-star" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7z" /></svg>
        </button>
      </div>

      <div class="ov-facts">
        <div class="ov-fact ov-streak" :class="{ 'is-lit': streak > 0 }">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in RECORD_ICONS.flame" :key="d" :d="d" /></svg>
          <span><b>{{ streak > 0 ? `${streak}-day streak` : 'No streak yet' }}</b><small>{{ streakNote }}</small></span>
        </div>
        <div class="ov-fact">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in RECORD_ICONS.calendar" :key="d" :d="d" /></svg>
          <span><b>{{ activeDays }} of {{ days.length }} days active</b><small>{{ activeDays === days.length ? 'Every single day' : 'Days with XP gained' }}</small></span>
        </div>
        <div v-if="topSkill" class="ov-fact">
          <img :src="skillIconSrc(topSkill.skill)" alt="" width="26" height="26" />
          <span><b>{{ topSkill.skill }} led the week</b><small class="stat-gain">+{{ formatXp(topSkill.xp) }} XP</small></span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { skillIconSrc, formatXp } from '@/utils/osrsSkills'
import { RECORD_ICONS } from '@/utils/recordText'

defineEmits(['day'])
const props = defineProps({
  // The chart's 7 days, oldest first: { key, label, xp, skills }.
  days: { type: Array, required: true },
  // Streak numbers from the records, when they have loaded: { current, longest }.
  streakInfo: { type: Object, default: null },
  monthGain: { type: Number, default: 0 },
})

const total = computed(() => props.days.reduce((s, d) => s + d.xp, 0))
const activeDays = computed(() => props.days.filter((d) => d.xp > 0).length)
const max = computed(() => Math.max(...props.days.map((d) => d.xp), 1))
const bestXp = computed(() => Math.max(...props.days.map((d) => d.xp), 0))

const bars = computed(() =>
  props.days.map((d, i) => ({
    key: d.key,
    label: d.label,
    xp: d.xp,
    raw: d,
    today: i === props.days.length - 1,
    best: d.xp > 0 && d.xp === bestXp.value && activeDays.value > 1,
    pct: d.xp > 0 ? Math.max((d.xp / max.value) * 100, 6) : 0,
  })),
)

// Days in a row with XP, counting back from today (a day still in progress does not break it).
const weekStreak = computed(() => {
  let n = 0
  let i = props.days.length - 1
  if (props.days[i] && props.days[i].xp === 0) i--
  while (i >= 0 && props.days[i].xp > 0) {
    n++
    i--
  }
  return n
})
const streak = computed(() => props.streakInfo?.current ?? weekStreak.value)
const streakNote = computed(() => {
  const longest = props.streakInfo?.longest
  if (streak.value === 0) return 'Gain some XP to start one'
  if (longest && streak.value >= longest) return 'Your longest yet'
  return longest ? `Longest: ${longest} ${longest === 1 ? 'day' : 'days'}` : 'Keep it going'
})

// The skill that gained the most XP over the week, from the same per-day numbers as the recaps.
const topSkill = computed(() => {
  const sums = {}
  for (const d of props.days) for (const s of d.skills || []) sums[s.skill] = (sums[s.skill] || 0) + s.xp
  const top = Object.entries(sums).sort((a, b) => b[1] - a[1])[0]
  return top ? { skill: top[0], xp: top[1] } : null
})
</script>
