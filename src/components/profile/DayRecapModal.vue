<template>
  <div class="modal-overlay qp-overlay" @click.self="$emit('close')">
    <div class="modal-card dr-modal" role="dialog" aria-modal="true" :aria-label="`${title} recap`">
      <div class="dr-head">
        <div>
          <small>Day recap</small>
          <h2>{{ title }}</h2>
        </div>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <template v-if="day.xp > 0">
        <div class="dr-hero">
          <b class="stat-gain">+{{ day.xp.toLocaleString('en-US') }}</b>
          <span>XP gained</span>
        </div>

        <div class="dr-facts">
          <div class="dr-fact">
            <small>This week</small>
            <b>{{ rankText }}</b>
          </div>
          <div class="dr-fact">
            <small>Versus your 7-day average</small>
            <b :class="vsAverage >= 0 ? 'stat-gain' : ''">{{ vsAverage >= 0 ? '+' : '' }}{{ vsAverage }}%</b>
          </div>
        </div>

        <div v-if="recordState" class="dr-record" :class="{ 'is-record': recordState.isRecord }">
          <template v-if="recordState.isRecord">
            <span class="dr-record-icon" aria-hidden="true">🏆</span>
            <span class="dr-record-text"><b>Personal record day!</b> The biggest day TickGains has tracked for {{ displayName }}.</span>
          </template>
          <template v-else>
            <span class="dr-record-text">
              <b>{{ recordState.pct }}% of the record day</b>
              <small>{{ formatXp(recordState.value) }} XP on {{ recordState.date }}</small>
            </span>
            <span class="dr-record-bar" aria-hidden="true"><i :style="{ width: recordState.pct + '%' }" /></span>
          </template>
          <button class="btn btn-ghost dr-record-btn" type="button" @click="$emit('records')">See records</button>
        </div>

        <h3 class="dr-sub">Skills trained <small>{{ day.skills.length }}</small></h3>
        <ul class="dr-skills">
          <li v-for="s in day.skills" :key="s.skill">
            <img :src="skillIconSrc(s.skill)" alt="" width="22" height="22" />
            <span class="dr-skill-main">
              <span class="dr-skill-name">{{ s.skill }}<em v-if="s.levels > 0" class="dr-lvl">+{{ s.levels }} {{ s.levels === 1 ? 'level' : 'levels' }}</em></span>
              <span class="dr-skill-bar" aria-hidden="true"><i :style="{ width: Math.max((s.xp / day.xp) * 100, 2) + '%' }" /></span>
              <small class="dr-skill-total">Level {{ s.level }} · {{ s.total.toLocaleString('en-US') }} XP total</small>
            </span>
            <b class="stat-gain">+{{ s.xp.toLocaleString('en-US') }}</b>
          </li>
        </ul>
      </template>

      <p v-else class="empty-hint dr-empty">No XP gained on this day.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { recordsApi } from '@/api/records'
import { skillIconSrc, formatXp } from '@/utils/osrsSkills'
import { formatGameDay } from '@/utils/gameDay'
import { track } from '@/utils/analytics'

const props = defineProps({
  day: { type: Object, required: true },
  // All 7 days of the chart, oldest first, to rank this one against.
  days: { type: Array, required: true },
  username: { type: String, required: true },
  displayName: { type: String, default: '' },
})
const emit = defineEmits(['close', 'records'])

const title = computed(() => formatGameDay(props.day.key, { weekday: 'long', month: 'short', day: 'numeric' }))

const ordinal = (n) => {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]}`
}
const active = computed(() => props.days.filter((d) => d.xp > 0))
const rankText = computed(() => {
  if (active.value.length < 2) return 'Only active day'
  const rank = active.value.filter((d) => d.xp > props.day.xp).length + 1
  return rank === 1 ? 'Biggest day of the week' : `${ordinal(rank)} biggest of ${active.value.length} active days`
})
const vsAverage = computed(() => {
  const avg = props.days.reduce((s, d) => s + d.xp, 0) / props.days.length
  return avg > 0 ? Math.round((props.day.xp / avg - 1) * 100) : 0
})

// The all-time best day, from the same numbers as the Records tab.
const best = ref(null)
const recordState = computed(() => {
  if (!best.value || !(best.value.value > 0)) return null
  const isRecord = best.value.end === props.day.key || props.day.xp >= best.value.value
  return {
    isRecord,
    value: best.value.value,
    pct: Math.min(Math.round((props.day.xp / best.value.value) * 100), 100),
    date: formatGameDay(best.value.end),
  }
})

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(async () => {
  document.addEventListener('keydown', onKey)
  track('day_recap_open', { active: props.day.xp > 0 })
  try {
    const data = await recordsApi.get(props.username)
    best.value = data.records?.find((r) => r.key === 'best-day') || null
  } catch {
    // The recap still works without the record comparison.
  }
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
