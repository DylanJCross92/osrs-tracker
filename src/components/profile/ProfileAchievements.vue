<template>
  <div class="card">
    <div class="chart-header">
      <h2>Achievements <small class="profile-note">{{ doneCount }} / {{ achievements.length }} complete</small></h2>
    </div>
    <div class="achievement-filters">
      <select v-model="category"><option value="">All categories</option><option v-for="c in categories" :key="c">{{ c }}</option></select>
      <select v-model="status">
        <option value="all">All</option>
        <option value="done">Completed</option>
        <option value="todo">In progress</option>
      </select>
    </div>
    <p v-if="!profile" class="empty-hint">Loading achievements…</p>
    <div v-else class="achievement-grid">
      <div v-for="a in visible" :key="a.key" class="achievement-card" :class="{ done: a.completed }">
        <div class="achievement-head">
          <img v-if="a.skill" :src="skillIconSrc(a.skill)" :alt="a.skill" width="28" height="28" />
          <span v-else class="achievement-total-icon">★</span>
          <div>
            <b>{{ a.title }}</b>
            <span class="achievement-desc">{{ a.description }}</span>
          </div>
        </div>
        <div class="achievement-progress">
          <div class="level-progress-track"><div class="level-progress-fill" :style="{ width: `${a.progress * 100}%` }" /></div>
          <span v-if="a.completed">
            ✓ {{ a.dateKnown ? `Detected ${new Date(a.achievedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Achieved before tracking began' }}
          </span>
          <span v-else>{{ a.current.toLocaleString() }} / {{ a.value.toLocaleString() }} ({{ Math.floor(a.progress * 100) }}%)</span>
        </div>
      </div>
    </div>
    <button v-if="filtered.length > shown" class="btn btn-ghost" @click="shown += 24">Show more ({{ filtered.length - shown }})</button>
    <p class="profile-note">Achievements are calculated automatically from saved hiscores snapshots; dates are never guessed.</p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { skillIconSrc } from '@/utils/osrsSkills'

const props = defineProps({ profile: { type: Object, default: null } })
const achievements = computed(() => props.profile?.achievements || [])
const categories = computed(() => [...new Set(achievements.value.map((a) => a.category))])
const category = ref('')
const status = ref('all')
const shown = ref(24)
watch([category, status], () => (shown.value = 24))

const doneCount = computed(() => achievements.value.filter((a) => a.completed).length)
const filtered = computed(() =>
  achievements.value
    .filter((a) => (!category.value || a.category === category.value) && (status.value === 'all' || (status.value === 'done') === a.completed))
    // Completed first, then closest to completion.
    .sort((a, b) => Number(b.completed) - Number(a.completed) || b.progress - a.progress),
)
const visible = computed(() => filtered.value.slice(0, shown.value))
</script>
