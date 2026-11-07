<template>
  <div class="profile-overview">
    <div class="profile-stat-grid">
      <div class="card profile-stat"><span>Total level</span><b>{{ latest.overallLevel.toLocaleString() }}</b></div>
      <div class="card profile-stat"><span>Total XP</span><b>{{ latest.overallXp.toLocaleString() }}</b></div>
      <div class="card profile-stat"><span>Overall rank</span><b>{{ latest.overallRank > 0 ? latest.overallRank.toLocaleString() : '—' }}</b></div>
      <div class="card profile-stat"><span>Level 99 skills</span><b>{{ n99 }}</b></div>
      <div class="card profile-stat"><span>XP · last 7 days</span><b :class="{ 'stat-gain': weekGain }">{{ weekGain ? `+${weekGain.toLocaleString()}` : '—' }}</b></div>
      <div class="card profile-stat"><span>XP · last 30 days</span><b :class="{ 'stat-gain': monthGain }">{{ monthGain ? `+${monthGain.toLocaleString()}` : '—' }}</b></div>
    </div>

    <div class="card">
      <h2>Skill showcase</h2>
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

    <div class="card" v-if="recent.length">
      <h2>Recent milestones</h2>
      <ul class="milestone-list">
        <li v-for="m in recent" :key="m.key">
          <img v-if="m.skill" :src="skillIconSrc(m.skill)" :alt="m.skill" width="20" height="20" />
          <span class="milestone-title">{{ m.title }}</span>
          <span class="milestone-date">{{ new Date(m.occurredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}</span>
        </li>
      </ul>
      <p class="profile-note">Dates are when TickGains first saw the milestone in a saved snapshot.</p>
    </div>

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
import { computed, ref } from 'vue'
import XpLineChart from '@/components/XpLineChart.vue'
import { skillIconSrc, formatXp } from '@/utils/osrsSkills'
import { highestSkill, mostXpSkill, count99s, featuredAchievements } from '@/utils/profile'

const props = defineProps({
  player: { type: Object, required: true },
  snapshots: { type: Array, required: true },
  profile: { type: Object, default: null },
})

const latest = computed(() => props.snapshots[props.snapshots.length - 1])
const n99 = computed(() => count99s(latest.value))
const weekGain = computed(() => props.player.gains?.week?.xp || 0)
const monthGain = computed(() => props.player.gains?.month?.xp || 0)

const showcase = computed(() => {
  const list = []
  const hi = highestSkill(latest.value)
  if (hi) list.push({ label: 'Highest level', skill: hi.skill, meta: `Level ${hi.level} · ${formatXp(hi.xp)} XP${hi.rank > 0 ? ` · Rank ${hi.rank.toLocaleString()}` : ''}` })
  const top = mostXpSkill(latest.value)
  if (top) list.push({ label: 'Most XP', skill: top.skill, meta: `${formatXp(top.xp)} XP · Level ${top.level}` })
  const w = props.player.gains?.week
  if (w?.topSkill) list.push({ label: 'Top skill · 7 days', skill: w.topSkill, meta: `+${formatXp(w.topSkillXp)} XP`, gain: true })
  const m = props.player.gains?.month
  if (m?.topSkill) list.push({ label: 'Top skill · 30 days', skill: m.topSkill, meta: `+${formatXp(m.topSkillXp)} XP`, gain: true })
  return list
})

const featured = computed(() => featuredAchievements(props.profile?.achievements || []))
const recent = computed(() =>
  (props.profile?.timeline || [])
    .filter((t) => t.occurredAt)
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
    .slice(0, 5),
)
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
  // Keep the point just before the window so the line starts at the true value.
  const before = all.filter((p) => p.x < cutoff).pop()
  return before && r.days ? [before, ...inRange] : inRange
})
</script>
