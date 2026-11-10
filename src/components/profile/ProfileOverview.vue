<template>
  <div class="profile-overview">
    <OverviewWeek v-if="weekDays.length" :days="weekDays" :streak-info="streakInfo" :month-gain="monthGain" @day="(d) => $emit('day', d)" />
    <OverviewRecords :records="records" :today="recordsToday" :loading="recordsLoading" :name="player.displayName" @records="$emit('records')" />
    <OverviewSkillBoard :snapshot="latest" :days="weekDays" @skill="(s) => $emit('skill', s)" />
    <OverviewRoadToMax :snapshot="latest" />

    <div class="card">
      <h2>Skill highlights</h2>
      <div class="showcase-grid">
        <div v-for="s in showcase" :key="s.label" class="showcase-card">
          <img :src="skillIconSrc(s.skill)" :alt="s.skill" width="32" height="32" />
          <div>
            <span class="showcase-label">{{ s.label }}</span>
            <b>{{ s.skill }}</b>
            <span class="showcase-meta" :class="{ 'is-gain': s.gain }">{{ s.meta }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card" v-if="featured.length">
      <h2>Featured achievements</h2>
      <div class="achievement-row">
        <div v-for="a in featured" :key="a.key" class="achievement-chip">
          <img v-if="a.skill" :src="skillIconSrc(a.skill)" :alt="a.skill" width="24" height="24" />
          <span v-else class="achievement-total-icon">★</span>
          <div><b>{{ a.title }}</b><span v-if="dateLabel(a)">{{ dateLabel(a) }}</span></div>
        </div>
      </div>
    </div>

    <ProfileHistory compact :limit="3" :profile="profile" :snapshots="snapshots" @view-history="$emit('view-history')" />

    <div class="card">
      <div class="chart-header">
        <h2>XP progress</h2>
        <div class="range-tabs">
          <button v-for="r in ranges" :key="r.key" :class="{ active: range === r.key }" @click="range = r.key">{{ r.label }}</button>
        </div>
      </div>
      <XpLineChart v-if="chartPoints.length > 1" :points="chartPoints" aria-label="Total experience over time" />
      <p v-else class="empty-hint">Not enough history in this range yet.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import XpLineChart from '@/components/XpLineChart.vue'
import ProfileHistory from '@/components/profile/ProfileHistory.vue'
import OverviewWeek from '@/components/profile/OverviewWeek.vue'
import OverviewRecords from '@/components/profile/OverviewRecords.vue'
import OverviewSkillBoard from '@/components/profile/OverviewSkillBoard.vue'
import OverviewRoadToMax from '@/components/profile/OverviewRoadToMax.vue'
import { recordsApi } from '@/api/records'
import { skillIconSrc, formatXp } from '@/utils/osrsSkills'
import { highestSkill, mostXpSkill, featuredAchievements } from '@/utils/profile'

defineEmits(['view-history', 'day', 'skill', 'records'])
const props = defineProps({
  player: { type: Object, required: true },
  snapshots: { type: Array, required: true },
  profile: { type: Object, default: null },
  // The last 7 game days with per-skill gains (same numbers as the header chart and day recaps).
  weekDays: { type: Array, default: () => [] },
})

const latest = computed(() => props.snapshots[props.snapshots.length - 1])
const monthGain = computed(() => props.player.gains?.month?.xp || 0)

// Personal records, loaded once here and shared with the records section and the streak.
const records = ref([])
const recordsToday = ref('')
const recordsLoading = ref(true)
watch(
  () => props.player.username,
  async (name) => {
    recordsLoading.value = true
    try {
      const data = await recordsApi.get(name)
      records.value = data.records || []
      recordsToday.value = data.today || ''
    } catch {
      records.value = []
    } finally {
      recordsLoading.value = false
    }
  },
  { immediate: true },
)
const streakInfo = computed(() => {
  const r = records.value.find((x) => x.key === 'longest-streak')
  return r ? { current: r.current?.value ?? 0, longest: r.value } : null
})

const showcase = computed(() => {
  const list = []
  const hi = highestSkill(latest.value)
  if (hi) list.push({ label: 'Highest level', skill: hi.skill, meta: `Level ${hi.level} · ${formatXp(hi.xp)} XP${hi.rank > 0 ? ` · Rank ${hi.rank.toLocaleString('en-US')}` : ''}` })
  const top = mostXpSkill(latest.value)
  if (top) list.push({ label: 'Most XP', skill: top.skill, meta: `${formatXp(top.xp)} XP · Level ${top.level}` })
  const w = props.player.gains?.week
  if (w?.topSkill) list.push({ label: 'Top skill · 7 days', skill: w.topSkill, meta: `+${formatXp(w.topSkillXp)} XP`, gain: true })
  const m = props.player.gains?.month
  if (m?.topSkill) list.push({ label: 'Top skill · 30 days', skill: m.topSkill, meta: `+${formatXp(m.topSkillXp)} XP`, gain: true })
  return list
})

const featured = computed(() => featuredAchievements(props.profile?.achievements || []))
function dateLabel(a) {
  return a.dateKnown ? new Date(a.achievedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ''
}

const ranges = [
  { key: '7', label: '7 days', days: 7 },
  { key: '30', label: '30 days', days: 30 },
  { key: '90', label: '90 days', days: 90 },
  { key: 'all', label: 'All', days: null },
]
const range = ref('all')
const chartPoints = computed(() => {
  const r = ranges.find((x) => x.key === range.value)
  const cutoff = r.days ? Date.now() - r.days * 86_400_000 : 0
  const all = props.snapshots.map((s) => ({ x: new Date(s.capturedAt).getTime(), y: s.overallXp }))
  const inRange = all.filter((p) => p.x >= cutoff)
  if (!r.days) return inRange
  // The line starts exactly at the window's left edge, at the value the player had then
  // (interpolated from the snapshot just before the window), so a short range really is short
  // even when the previous snapshot is months old.
  const before = all.filter((p) => p.x < cutoff).pop()
  if (!before) return inRange
  const next = inRange[0]
  const edge = next ? { x: cutoff, y: before.y + ((next.y - before.y) * (cutoff - before.x)) / (next.x - before.x) } : { x: cutoff, y: before.y }
  const now = Date.now()
  // With no snapshot inside the window, hold the last known value to today.
  return next ? [edge, ...inRange] : [edge, { x: now, y: before.y }]
})
</script>
