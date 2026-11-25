<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card plans-modal" role="dialog" aria-modal="true" aria-labelledby="plans-modal-h">
      <div class="share-modal-header">
        <h2 id="plans-modal-h">Choose a plan</h2>
        <button ref="closeBtn" class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>
      <p class="pm-sub">{{ hasPlayer ? `Worked out from ${playerLabel}'s stats.` : 'Every skill starts from level 1 until you add your name.' }} One tap sets up every goal.</p>

      <div v-if="tabs.length > 1" class="pm-tabs" role="tablist" aria-label="Kinds of plan">
        <button v-for="t in tabs" :key="t.key" type="button" role="tab" :aria-selected="current.key === t.key" :class="{ active: current.key === t.key }" @click="tab = t.key">
          {{ t.label }}<small>{{ t.hint }}</small>
        </button>
      </div>

      <ul class="pm-list">
        <li v-for="r in rows" :key="r.id" class="pm-row" :class="`kind-${r.kind}`">
          <div class="pm-head">
            <span class="pm-ico" :class="`is-${iconOf(r)}`" aria-hidden="true">
              <svg v-if="iconOf(r) === 'combat'" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2" /><path d="M9.5 6.5L21 18v3h-3L6.5 9.5M11 5L5 11M8 8L4 4M5 3L3 5" /></svg>
              <svg v-else-if="iconOf(r) === 'max'" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3" /></svg>
              <svg v-else-if="iconOf(r) === 'total'" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V14M10 20V9M16 20V12M22 20V4" /></svg>
              <svg v-else viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 4-9 4-9-4zM3 12l9 4 9-4M3 16l9 4 9-4" /></svg>
            </span>
            <div class="pm-main">
              <b><button class="rp-open" type="button" aria-haspopup="dialog" :title="`Open ${r.title} without saving it`" @click="$emit('open', r)">{{ r.title }}</button></b>
              <small>{{ short(r) }}</small>
              <span class="pm-skills" aria-hidden="true">
                <img v-for="g in r.goals.slice(0, MAX_ICONS)" :key="g.skill" :src="skillIconSrc(g.skill)" :alt="g.skill" width="18" height="18" :title="g.skill" />
                <i v-if="r.goals.length > MAX_ICONS">+{{ r.goals.length - MAX_ICONS }}</i>
              </span>
            </div>
          </div>
          <dl class="pm-meta">
            <div><dt>Skills</dt><dd>{{ r.skillCount }}</dd></div>
            <div><dt>Time</dt><dd>{{ formatHours(summaries[r.id].totalHours) }}</dd></div>
            <div><dt>At {{ hoursPerDay }} h/day</dt><dd>{{ summaries[r.id].days != null ? formatDays(summaries[r.id].days) : formatHours(summaries[r.id].totalHours) }}</dd></div>
          </dl>
          <button class="btn btn-primary pm-use" type="button" @click="$emit('use', r)">Use plan</button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatDays, formatHours } from '@/utils/planner'
import { summarizePlan } from '@/utils/plannerTools'
import { groupedPlans, recommendedPlans } from '@/utils/recommendedPlans'

const props = defineProps({
  account: { type: Object, default: () => ({ members: true, iron: false, ironKind: 'standard', build: 'main' }) },
  skills: { type: Object, default: null },
  hasPlayer: { type: Boolean, default: false },
  playerLabel: { type: String, default: '' },
  hoursPerDay: { type: Number, default: 2 },
  globalStrategy: { type: String, default: 'auto-fast' },
  gpValue: { type: Number, default: 2_000_000 },
})
const emit = defineEmits(['close', 'use', 'open'])

const groups = computed(() => groupedPlans(recommendedPlans(props.skills, props.account)))
const tabs = computed(() =>
  [
    { key: 'skills', label: 'Skill goals', hint: 'a level in every skill', plans: groups.value.skills },
    { key: 'totals', label: 'Total level', hint: 'the cheapest levels first', plans: groups.value.totals },
  ].filter((t) => t.plans.length),
)
const tab = ref('')
const current = computed(() => tabs.value.find((t) => t.key === tab.value) || tabs.value[0])
const rows = computed(() => current.value?.plans || [])
// Only the plans on show are worked out, so switching tabs is the only extra cost.
const summaries = computed(() => Object.fromEntries(rows.value.map((r) => [r.id, summarizePlan({ goals: r.goals, globalStrategy: props.globalStrategy, gpValue: props.gpValue, hoursPerDay: props.hoursPerDay })])))
// One short line: the first sentence of the description.
const short = (r) => (r.description.split(/\.\s/)[0] || r.description).replace(/\.$/, '')

const MAX_ICONS = 8
// Which picture a plan gets: the finish line goals, combat, a total level, or a plain level goal.
const iconOf = (r) => (r.kind === 'combat' ? 'combat' : r.kind === 'total' ? (r.title.startsWith('Max total') ? 'max' : 'total') : r.id === 'all-99' || r.id.startsWith('virtual') || r.id === 'xp-200m' ? 'max' : 'levels')

const closeBtn = ref(null)
const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => {
  document.addEventListener('keydown', onKey)
  closeBtn.value?.focus()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
