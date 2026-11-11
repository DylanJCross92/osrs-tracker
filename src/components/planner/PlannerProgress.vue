<template>
  <section class="pp" :class="{ complete: progress.complete }" aria-label="Plan progress">
    <div class="pp-head">
      <b class="pp-pct">{{ progress.complete ? 'Plan complete' : `${pctText} complete` }}</b>
      <span v-if="progress.schedule && !progress.complete" class="pp-badge" :class="`is-${progress.schedule}`">{{ scheduleText }}</span>
      <span class="pp-xp">{{ formatNum(progress.gainedXp) }} XP gained · {{ formatNum(progress.remainingXp) }} left</span>
    </div>
    <!-- Where each skill's goal lands along the plan, in training order -->
    <div v-if="markers.length" class="pp-marks" :style="{ '--lanes': lanes }" aria-label="When each goal will be met">
      <span
        v-for="m in markers"
        :key="m.skill"
        class="pp-mark"
        :class="[{ done: m.done, on: hovered === m.skill }, m.align]"
        :style="{ left: m.pos + '%', '--lane': m.lane }"
        tabindex="0"
        role="img"
        :aria-label="m.label"
        @mouseenter="hovered = m.skill"
        @mouseleave="hovered = ''"
        @focus="hovered = m.skill"
        @blur="hovered = ''"
      >
        <img :src="skillIconSrc(m.skill)" :alt="m.skill" width="18" height="18" />
        <i v-if="m.done" class="pp-mark-tick" aria-hidden="true">✓</i>
        <span class="pp-tip" role="tooltip">
          <b>{{ m.skill }}</b>
          <span class="pp-tip-goal">{{ m.done ? 'Goal reached' : `Goal: level ${m.targetLevel}` }}</span>
          <span class="pp-tip-date">{{ m.done ? 'Complete' : m.dateText || 'Date unknown' }}</span>
          <span v-if="!m.done && m.inText" class="pp-tip-in">{{ m.inText }}</span>
        </span>
      </span>
    </div>
    <div class="pp-bar" role="progressbar" :aria-valuenow="Math.round(progress.pct * 100)" aria-valuemin="0" aria-valuemax="100" aria-label="Overall plan progress">
      <i :style="{ width: progress.pct * 100 + '%' }" />
      <!-- A break in the bar at the point each goal ends -->
      <span v-for="m in markers.filter((x) => x.pos < 99.5)" :key="`b-${m.skill}`" class="pp-break" :class="{ on: hovered === m.skill, done: m.done }" :style="{ left: m.pos + '%' }" aria-hidden="true" />
    </div>
    <p class="pp-meta">
      <span>{{ progress.completedGoals }} of {{ progress.goalCount }} goal{{ progress.goalCount === 1 ? '' : 's' }} complete</span>
      <span v-if="baselineAt">Started {{ fmtDate(baselineAt) }}</span>
      <span v-if="updatedAt">Stats updated {{ formatRelative(updatedAt) }}</span>
    </p>
    <p v-if="since" class="pp-since">
      <b>Since your last visit</b> ({{ formatRelative(since.at) }}): +{{ formatNum(since.total) }} XP
      <span v-for="s in since.skills.slice(0, 4)" :key="s.skill" class="pp-chip"><img :src="skillIconSrc(s.skill)" :alt="s.skill" width="14" height="14" />+{{ formatXp(s.gained) }}</span>
      <span v-if="since.skills.length > 4" class="pp-more">and {{ since.skills.length - 4 }} more</span>
    </p>
    <p class="pp-foot">
      Progress is measured from the stats this plan started with. Estimates are based on your latest tracked XP.
      <button class="btn-text" type="button" @click="$emit('rebase')">Restart from today's stats</button>
    </p>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatNum } from '@/utils/planner'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'

const props = defineProps({
  progress: { type: Object, required: true },
  updatedAt: { type: String, default: '' },
  baselineAt: { type: String, default: '' },
  since: { type: Object, default: null },
  // The timeline entries (same order as the goals), for each goal's finish date.
  entries: { type: Array, default: () => [] },
})
defineEmits(['rebase'])

// Each goal's finish sits at its share of the whole plan's XP, adding up goals in training order, so the last one ends the bar.
// Markers that would overlap move to another lane.
const hovered = ref('')
const MIN_GAP = 6.5
const markers = computed(() => {
  const per = props.progress.per
  const total = props.progress.totalXp
  if (!total || !per.length) return []
  let running = 0
  const laneEnds = []
  const out = []
  per.forEach((p, i) => {
    if (!p.total) return
    running += p.total
    const pos = Math.min(100, (running / total) * 100)
    let lane = laneEnds.findIndex((end) => pos - end >= MIN_GAP)
    if (lane === -1) lane = Math.min(laneEnds.length, 2)
    laneEnds[lane] = pos
    const end = props.entries[i]?.endDate
    const label = p.done ? `${p.skill}: level ${p.targetLevel} reached` : `${p.skill}: level ${p.targetLevel}${end ? ` by ${fmtDate(end)}` : ''}`
    // Keep the tooltip inside the card near either end.
    const align = pos > 82 ? 'tip-right' : pos < 18 ? 'tip-left' : ''
    out.push({ skill: p.skill, pos, lane, done: p.done, label, align, targetLevel: p.targetLevel, dateText: end ? fmtDate(end) : '', inText: end ? untilText(end) : '' })
  })
  return out
})
const lanes = computed(() => Math.max(1, ...markers.value.map((m) => m.lane + 1)))

const pctText = computed(() => {
  const p = props.progress.pct * 100
  return `${p > 0 && p < 10 ? p.toFixed(1) : Math.floor(p)}%`
})
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
function untilText(d) {
  const days = Math.ceil((new Date(d) - Date.now()) / 86_400_000)
  if (days < 1) return 'today'
  if (days < 60) return `in ${days} day${days === 1 ? '' : 's'}`
  if (days < 730) return `in about ${Math.round(days / 30)} months`
  return `in about ${(days / 365).toFixed(1)} years`
}
const scheduleText = computed(() => {
  const d = Math.abs(props.progress.aheadDays)
  const amount = d < 1 ? `${Math.max(1, Math.round(d * 24))} hours` : d < 60 ? `${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}` : `about ${Math.round(d / 30)} months`
  if (props.progress.schedule === 'ahead') return `${amount} ahead of schedule`
  if (props.progress.schedule === 'behind') return `${amount} behind schedule`
  return 'On schedule'
})
</script>
