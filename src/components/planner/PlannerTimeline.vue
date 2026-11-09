<template>
  <div class="planner-timeline">
    <div class="planner-compare-head">
      <b>Training timeline</b>
      <span>Estimates only. Skills are trained one after another in the order shown, at {{ hoursPerDay }} h/day.</span>
    </div>
    <p v-if="timeline.finishDate" class="ptl-finish">
      Estimated completion <b>{{ fmtDate(timeline.finishDate) }}</b> · about {{ formatDays(timeline.totalDays) }} remaining
    </p>
    <ol class="ptl-list">
      <li v-for="(e, i) in timeline.entries" :key="e.skill" class="ptl-item" :class="{ done: e.done }">
        <span class="ptl-dot" aria-hidden="true" />
        <div class="ptl-main">
          <div class="ptl-row">
            <img :src="skillIconSrc(e.skill)" :alt="e.skill" width="22" height="22" />
            <b>{{ e.skill }}</b>
            <span class="ptl-order">#{{ i + 1 }}</span>
            <span class="ptl-hours">{{ e.done ? 'Already there' : formatHours(e.hours) }}</span>
          </div>
          <div v-if="!e.done" class="ptl-dates">
            {{ fmtDate(e.startDate) }} → <b>{{ fmtDate(e.endDate) }}</b>
            <span v-if="e.netGp != null" class="ptl-gp" :class="e.netGp >= 0 ? 'planner-gain' : 'planner-cost'">{{ formatGp(e.netGp) }}</span>
            <span v-if="e.netGp != null" class="ptl-balance">running balance <i :class="e.balance >= 0 ? 'planner-gain' : 'planner-cost'">{{ formatGp(e.balance) }}</i></span>
          </div>
          <div v-if="e.milestones.length" class="ptl-milestones">
            <span v-for="m in e.milestones" :key="m.level" class="ptl-chip">Lvl {{ m.level }} · {{ fmtDate(m.date) }}</span>
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>

<script setup>
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatHours, formatGp } from '@/utils/planner'

defineProps({
  timeline: { type: Object, required: true },
  hoursPerDay: { type: Number, required: true },
})

const fmtDate = (d) => (d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-')
function formatDays(days) {
  if (days == null) return ''
  if (days < 1) return 'less than a day'
  const d = Math.ceil(days)
  return `${d.toLocaleString('en-US')} day${d === 1 ? '' : 's'}`
}
</script>
