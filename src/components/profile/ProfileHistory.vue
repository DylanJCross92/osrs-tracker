<template>
  <div class="card">
    <h2>Progression timeline</h2>
    <div class="achievement-filters">
      <select v-model="skill"><option value="">All skills</option><option v-for="s in skills" :key="s">{{ s }}</option></select>
      <select v-model="category"><option value="">All categories</option><option v-for="c in categories" :key="c">{{ c }}</option></select>
    </div>
    <p v-if="!profile" class="empty-hint">Loading timeline…</p>
    <p v-else-if="!events.length" class="empty-hint">No milestones match yet.</p>
    <ol v-else class="timeline">
      <li v-for="e in visible" :key="e.id">
        <span class="timeline-dot" />
        <img v-if="e.skill" :src="skillIconSrc(e.skill)" :alt="e.skill" width="22" height="22" />
        <div>
          <b>{{ e.title }}</b>
          <span class="timeline-date">
            <template v-if="e.occurredAt">Detected {{ fmt(e.occurredAt) }}</template>
            <template v-else>{{ e.undatedNote || 'Before tracking began' }}</template>
          </span>
        </div>
      </li>
    </ol>
    <button v-if="events.length > shown" class="btn btn-ghost" @click="shown += 30">Show more ({{ events.length - shown }})</button>
    <p class="profile-note">
      Reconstructed from saved XP snapshots (including imported Wise Old Man history). A date is the first snapshot that showed the
      milestone — the real moment may be earlier — and levels already reached when tracking began carry no date.
      The earliest record{{ profile?.trackingStartedAt ? ` (${fmt(profile.trackingStartedAt)})` : '' }} is not the account's creation date.
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
const skill = ref('')
const category = ref('')
const shown = ref(30)
watch([skill, category], () => (shown.value = 30))

const skills = SKILL_NAMES
const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

// Every level gained, per skill, straight from the snapshots: a level's date
// is the first snapshot showing it. Levels already reached in a skill's
// earliest snapshot collapse into a single "already level N" line instead of
// N undated rows.
const levelEvents = computed(() => {
  const list = props.snapshots
  if (!list.length) return []
  const events = []
  for (const name of SKILL_NAMES) {
    let prev = list[0].skills?.[name]?.level ?? 1
    if (prev > 1) {
      events.push({ id: `pre:${name}`, title: `Already level ${prev} ${name}`, skill: name, category: 'Skill Levels', occurredAt: null, undatedNote: 'When tracking began', sort: -prev })
    }
    for (let i = 1; i < list.length; i++) {
      const level = list[i].skills?.[name]?.level ?? prev
      for (let l = prev + 1; l <= level; l++) {
        events.push({ id: `lvl:${name}:${l}`, title: `Reached level ${l} ${name}`, skill: name, category: 'Skill Levels', occurredAt: list[i].capturedAt, sort: l })
      }
      if (level > prev) prev = level
    }
  }
  return events
})

// Server milestones for XP / total level / total xp (skill levels come from above).
const otherEvents = computed(() =>
  (props.profile?.timeline || [])
    .filter((t) => t.type !== 'skill_level')
    .map((t) => ({ id: t.key, title: t.title, skill: t.skill, category: t.category, occurredAt: t.occurredAt, sort: t.value })),
)

const all = computed(() => [...levelEvents.value, ...otherEvents.value])
const categories = computed(() => [...new Set(all.value.map((t) => t.category))])
const events = computed(() =>
  all.value
    .filter((t) => (!skill.value || t.skill === skill.value) && (!category.value || t.category === category.value))
    // Newest first; within the same moment, higher levels first; undated sink to the bottom.
    .sort((a, b) => {
      const ta = a.occurredAt ? new Date(a.occurredAt).getTime() : -1
      const tb = b.occurredAt ? new Date(b.occurredAt).getTime() : -1
      return tb - ta || b.sort - a.sort
    }),
)
const visible = computed(() => events.value.slice(0, shown.value))
</script>
