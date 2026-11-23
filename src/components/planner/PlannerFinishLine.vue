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

    <div v-if="timeline.totalHours > 0" ref="trackEl" class="fl-track">
      <div class="fl-bar" :class="{ labelled, 'has-tip': !!tip }" @pointerleave="tip = null" role="img" :aria-label="`The plan is ${formatHours(timeline.totalHours)} of training: ${summary}`">
        <i v-for="e in segments" :key="e.skill" :class="[`cat-${e.category}`, { 'is-on': tip && tip.e.skill === e.skill }]" :style="{ flexGrow: e.hours }" tabindex="0" @pointerenter="showTip(e, $event)" @pointermove="moveTip($event)" @focus="showTip(e, $event)" @blur="tip = null">
          <template v-if="labelled">
            <img :src="skillIconSrc(e.skill)" alt="" width="18" height="18" />
            <span>{{ e.skill }}<small>{{ formatHours(e.hours) }}</small></span>
          </template>
        </i>
      </div>
      <div v-if="tip" class="fl-tip" :class="[`cat-${tip.e.category}`, { below: tip.below }]" role="tooltip" :style="tip.below ? { left: tip.x + 'px', top: tip.barH + 8 + 'px', transform: 'translateX(-50%)' } : { left: tip.x + 'px' }">
        <span class="fl-tip-head"><img :src="skillIconSrc(tip.e.skill)" alt="" width="18" height="18" /><b>{{ tip.e.skill }}</b><span class="fl-tip-levels">{{ tip.e.startLevel }} → {{ tip.e.targetLevel }}</span></span>
        <span class="fl-tip-line">{{ formatHours(tip.e.hours) }} of training<template v-if="tip.e.hours && hoursPerDay"> · about {{ Math.max(1, Math.round(tip.e.hours / hoursPerDay)) }} day{{ Math.round(tip.e.hours / hoursPerDay) > 1 ? 's' : '' }}</template></span>
        <span v-if="tip.e.startDate && tip.e.endDate" class="fl-tip-line">{{ shortDate(tip.e.startDate) }} to {{ shortDate(tip.e.endDate) }}</span>
        <span v-if="tip.e.xp > 0" class="fl-tip-stat fl-tip-xp"><span>XP gained</span><b>+{{ formatXp(tip.e.xp) }}</b></span>
        <span v-if="tip.e.netGp != null && tip.e.netGp !== 0" class="fl-tip-stat" :class="tip.e.netGp >= 0 ? 'fl-tip-gain' : 'fl-tip-cost'"><span>{{ tip.e.netGp >= 0 ? 'Profit' : 'Cost' }}</span><b>{{ formatGp(tip.e.netGp).replace(/ gp$/, '') }} gp</b></span>
        <span class="fl-tip-cat">{{ categoryLabel(tip.e.category) }}</span>
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
import { computed, ref } from 'vue'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { formatGp, formatHours } from '@/utils/planner'
import { SKILL_CATEGORIES } from '@/utils/plannerTools'

const props = defineProps({
  timeline: { type: Object, required: true },
  hoursPerDay: { type: Number, required: true },
})
defineEmits(['see-route'])

// A small box over the bar saying what is being trained in the block the pointer is on.
const TIP_ROOM = 260 // px the tooltip needs above the bar (its height and the sticky header)
const tip = ref(null)
const trackEl = ref(null)
function placeTip(clientX) {
  const box = trackEl.value?.getBoundingClientRect()
  if (!box) return 0
  // Centred on the pointer, kept inside the track.
  return Math.min(Math.max(clientX - box.left, 110), Math.max(box.width - 110, 110))
}
function showTip(e, ev) {
  const target = ev.currentTarget.getBoundingClientRect()
  // Under the bar instead of over it when there is no room above (the page header is in the way near the top of the screen).
  const bar = trackEl.value?.querySelector('.fl-bar')?.getBoundingClientRect()
  tip.value = { e, x: placeTip(ev.clientX || target.left + target.width / 2), below: !!bar && bar.top < TIP_ROOM, barH: bar ? bar.height : 14 }
}
function moveTip(ev) {
  if (tip.value) tip.value = { ...tip.value, x: placeTip(ev.clientX) }
}
const shortDate = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const categoryLabel = (key) => SKILL_CATEGORIES[key]?.label || ''
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
