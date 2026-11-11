<template>
  <section id="quests" class="card qt">
    <div class="acc-title">
      <h2>Quest tracker</h2>
      <span class="acc-status is-saved">Saved to your account</span>
    </div>
    <p class="acc-note">Tick the quests you have finished. The Account Planner uses this automatically: finished quests count as done for method requirements, and their XP is not counted again in quest shortcuts.</p>

    <div class="qt-summary">
      <div class="qt-total"><b>{{ stats.done }}</b> of {{ stats.total }} complete <span>({{ Math.floor(stats.pct * 100) }}%)</span></div>
      <div class="qt-bar" role="progressbar" :aria-valuenow="stats.done" aria-valuemin="0" :aria-valuemax="stats.total" aria-label="Quests completed"><i :style="{ width: stats.pct * 100 + '%' }" /></div>
      <div class="qt-types">
        <span v-for="(label, key) in QUEST_TYPES" :key="key">{{ label }}: <b>{{ stats.by[key].done }}</b>/{{ stats.by[key].total }}</span>
      </div>
    </div>

    <div class="qt-controls">
      <input v-model="search" type="search" name="quest-filter" placeholder="Search quests" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Search quests" data-1p-ignore data-lpignore="true" />
      <div class="range-tabs" role="group" aria-label="Show">
        <button v-for="t in STATUS_TABS" :key="t.key" type="button" :class="{ active: status === t.key }" @click="status = t.key">{{ t.label }}</button>
      </div>
      <div class="range-tabs" role="group" aria-label="Quest type">
        <button type="button" :class="{ active: type === '' }" @click="type = ''">All types</button>
        <button v-for="(label, key) in QUEST_TYPES" :key="key" type="button" :class="{ active: type === key }" @click="type = key">{{ label }}</button>
      </div>
    </div>

    <p v-if="!shown.length" class="acc-empty">No quests match.</p>
    <ul v-else class="qt-grid">
      <li v-for="q in shown" :key="q.slug">
        <label class="qt-item" :class="{ done: isDone(q) }">
          <input type="checkbox" :checked="isDone(q)" @change="toggle(q, $event.target.checked)" />
          <span class="qt-name">{{ q.name }}</span>
          <small v-if="state(q) === 'missing'" class="qt-note" title="You told the planner you have not done this quest. Ticking the box changes that.">marked not done</small>
          <small class="qt-type">{{ QUEST_TYPES[q.type] }}</small>
        </label>
      </li>
    </ul>

    <div class="qt-bulk">
      <button class="btn-text" type="button" :disabled="!shown.length || allShownDone" @click="markShown(true)">Mark the {{ shown.length }} shown as done</button>
      <button class="btn-text" type="button" :disabled="!shown.some(isDone)" @click="markShown(false)">Clear the shown</button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { QUEST_LIST, QUEST_TYPES } from '@/data/questList'
import { useRequirements } from '@/composables/useRequirements'
import { track } from '@/utils/analytics'

const { questStats: stats, questState, setQuestDone } = useRequirements()

const search = ref('')
const status = ref('all')
const type = ref('')
const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'todo', label: 'Not done' },
  { key: 'done', label: 'Done' },
]

const state = (q) => questState(q.name)
const isDone = (q) => state(q) === 'have'

const shown = computed(() => {
  const term = search.value.trim().toLowerCase()
  return QUEST_LIST.filter((q) => {
    if (type.value && q.type !== type.value) return false
    if (term && !q.name.toLowerCase().includes(term)) return false
    if (status.value === 'done' && !isDone(q)) return false
    if (status.value === 'todo' && isDone(q)) return false
    return true
  })
})
const allShownDone = computed(() => shown.value.every(isDone))

function toggle(q, checked) {
  setQuestDone(q.name, checked)
  track('quest_tracker_toggled', { enabled: checked })
}
function markShown(done) {
  for (const q of shown.value) if (isDone(q) !== done) setQuestDone(q.name, done)
  track('quest_tracker_bulk', { done, count: shown.value.length })
}
</script>
