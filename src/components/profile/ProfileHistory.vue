<template>
  <div class="card">
    <div class="chart-header">
      <h2>{{ compact ? 'Recent milestones' : 'Progression timeline' }}</h2>
      <button v-if="compact" class="btn-text" @click="$emit('view-history')">View full history →</button>
      <div v-else class="range-tabs">
        <button :class="{ active: view === 'day' }" @click="view = 'day'">By day</button>
        <button :class="{ active: view === 'skill' }" @click="view = 'skill'">By skill</button>
      </div>
    </div>
    <div v-if="!compact" class="achievement-filters">
      <select v-model="skill"><option value="">All skills</option><option v-for="s in skills" :key="s">{{ s }}</option></select>
      <select v-model="category"><option value="">All categories</option><option v-for="c in categories" :key="c">{{ c }}</option></select>
    </div>

    <p v-if="!profile" class="empty-hint">Loading timeline…</p>
    <p v-else-if="!dayGroups.length && !preTracking.length" class="empty-hint">No milestones match yet.</p>

    <!-- By day: one block per day, skills collapsed into level ranges -->
    <div v-else-if="view === 'day' || compact" class="history-days">
      <section v-for="d in visibleDays" :key="d.key" class="history-day" :class="{ 'history-gap': d.gap }">
        <header>
          <b>{{ d.label }}</b>
          <span>{{ d.summary }}</span>
        </header>
        <p v-if="d.gap" class="history-gap-note">Exact days unknown, there is no saved data between these dates, so these happened somewhere within the range.</p>
        <ul>
          <li v-for="r in d.rows" :key="r.id">
            <img v-if="r.skill" :src="skillIconSrc(r.skill)" :alt="r.skill" width="22" height="22" />
            <span v-else class="achievement-total-icon">★</span>
            <span class="history-row-title">{{ r.title }}</span>
            <span v-if="r.chip" class="history-chip">{{ r.chip }}</span>
          </li>
        </ul>
      </section>
      <button v-if="!compact && dayGroups.length > shownDays" class="btn btn-ghost" @click="shownDays += 10">Show earlier days ({{ dayGroups.length - shownDays }})</button>
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
            <span class="history-row-date" :class="{ 'is-range': r.gap }">{{ r.dateLabel }}</span>
            <span class="history-row-title">{{ r.title }}</span>
            <span v-if="r.chip" class="history-chip">{{ r.chip }}</span>
          </li>
        </ul>
      </section>
    </div>

    <div v-if="!compact && preTracking.length" class="history-pre">
      <b>Already reached when tracking began</b>
      <div>
        <span v-for="p in preTracking" :key="p.id" class="history-pre-chip">
          <img :src="skillIconSrc(p.skill)" :alt="p.skill" width="16" height="16" /> {{ p.skill }} {{ p.level }}
        </span>
      </div>
    </div>

    <p v-if="!compact" class="profile-note">
      Reconstructed from saved XP snapshots (including imported Wise Old Man history). Where saved data is sparse, changes are shown as a date range instead of a single day. The earliest record{{ profile?.trackingStartedAt ? ` (${fmt(profile.trackingStartedAt)})` : '' }} is not the account's creation date.
    </p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { skillIconSrc, SKILL_NAMES } from '@/utils/osrsSkills'
import { gameDay, formatGameDay } from '@/utils/gameDay'

const props = defineProps({
  profile: { type: Object, default: null },
  snapshots: { type: Array, default: () => [] },
  // Overview preview: newest few day-blocks only, no filters/notes.
  compact: { type: Boolean, default: false },
  limit: { type: Number, default: 3 },
})
defineEmits(['view-history'])
const view = ref('day')
const skill = ref('')
const category = ref('')
const shownDays = ref(10)
watch([skill, category, view], () => (shownDays.value = 10))

const skills = SKILL_NAMES
// Days are 6 AM to 6 AM Eastern, so a snapshot at 3 AM still belongs to the previous day.
const fmt = (d) => formatGameDay(gameDay(d), { month: 'short', day: 'numeric', year: 'numeric' })
const fmtShort = (d) => formatGameDay(gameDay(d), { month: 'short', day: 'numeric' })
const sameYear = (a, b) => gameDay(a).slice(0, 4) === gameDay(b).slice(0, 4)
const dayKey = (d) => gameDay(d)

// When two consecutive snapshots are further apart than this, whatever changed
// between them can't be pinned to a day, it happened *somewhere in the gap*
// (typical for sparse imported history before daily tracking began).
const GAP_MS = 48 * 3_600_000
const isGap = (after, at) => after != null && new Date(at) - new Date(after) > GAP_MS

// Every level gained per skill, from the snapshots. Levels already held in a
// skill's earliest snapshot are returned separately ("pre-tracking").
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
      for (let l = prev + 1; l <= level; l++) {
        dated.push({ skill: name, level: l, at: list[i].capturedAt, after: list[i - 1].capturedAt, category: 'Skill Levels' })
      }
      if (level > prev) prev = level
    }
  }
  return { dated, pre }
})

// Server milestones for XP / total level / total xp (levels come from above).
const otherEvents = computed(() =>
  (props.profile?.timeline || [])
    .filter((t) => t.type !== 'skill_level' && t.occurredAt)
    .map((t) => ({ id: t.key, title: t.title, skill: t.skill, category: t.category, at: t.occurredAt, after: t.occurredAfter })),
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

// Where an event belongs: an exact day, or the whole gap between two snapshots.
function placement(at, after) {
  if (isGap(after, at)) {
    return {
      gap: true,
      group: `gap:${dayKey(after)}|${dayKey(at)}`,
      label: `${sameYear(after, at) ? fmtShort(after) : fmt(after)} → ${fmt(at)}`,
      dateLabel: `${sameYear(after, at) ? fmtShort(after) : fmt(after)} – ${fmtShort(at)}`,
    }
  }
  return { gap: false, group: `day:${dayKey(at)}`, label: fmt(at), dateLabel: fmt(at) }
}

// Collapse consecutive levels of one skill within one placement into a single range row.
function levelRuns(events) {
  const runs = new Map()
  for (const e of events) {
    const pl = placement(e.at, e.after)
    const key = `${pl.group}|${e.skill}`
    const r = runs.get(key) || { ...pl, at: e.at, skill: e.skill, from: e.level, to: e.level }
    r.from = Math.min(r.from, e.level)
    r.to = Math.max(r.to, e.level)
    runs.set(key, r)
  }
  return [...runs.values()]
}
function runRow(r) {
  const n = r.to - r.from + 1
  return {
    id: `run:${r.group}:${r.skill}`,
    skill: r.skill,
    title: n === 1 ? `${r.skill} level ${r.to}` : `${r.skill} level ${r.from - 1} → ${r.to}`,
    chip: n === 1 ? 'new level' : `+${n} levels`,
    sort: r.to,
  }
}

const allRows = computed(() => {
  const runs = levelRuns(levelEvents.value.dated.filter(keep)).map((r) => ({ ...r, ...runRow(r), kind: 'level' }))
  const others = otherEvents.value.filter(keep).map((e) => {
    const pl = placement(e.at, e.after)
    return { ...pl, id: e.id, skill: e.skill, title: e.title, chip: 'milestone', at: e.at, kind: 'milestone', sort: 1e12 }
  })
  return [...runs, ...others]
})

const countLevels = (rows) => rows.filter((r) => r.kind === 'level').reduce((n, r) => n + (Number(r.chip.replace(/\D/g, '')) || 1), 0)

const dayGroups = computed(() => {
  const by = new Map()
  for (const r of allRows.value) {
    if (!by.has(r.group)) by.set(r.group, [])
    by.get(r.group).push(r)
  }
  return [...by.entries()]
    .map(([key, rows]) => {
      const levels = countLevels(rows)
      const ms = rows.filter((r) => r.kind === 'milestone').length
      const bits = []
      if (levels) bits.push(`${levels} level${levels === 1 ? '' : 's'} gained`)
      if (ms) bits.push(`${ms} milestone${ms === 1 ? '' : 's'}`)
      return { key, gap: rows[0].gap, label: rows[0].label, summary: bits.join(' · '), at: rows[0].at, rows: rows.sort((a, b) => b.sort - a.sort) }
    })
    .sort((a, b) => new Date(b.at) - new Date(a.at))
})
const visibleDays = computed(() => dayGroups.value.slice(0, props.compact ? props.limit : shownDays.value))

const skillGroups = computed(() => {
  const by = new Map()
  for (const r of allRows.value) {
    const k = r.skill || ''
    if (!by.has(k)) by.set(k, [])
    by.get(k).push({ ...r })
  }
  return [...by.entries()]
    .map(([name, rows]) => {
      rows.sort((a, b) => new Date(b.at) - new Date(a.at))
      const levels = countLevels(rows)
      return { skill: name, rows, summary: levels ? `${levels} level${levels === 1 ? '' : 's'} gained` : `${rows.length} milestone${rows.length === 1 ? '' : 's'}`, latest: rows[0].at }
    })
    .sort((a, b) => new Date(b.latest) - new Date(a.latest))
})
</script>
