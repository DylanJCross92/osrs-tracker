<template>
  <section class="fl" :class="{ 'is-done': !timeline.totalHours }" aria-labelledby="fl-h">
    <div class="fl-date">
      <span id="fl-h" class="fl-kicker">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
        Finish line
      </span>
      <template v-if="timeline.totalHours > 0 && timeline.finishDate">
        <b>{{ dateText }}</b>
        <small>{{ untilText }}</small>
      </template>
      <template v-else>
        <b>Nothing left to train</b>
        <small>Every goal is already reached.</small>
      </template>
    </div>

    <div v-if="timeline.totalHours > 0" class="fl-track">
      <div class="fl-bar" :class="{ labelled }" role="img" :aria-label="`The plan is ${formatHours(timeline.totalHours)} of training: ${summary}`">
        <i v-for="e in segments" :key="e.skill" :class="`cat-${e.category}`" :style="{ flexGrow: e.hours }" :title="`${e.skill}: ${formatHours(e.hours)}`">
          <template v-if="labelled">
            <img :src="skillIconSrc(e.skill)" alt="" width="18" height="18" />
            <span>{{ e.skill }}<small>{{ formatHours(e.hours) }}</small></span>
          </template>
        </i>
      </div>
      <div class="fl-ends"><span>Today</span><span>{{ dateText }}</span></div>
      <!-- Many skills: the bar is too thin to label, so the hours are given by kind of skill instead -->
      <ul v-if="!labelled" class="fl-legend" aria-label="Training time by kind of skill">
        <li v-for="c in categories" :key="c.key"><i :class="`cat-${c.key}`" aria-hidden="true" />{{ c.label }} <b>{{ formatHours(c.hours) }}</b></li>
      </ul>
      <p class="fl-note">Skills are trained in the order shown in the <button class="btn-text" type="button" @click="$emit('see-route')">training route</button>.</p>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatHours } from '@/utils/planner'
import { SKILL_CATEGORIES } from '@/utils/plannerTools'

const props = defineProps({
  timeline: { type: Object, required: true },
  hoursPerDay: { type: Number, required: true },
})
defineEmits(['see-route'])
const LABEL_UP_TO = 6

const segments = computed(() => props.timeline.entries.filter((e) => !e.done && e.hours > 0))
// A few skills: each gets a labelled block in the bar. Many: a thin bar, with the hours by kind of skill below it.
const labelled = computed(() => segments.value.length <= LABEL_UP_TO)
const categories = computed(() =>
  Object.keys(SKILL_CATEGORIES)
    .map((key) => ({ key, label: SKILL_CATEGORIES[key].label, hours: segments.value.filter((e) => e.category === key).reduce((sum, e) => sum + e.hours, 0) }))
    .filter((c) => c.hours > 0),
)
const summary = computed(() => categories.value.map((c) => `${c.label} ${formatHours(c.hours)}`).join(', '))
const dateText = computed(() => props.timeline.finishDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }))
const untilText = computed(() => {
  const days = props.timeline.totalDays
  if (days == null) return ''
  const d = Math.ceil(days)
  return d <= 1 ? `Within a day at ${props.hoursPerDay} h/day` : `In about ${d.toLocaleString('en-US')} days at ${props.hoursPerDay} h/day`
})
</script>
