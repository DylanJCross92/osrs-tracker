<template>
  <section class="pp" :class="{ complete: progress.complete }" aria-label="Plan progress">
    <div class="pp-head">
      <b class="pp-pct">{{ progress.complete ? 'Plan complete' : `${pctText} complete` }}</b>
      <span v-if="progress.schedule && !progress.complete" class="pp-badge" :class="`is-${progress.schedule}`">{{ scheduleText }}</span>
      <span class="pp-xp">{{ formatNum(progress.gainedXp) }} XP gained · {{ formatNum(progress.remainingXp) }} left</span>
    </div>
    <div class="pp-bar" role="progressbar" :aria-valuenow="Math.round(progress.pct * 100)" aria-valuemin="0" aria-valuemax="100" aria-label="Overall plan progress">
      <i :style="{ width: progress.pct * 100 + '%' }" />
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
import { computed } from 'vue'
import { formatNum } from '@/utils/planner'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'

const props = defineProps({
  progress: { type: Object, required: true },
  updatedAt: { type: String, default: '' },
  baselineAt: { type: String, default: '' },
  since: { type: Object, default: null },
})
defineEmits(['rebase'])

const pctText = computed(() => {
  const p = props.progress.pct * 100
  return `${p > 0 && p < 10 ? p.toFixed(1) : Math.floor(p)}%`
})
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const scheduleText = computed(() => {
  const d = Math.abs(props.progress.aheadDays)
  const amount = d < 1 ? `${Math.max(1, Math.round(d * 24))} hours` : d < 60 ? `${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}` : `about ${Math.round(d / 30)} months`
  if (props.progress.schedule === 'ahead') return `${amount} ahead of schedule`
  if (props.progress.schedule === 'behind') return `${amount} behind schedule`
  return 'On schedule'
})
</script>
