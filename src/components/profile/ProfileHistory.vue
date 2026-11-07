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
      <li v-for="e in visible" :key="e.key">
        <span class="timeline-dot" />
        <img v-if="e.skill" :src="skillIconSrc(e.skill)" :alt="e.skill" width="22" height="22" />
        <div>
          <b>{{ e.title }}</b>
          <span class="timeline-date">
            <template v-if="e.occurredAt">Detected {{ new Date(e.occurredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}</template>
            <template v-else>Before tracking began{{ profile.trackingStartedAt ? ` (${new Date(profile.trackingStartedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})` : '' }}</template>
          </span>
        </div>
      </li>
    </ol>
    <button v-if="events.length > shown" class="btn btn-ghost" @click="shown += 20">Show more ({{ events.length - shown }})</button>
    <p class="profile-note">
      Reconstructed from saved XP snapshots (including imported Wise Old Man history). A date is the first snapshot that showed the
      milestone — the real moment may be earlier — and milestones already reached when tracking began carry no date.
      The earliest record{{ profile?.trackingStartedAt ? ` (${new Date(profile.trackingStartedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})` : '' }} is not the account's creation date.
    </p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { skillIconSrc, SKILL_NAMES } from '@/utils/osrsSkills'

const props = defineProps({ profile: { type: Object, default: null } })
const skill = ref('')
const category = ref('')
const shown = ref(20)
watch([skill, category], () => (shown.value = 20))

const skills = SKILL_NAMES
const categories = computed(() => [...new Set((props.profile?.timeline || []).map((t) => t.category))])
const events = computed(() =>
  (props.profile?.timeline || [])
    .filter((t) => (!skill.value || t.skill === skill.value) && (!category.value || t.category === category.value))
    // Newest first; undated (pre-tracking) milestones sink to the bottom.
    .sort((a, b) => (b.occurredAt ? new Date(b.occurredAt).getTime() : -1) - (a.occurredAt ? new Date(a.occurredAt).getTime() : -1)),
)
const visible = computed(() => events.value.slice(0, shown.value))
</script>
