<template>
  <section class="pp" :class="{ complete: progress.complete }" aria-label="Plan progress">
    <div class="pp-head">
      <b class="pp-pct">
        <template v-if="focusPer"><img :src="skillIconSrc(focusPer.skill)" alt="" width="20" height="20" />{{ view.complete ? `${focusPer.skill} complete` : `${focusPer.skill} ${pctText} complete` }}</template>
        <template v-else>{{ view.complete ? 'Plan complete' : `${pctText} complete` }}</template>
      </b>
      <span v-if="badge && !view.complete" class="pp-badge" :class="`is-${badge.kind}`">{{ badge.text }}</span>
      <button v-if="focusPer" class="pp-focus" type="button" @click="$emit('focus', '')">Show all skills</button>
      <span class="pp-xp">{{ formatNum(view.gainedXp) }} XP gained · {{ formatNum(view.remainingXp) }} left</span>
    </div>

    <!-- Your pace in the skill being trained, against what the plan needs -->
    <div v-if="series && !view.complete" class="pc-glance">
      <div v-if="gauge" class="pc-g">
        <div class="pc-g-head">
          <span>{{ gauge.skill }} pace</span>
          <b v-if="gauge.pace != null">{{ formatXp(gauge.pace) }}<template v-if="gauge.need">{{ ' ' }}<i>of</i>{{ ' ' }}{{ formatXp(gauge.need) }}</template>{{ ' ' }}<small>XP/day</small></b>
          <b v-else>needs {{ formatXp(gauge.need) }} <small>XP/day</small></b>
        </div>
        <div class="pc-gauge" :class="`is-${gauge.kind}`" role="img" :aria-label="gauge.note">
          <i v-if="gauge.pacePct != null" class="pc-gauge-fill" :style="{ width: gauge.pacePct + '%' }" />
          <i v-if="gauge.needPct != null" class="pc-gauge-need" :style="{ left: gauge.needPct + '%' }" title="What the plan needs each day" />
        </div>
        <p class="pc-g-note" :class="`is-${gauge.kind}`">{{ gauge.note }}</p>
      </div>
    </div>

    <PlannerPaceChart v-if="series && !view.complete" :series="series" />

    <!-- One slice per skill, as wide as it takes to train, filled as it gets done -->
    <div class="pc-seg-wrap">
      <div class="pc-segs" role="group" aria-label="Progress by skill">
        <component
          :is="canFocus ? 'button' : 'span'"
          v-for="s in segments"
          :key="s.skill"
          class="pc-seg"
          :class="{ done: s.done, clickable: canFocus, active: focus === s.skill, dim: focus && focus !== s.skill }"
          :style="{ flexGrow: s.share }"
          :type="canFocus ? 'button' : null"
          :aria-pressed="canFocus ? focus === s.skill : null"
          :aria-label="canFocus ? `${s.label}. ${focus === s.skill ? 'Show every skill' : `Show only ${s.skill}`}` : s.label"
          :title="canFocus ? `${s.label}. ${focus === s.skill ? 'Click to show every skill' : `Click to show only ${s.skill}`}` : s.label"
          @click="canFocus && $emit('focus', focus === s.skill ? '' : s.skill)"
        >
          <i :style="{ width: s.pct * 100 + '%' }" />
          <img :src="skillIconSrc(s.skill)" alt="" width="16" height="16" />
        </component>
      </div>
      <p class="pp-meta">
        <span>{{ progress.completedGoals }} of {{ progress.goalCount }} goal{{ progress.goalCount === 1 ? '' : 's' }} complete</span>
        <span v-if="baselineAt">Started {{ fmtDate(baselineAt) }}</span>
        <span v-if="updatedAt">Stats updated {{ formatRelative(updatedAt) }}</span>
      </p>
    </div>

    <p v-if="todayView" class="pp-since">
      <b>XP today</b> +{{ formatNum(todayView.total) }} XP
      <span v-for="s in todayView.skills.slice(0, 4)" :key="s.skill" class="pp-chip"><img :src="skillIconSrc(s.skill)" :alt="s.skill" width="14" height="14" />+{{ formatXp(s.gained) }}</span>
      <span v-if="todayView.skills.length > 4" class="pp-more">and {{ todayView.skills.length - 4 }} more</span>
    </p>
    <p v-if="!readonly" class="pp-foot">
      Progress is measured from the stats this plan started with.
      <button class="btn-text" type="button" @click="$emit('rebase')">Restart from today's stats</button>
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import PlannerPaceChart from '@/components/planner/PlannerPaceChart.vue'
import { formatNum } from '@/utils/planner'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'

const props = defineProps({
  progress: { type: Object, required: true },
  updatedAt: { type: String, default: '' },
  baselineAt: { type: String, default: '' },
  // XP the goal skills have gained today (null when none).
  today: { type: Object, default: null },
  hoursPerDay: { type: Number, default: 2 },
  // Where the player's real pace says the plan will finish (null on a public plan page).
  projection: { type: Object, default: null },
  // The plan against the real history, for the chart and the daily numbers (null on a public plan page).
  series: { type: Object, default: null },
  // On a public plan page: no restart link and no personal notes.
  readonly: { type: Boolean, default: false },
  // The skill being looked at on its own ('' for the whole plan).
  focus: { type: String, default: '' },
})
defineEmits(['rebase', 'focus'])

// Each skill is as wide as it takes to train, so the bar reads like the plan's timeline. Very short ones keep a sliver of room.
const segments = computed(() => {
  const per = props.progress.per
  const total = per.reduce((a, p) => a + p.hours, 0)
  return per.map((p) => {
    const share = total > 0 ? Math.max(p.hours / total, 0.045) : 1 / per.length
    const label = p.done ? `${p.skill}: level ${p.targetLevel} reached` : `${p.skill}: level ${p.liveLevel} of ${p.targetLevel}, ${Math.floor(p.pct * 100)}% done`
    return { skill: p.skill, share, pct: p.pct, done: p.done, label }
  })
})

// Looking at one skill: the header numbers are that skill's own.
const canFocus = computed(() => !props.readonly && props.progress.per.length > 1)
const focusPer = computed(() => (props.focus ? props.progress.per.find((p) => p.skill === props.focus) || null : null))
const view = computed(() => {
  const f = focusPer.value
  if (!f) return props.progress
  return { gainedXp: f.gained, remainingXp: f.remaining, complete: f.done, timePct: f.hours > 0 ? Math.min(1, Math.max(0, (f.hours - f.hoursLeft) / f.hours)) : f.pct }
})
const todayView = computed(() => {
  if (!props.today || !focusPer.value) return props.today
  const skills = props.today.skills.filter((x) => x.skill === focusPer.value.skill)
  return skills.length ? { total: skills.reduce((a, x) => a + x.gained, 0), skills } : null
})
const pctText = computed(() => {
  const p = view.value.timePct * 100
  return `${p > 0 && p < 10 ? p.toFixed(1) : Math.floor(p)}%`
})
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const shortDate = (d, withYear = false) => new Date(d).toLocaleDateString(undefined, withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' })
const plannedDate = computed(() => new Date(props.series.baseline.getTime() + props.series.plannedDays * 86_400_000))
function untilText(d) {
  const days = Math.ceil((new Date(d) - Date.now()) / 86_400_000)
  if (days < 0) return `${amountText(days)} ago`
  if (days < 1) return 'today'
  if (days < 60) return `in ${days} day${days === 1 ? '' : 's'}`
  if (days < 730) return `in about ${Math.round(days / 30)} months`
  return `in about ${(days / 365).toFixed(1)} years`
}
const amountText = (days) => {
  const d = Math.abs(days)
  return d < 1 ? `${Math.max(1, Math.round(d * 24))} hour${Math.max(1, Math.round(d * 24)) === 1 ? '' : 's'}` : d < 60 ? `${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}` : `about ${Math.round(d / 30)} months`
}

// Your XP a day in the skill being trained against what the plan asks of it.
const gauge = computed(() => {
  const c = cur.value
  if (!c) return null
  const pr = props.projection
  const need = c.neededPerDay
  const pace = pr && pr.status !== 'none' ? c.paceXpPerDay || 0 : null
  const max = Math.max(need || 0, pace || 0) * 1.12 || 1
  const ratio = need && pace != null ? Math.round((pace / need) * 100) : null
  const kind = ratio == null ? 'none' : ratio >= 97 ? 'ok' : 'low'
  let note
  if (!need) note = `Past its planned date (${shortDate(curEndDate.value)})`
  else if (pace == null) note = `To finish ${c.skill} by ${shortDate(curEndDate.value)}`
  else if (pace === 0) note = `No ${c.skill} XP lately. The plan needs this much to finish by ${shortDate(curEndDate.value)}`
  else note = ratio >= 97 ? `${ratio}% of what it needs: on track for ${shortDate(curEndDate.value)}` : `${ratio}% of what it needs to finish by ${shortDate(curEndDate.value)}`
  return { skill: c.skill, need, pace, pacePct: pace != null ? (pace / max) * 100 : null, needPct: need ? (need / max) * 100 : null, kind, note }
})

// The skill being trained now, and when the plan meant to be done with it.
const cur = computed(() => props.series?.current || null)
const curEndDate = computed(() => new Date(props.series.baseline.getTime() + cur.value.endDay * 86_400_000))
// Your XP a day in that skill against what the plan needs of it: the quickest way to see if you are keeping up.
const paceVs = computed(() => {
  const need = cur.value?.neededPerDay
  const pr = props.projection
  if (!need || !pr || pr.status === 'none') return null
  const diff = Math.round(((cur.value.paceXpPerDay || 0) / need - 1) * 100)
  if (Math.abs(diff) < 3) return { kind: 'on', text: 'right on what the plan needs' }
  return diff > 0 ? { kind: 'ahead', text: `${diff}% more than the plan needs` } : { kind: 'behind', text: `${Math.abs(diff)}% less than the plan needs` }
})
const projectedText = computed(() => {
  const pr = props.projection
  if (!pr || pr.status === 'none') return ''
  return pr.daysLeft > 365 * 5 ? 'more than 5 years away' : shortDate(pr.projected, true)
})
const verdict = computed(() => {
  const pr = props.projection
  if (!pr || pr.status === 'none') return ''
  if (pr.status === 'on') return 'right on the planned date'
  return `${amountText(pr.diffDays)} ${pr.status === 'early' ? 'earlier' : 'later'} than planned`
})

// The badge goes by the real pace when there is history to measure it from, and by the plan's own schedule until then.
const badge = computed(() => {
  const pr = props.projection
  if (pr && pr.status !== 'none') {
    if (pr.status === 'on') return { kind: 'on', text: 'On pace' }
    return { kind: pr.status === 'early' ? 'ahead' : 'behind', text: `On pace to finish ${amountText(pr.diffDays)} ${pr.status === 'early' ? 'early' : 'late'}` }
  }
  const sc = props.progress.schedule
  if (!sc) return null
  const amount = amountText(props.progress.aheadDays)
  return { kind: sc, text: sc === 'ahead' ? `${amount} ahead of schedule` : sc === 'behind' ? `${amount} behind schedule` : 'On schedule' }
})
</script>
