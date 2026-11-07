<template>
  <div class="card">
    <div class="chart-header">
      <h2>Progression timeline</h2>
      <div class="range-tabs">
        <button :class="{ active: view === 'day' }" @click="view = 'day'">By day</button>
        <button :class="{ active: view === 'skill' }" @click="view = 'skill'">By skill</button>
      </div>
    </div>
    <div class="achievement-filters">
      <select v-model="skill"><option value="">All skills</option><option v-for="s in skills" :key="s">{{ s }}</option></select>
      <select v-model="category"><option value="">All categories</option><option v-for="c in categories" :key="c">{{ c }}</option></select>
    </div>

    <p v-if="!profile" class="empty-hint">Loading timeline…</p>
    <p v-else-if="!dayGroups.length && !preTracking.length" class="empty-hint">No milestones match yet.</p>

    <!-- By day: one block per day, skills collapsed into level ranges -->
    <div v-else-if="view === 'day'" class="history-days">
      <section v-for="d in visibleDays" :key="d.key" class="history-day">
        <header>
          <b>{{ d.label }}</b>
          <span>{{ d.summary }}</span>
        </header>
        <ul>
          <li v-for="r in d.rows" :key="r.id">
            <img v-if="r.skill" :src="skillIconSrc(r.skill)" :alt="r.skill" width="22" height="22" />
            <span v-else class="achievement-total-icon">★</span>
            <span class="history-row-title">{{ r.title }}</span>
            <span v-if="r.chip" class="history-chip">{{ r.chip }}</span>
          </li>
        </ul>
      </section>
      <button v-if="dayGroups.length > shownDays" class="btn btn-ghost" @click="shownDays += 10">Show earlier days ({{ dayGroups.length - shownDays }})</button>
    </div>

    <!-- By skill: one block per skill, its level-ups as dated ranges -->
    <div v-else class="history-skills">
      <section v-for="g in skillGroups" :key="g.skill || 'totals'" class="history-day">
        <header>
          <span class="history-skill-head">
            <img v-if="g.skill" :src="skillIconSrc(g.skill)" :alt="g.skill" width="22" height="22" />
            <b>{{ g.skill || 'Totals' }}</b>
          </span>
          <span>{{ g.summary }}</span>
        </header>
        <ul>
          <li v-for="r in g.rows" :key="r.id">
            <span class="history-row-date">{{ r.dateLabel }}</span>
            <span class="history-row-title">{{ r.title }}</span>
            <span v-if="r.chip" class="history-chip">{{ r.chip }}</span>
          </li>
        </ul>
      </section>
    </div>

    <div v-if="preTracking.length" class="history-pre">
      <b>Already reached when tracking began</b>
      <div>
        <span v-for="p in preTracking" :key="p.id" class="history-pre-chip">
          <img :src="skillIconSrc(p.skill)" :alt="p.skill" width="16" height="16" /> {{ p.skill }} {{ p.level }}
        </span>
      </div>
    </div>

    <p class="profile-note">
      Reconstructed from saved XP snapshots (including imported Wise Old Man history). A date is the first snapshot that showed the
      level or milestone — the real moment may be earlier. The earliest record{{ profile?.trackingStartedAt ? ` (${fmt(profile.trackingStartedAt)})` : '' }} is not the account's creation date.
    </p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { skillIconSrc, SKILL_NAMES } from '@/utils/osrsSkills'

const props = defineProps({
  profile: { type: Object, default: null },
  snapshots: { type: Array, default: () => [] },
})
const view = ref('day')
const skill = ref('')
const category = ref('')
const shownDays = ref(10)
watch([skill, category, view], () => (shownDays.value = 10))

const skills = SKILL_NAMES
const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const dayKey = (d) => new Date(d).toLocaleDateString('en-CA') // YYYY-MM-DD in the viewer's zone

// Every level gained per skill, from the snapshots (a level's date is the first
// snapshot showing it). Levels already held in a skill's earliest snapshot are
// returned separately as "pre-tracking" instead of dozens of undated rows.
const levelEvents = computed(() => {
  const list = props.snapshots
  const dated = []
  const pre = []
  if (!list.length) return { dated, pre }
  for (const name of SKILL_NAMES) {
    let prev = list[0].skills?.[name]?.level ?? 1
    if (prev > 1) pre.push({ id: `pre:${name}`, skill: name, level: prev })
    for (let i = 1; i < list.length; i++) {
      const level = list[i].skills?.[name]?.level ?? prev
      for (let l = prev + 1; l <= level; l++) dated.push({ skill: name, level: l, at: list[i].capturedAt, category: 'Skill Levels' })
      if (level > prev) prev = level
    }
  }
  return { dated, pre }
})

// Server milestones for XP / total level / total xp (levels come from above).
const otherEvents = computed(() =>
  (props.profile?.timeline || [])
    .filter((t) => t.type !== 'skill_level' && t.occurredAt)
    .map((t) => ({ id: t.key, title: t.title, skill: t.skill, category: t.category, at: t.occurredAt })),
)

const categories = computed(() => {
  const cats = new Set(['Skill Levels'])
  for (const e of otherEvents.value) cats.add(e.category)
  return [...cats]
})
const keep = (e) => (!skill.value || e.skill === skill.value) && (!category.value || e.category === category.value)

const preTracking = computed(() =>
  category.value && category.value !== 'Skill Levels' ? [] : levelEvents.value.pre.filter((p) => !skill.value || p.skill === skill.value),
)

// Collapse consecutive levels of one skill on one day into a single range row.
function levelRuns(events) {
  const runs = new Map()
  for (const e of events) {
    const key = `${dayKey(e.at)}|${e.skill}`
    const r = runs.get(key) || { day: dayKey(e.at), at: e.at, skill: e.skill, from: e.level, to: e.level }
    r.from = Math.min(r.from, e.level)
    r.to = Math.max(r.to, e.level)
    runs.set(key, r)
  }
  return [...runs.values()]
}
function runRow(r) {
  const n = r.to - r.from + 1
  return {
    id: `run:${r.day}:${r.skill}`,
    skill: r.skill,
    title: n === 1 ? `${r.skill} level ${r.to}` : `${r.skill} level ${r.from - 1} → ${r.to}`,
    chip: n === 1 ? 'new level' : `+${n} levels`,
    sort: r.to,
  }
}

const allRows = computed(() => {
  const runs = levelRuns(levelEvents.value.dated.filter(keep)).map((r) => ({ ...r, ...runRow(r), kind: 'level' }))
  const others = otherEvents.value.filter(keep).map((e) => ({ id: e.id, skill: e.skill, title: e.title, chip: 'milestone', day: dayKey(e.at), at: e.at, kind: 'milestone', sort: 1e12 }))
  return [...runs, ...others]
})

const dayGroups = computed(() => {
  const byDay = new Map()
  for (const r of allRows.value) {
    if (!byDay.has(r.day)) byDay.set(r.day, [])
    byDay.get(r.day).push(r)
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, rows]) => {
      const levels = rows.filter((r) => r.kind === 'level').reduce((n, r) => n + (Number(r.chip.replace(/\D/g, '')) || 1), 0)
      const bits = []
      if (levels) bits.push(`${levels} level${levels === 1 ? '' : 's'} gained`)
      const ms = rows.filter((r) => r.kind === 'milestone').length
      if (ms) bits.push(`${ms} milestone${ms === 1 ? '' : 's'}`)
      return { key, label: fmt(rows[0].at), summary: bits.join(' · '), rows: rows.sort((a, b) => b.sort - a.sort) }
    })
})
const visibleDays = computed(() => dayGroups.value.slice(0, shownDays.value))

const skillGroups = computed(() => {
  const by = new Map()
  for (const r of allRows.value) {
    const k = r.skill || ''
    if (!by.has(k)) by.set(k, [])
    by.get(k).push({ ...r, dateLabel: fmt(r.at) })
  }
  return [...by.entries()]
    .map(([name, rows]) => {
      rows.sort((a, b) => new Date(b.at) - new Date(a.at))
      const levels = rows.filter((r) => r.kind === 'level').reduce((n, r) => n + (Number(r.chip.replace(/\D/g, '')) || 1), 0)
      return { skill: name, rows, summary: levels ? `${levels} level${levels === 1 ? '' : 's'} gained` : `${rows.length} milestone${rows.length === 1 ? '' : 's'}`, latest: rows[0].at }
    })
    .sort((a, b) => new Date(b.latest) - new Date(a.latest))
})
</script>
