<template>
  <!-- A route that can be edited reads as a timeline of levels: each stop is the level a method starts at, the line between two stops can take a new method -->
  <ol v-if="skill && (segments.length || questList.length)" class="rtl" aria-label="Training route by level">
    <li v-if="questList.length" class="rtl-stop">
      <span class="rtl-dot" aria-hidden="true" />
      <div class="rtl-level"><b>Quests</b><small>done first</small></div>
      <div class="rtl-card rtl-quest" :title="questTitle">
        <span class="rtl-main">
          <span class="rtl-name">{{ questList.length === 1 ? questList[0].name : `${questList.length} quests first` }}</span>
          <small class="rtl-meta">{{ questList.length === 1 ? 'it skips the early levels' : questNames }} · {{ formatNum(questXp) }} xp</small>
        </span>
        <span class="rtl-nums"><span class="planner-step-gp">Free</span><span class="planner-step-hours">{{ formatQuestTime(questMinutes) }}</span></span>
      </div>
    </li>
    <template v-for="(seg, k) in segments" :key="k">
      <li v-if="k > 0 || questList.length" class="rtl-add">
        <button type="button" class="rtl-add-btn" :aria-label="`Add a method at level ${seg.startLevel}`" aria-haspopup="dialog" @click="openAt(k)">
          <i aria-hidden="true" /><span>Add a method at level {{ seg.startLevel }}</span>
        </button>
      </li>
      <li class="rtl-stop" :class="{ 'is-done': seg.done }">
        <span class="rtl-dot" aria-hidden="true" />
        <div class="rtl-level"><b>Level {{ seg.startLevel }}</b><small>{{ seg.endLevel - seg.startLevel }} {{ seg.endLevel - seg.startLevel === 1 ? 'level' : 'levels' }}</small></div>
        <div
          :class="['rtl-card', 'is-pick', `planner-step-${seg.kind}`, { 'planner-step-gap': !seg.method, 'is-done': seg.done }]"
          role="button"
          tabindex="0"
          aria-haspopup="dialog"
          :aria-label="`Choose a method for levels ${seg.startLevel} to ${seg.endLevel}`"
          title="Choose a method for these levels"
          @click="editing = k"
          @keydown.enter.self.prevent="editing = k"
          @keydown.space.self.prevent="editing = k"
        >
          <span class="rtl-main">
            <span class="rtl-name">
              <img v-if="iconOf(seg.method)" class="route-ico" :src="iconOf(seg.method)" alt="" width="22" height="22" loading="lazy" /><span v-else class="route-ico" aria-hidden="true" />{{ seg.method ? seg.method.name : 'No catalog method' }}
              <RouteReqTip v-if="flag(seg)" :flag="flag(seg)" />
              <em v-if="tagOf(seg)">{{ tagOf(seg) }}</em>
            </span>
            <small class="rtl-meta">
              {{ formatNum(seg.xp) }} xp<template v-if="seg.xpPerHour"> · ~{{ formatNum(seg.xpPerHour) }} xp/h<template v-if="stepRangeText(seg.method, seg.startLevel, seg.endLevel)"> ({{ stepRangeText(seg.method, seg.startLevel, seg.endLevel) }} as you level)</template></template>
            </small>
          </span>
          <span class="rtl-nums">
            <span class="planner-step-gp gp-figure" :class="gpClass(seg.netGp)"><i v-if="seg.method && seg.method.id && isLive(seg.method.id, seg.method.xpPerHour)" class="live-dot" title="Worked out from live Grand Exchange prices" aria-hidden="true" /><GpTip :method="seg.method && seg.method.gpPerHour !== undefined && seg.method.id ? segmentMethod(seg) : null" :hours="seg.hours">{{ seg.netGp == null ? 'Unpriced' : formatGp(seg.netGp) }}</GpTip></span>
            <span class="planner-step-hours">{{ seg.hours == null ? '-' : formatHours(seg.hours) }}</span>
          </span>
          <span class="planner-step-chev"><span class="planner-step-change">Change</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></span>
        </div>
      </li>
    </template>
    <li v-if="segments.length" class="rtl-add">
      <button type="button" class="rtl-add-btn" :aria-label="`Add a method before level ${segments[segments.length - 1].endLevel}`" aria-haspopup="dialog" @click="openAt(segments.length)">
        <i aria-hidden="true" /><span>Add a method before level {{ segments[segments.length - 1].endLevel }}</span>
      </button>
    </li>
    <li v-if="segments.length" class="rtl-stop rtl-end">
      <span class="rtl-dot" aria-hidden="true" />
      <div class="rtl-level"><b>Level {{ segments[segments.length - 1].endLevel }}</b><small>goal</small></div>
    </li>
  </ol>
  <ol v-else-if="segments.length || questList.length" class="planner-route">
    <li v-if="questList.length" class="planner-step planner-step-quest" :title="questTitle">
      <span class="planner-step-levels">Quests</span>
      <span class="planner-step-name">
        {{ questList.length === 1 ? questList[0].name : `${questList.length} quests first` }}
        <em>{{ questList.length === 1 ? 'done first, it skips the early levels' : questNames }}</em>
      </span>
      <span class="planner-step-meta">{{ formatNum(questXp) }} xp</span>
      <span class="planner-step-gp">Free</span>
      <span class="planner-step-hours">{{ formatQuestTime(questMinutes) }}</span>
    </li>
    <li
      v-for="(seg, k) in segments"
      :key="k"
      :class="['planner-step', `planner-step-${seg.kind}`, { 'planner-step-gap': !seg.method, 'is-pick': !!skill, 'is-done': seg.done }]"
      v-bind="skill ? { role: 'button', tabindex: 0, 'aria-haspopup': 'dialog', 'aria-label': `Choose a method for levels ${seg.startLevel} to ${seg.endLevel}`, title: 'Choose a method for these levels' } : {}"
      @click="skill && (editing = k)"
      @keydown.enter.self.prevent="skill && (editing = k)"
      @keydown.space.self.prevent="skill && (editing = k)"
    >
      <span class="planner-step-levels">{{ seg.startLevel }} → {{ seg.endLevel }}</span>
      <span class="planner-step-name">
        <img v-if="iconOf(seg.method)" class="route-ico" :src="iconOf(seg.method)" alt="" width="20" height="20" loading="lazy" /><span v-else class="route-ico" aria-hidden="true" />{{ seg.method ? seg.method.name : 'No catalog method' }}
        <RouteReqTip v-if="flag(seg)" :flag="flag(seg)" />
        <em v-if="seg.done && seg.kind !== 'manual'">already trained</em>
        <em v-else-if="seg.kind === 'manual'">{{ seg.done ? 'what you picked for these levels' : 'your pick for these levels' }}</em>
        <em v-else-if="seg.kind === 'main'">your chosen method</em>
        <em v-else-if="seg.kind === 'prep'">to unlock it</em>
        <em v-else-if="seg.kind === 'post'">after it caps out</em>
      </span>
      <span class="planner-step-meta">
        {{ formatNum(seg.xp) }} xp<template v-if="seg.xpPerHour"> · ~{{ formatNum(seg.xpPerHour) }} xp/h<template v-if="stepRangeText(seg.method, seg.startLevel, seg.endLevel)"> ({{ stepRangeText(seg.method, seg.startLevel, seg.endLevel) }} as you level)</template></template>
      </span>
      <span class="planner-step-gp gp-figure" :class="gpClass(seg.netGp)"><i v-if="seg.method && seg.method.id && isLive(seg.method.id, seg.method.xpPerHour)" class="live-dot" title="Worked out from live Grand Exchange prices" aria-hidden="true" /><GpTip :method="seg.method && seg.method.gpPerHour !== undefined && seg.method.id ? segmentMethod(seg) : null" :hours="seg.hours">{{ seg.netGp == null ? 'Unpriced' : formatGp(seg.netGp) }}</GpTip></span>
      <span class="planner-step-hours">{{ seg.hours == null ? '-' : formatHours(seg.hours) }}</span>
      <span v-if="skill" class="planner-step-chev"><span class="planner-step-change">Change</span><svg v-if="skill" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></span>
    </li>
  </ol>
  <p v-if="skill && segments.length" class="planner-route-range">
    <button type="button" class="btn-text" aria-haspopup="dialog" @click="openRange">Set one method for a range of levels</button>
    <span>for example, Red chinchompas from 63 to 99</span>
  </p>

  <!-- The choices open over the page, so nothing underneath moves -->
  <Teleport to="body">
    <div v-if="skill && current" class="modal-overlay msheet-overlay" @click.self="close">
      <div class="modal-card msheet" role="dialog" aria-modal="true" aria-labelledby="msheet-h">
        <div class="share-modal-header">
          <h2 id="msheet-h">{{ current.kind === 'custom' ? 'Add a method' : `Method for levels ${current.startLevel} to ${current.endLevel}` }}</h2>
          <button ref="closeBtn" class="btn-text" type="button" aria-label="Close" @click="close">✕</button>
        </div>
        <div class="msheet-tabs pm-tabs" role="tablist" aria-label="Which methods to show">
          <button type="button" role="tab" :aria-selected="tab === 'best'" :class="{ active: tab === 'best' }" @click="tab = 'best'">Recommended<small>the best options for these levels</small></button>
          <button type="button" role="tab" :aria-selected="tab === 'all'" :class="{ active: tab === 'all' }" @click="tab = 'all'">All training methods<small>{{ catalogue.length }} you can use in this route</small></button>
        </div>
        <p v-if="current.kind === 'manual'" class="msheet-reset">
          You picked <b>{{ current.method?.name }}</b> for these levels.
          <button class="btn-text" type="button" @click="apply(null)">Let the planner pick instead</button>
        </p>
        <p v-if="tab === 'best' && !best.length" class="msheet-note">No method in the catalog covers these levels. Open All training methods to see what exists for {{ skill }}.</p>
        <p v-if="tab === 'all'" class="msheet-note">Pick a method, then choose which levels to use it for. Anywhere it does not reach, the planner fills in the rest.</p>
        <MethodPicker
          :key="tab"
          :from-level="current.startLevel"
          :to-level="current.endLevel"
          inline
          :initial-sort="tab === 'best' ? 'xp' : 'level'"
          :model-value="pickedId || current.method?.id || ''"
          :methods="shown"
          :note-for="noteFor"
          :allow-custom="false"
          @update:model-value="(id) => select(current, id)"
        />
        <!-- A method is picked first; then the levels it is used for are chosen here and confirmed with one button -->
        <div v-if="picked" class="msheet-apply" role="group" aria-label="Levels to use it for">
          <div class="msheet-apply-line">
            <span>Use <b>{{ picked.name }}</b> for levels from</span>
            <select v-model.number="rangeFrom" aria-label="From level" @change="fixRange('from')"><option v-for="l in fromOptions" :key="l" :value="l">{{ l }}</option></select>
            <span>to</span>
            <select v-model.number="rangeTo" aria-label="To level" @change="fixRange('to')"><option v-for="l in toOptions" :key="l" :value="l">{{ l }}</option></select>
          </div>
          <button type="button" class="btn btn-primary" @click="apply()">{{ unchanged ? 'Keep it' : 'Use it' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import GpTip from '@/components/planner/GpTip.vue'
import MethodPicker from '@/components/planner/MethodPicker.vue'
import { routeFlag } from '@/utils/requirements'
import { averageBetween, segmentMethod, stepRangeText } from '@/utils/methodRates'
import RouteReqTip from '@/components/planner/RouteReqTip.vue'
import { plannerRequirementContext } from '@/composables/plannerRequirementContext'
import { methodsForSkill } from '@/data/trainingMethods'
import { methodIconSrc } from '@/data/methodIcons'
import { formatNum, formatHours, formatGp } from '@/utils/planner'
import { isLive } from '@/utils/methodPricing'

// With a skill, every step can be changed: the player picks the method for that set of levels and the parent stores it.
const props = defineProps({
  segments: { type: Array, required: true },
  skill: { type: String, default: '' },
  // The quests done before the route starts: [{ id, name, xp, minutes }] (from planGoal's questList).
  quests: { type: Array, default: () => [] },
})
const emit = defineEmits(['set'])

const questList = computed(() => props.quests || [])
const questXp = computed(() => questList.value.reduce((sum, x) => sum + x.xp, 0))
const questMinutes = computed(() => questList.value.reduce((sum, x) => sum + x.minutes, 0))
const questNames = computed(() => questList.value.map((x) => x.name).join(', '))
const questTitle = computed(() => questList.value.map((x) => `${x.name}: +${formatNum(x.xp)} xp`).join('\n'))
const formatQuestTime = (min) => (min >= 60 ? formatHours(min / 60) : `~${min} min`)

const editing = ref(-1)
// Opened from the link under the steps instead of from one step: the whole route, a range the player then narrows down.
const custom = ref(null)
// The levels the pick will be used for. It starts as the step's levels, and the player can widen or move it (even across several steps).
const bounds = computed(() => ({ start: props.segments[0]?.startLevel ?? 1, end: props.segments[props.segments.length - 1]?.endLevel ?? 99 }))
// The method picked in the list, waiting for its levels to be confirmed, and the levels chosen for it.
const pickedId = ref(null)
const picked = computed(() => (pickedId.value ? methodsForSkill(props.skill).find((m) => m.id === pickedId.value) || null : null))
const rangeFrom = ref(1)
// Nothing to change: the step's own method with the step's own levels.
const unchanged = computed(() => !!picked.value && current.value?.kind !== 'custom' && picked.value.id === current.value?.method?.id && rangeFrom.value === current.value.startLevel && rangeTo.value === current.value.endLevel)
const rangeTo = ref(99)
const current = computed(() => (editing.value >= 0 ? props.segments[editing.value] : custom.value ? { kind: 'custom', startLevel: custom.value.start, endLevel: custom.value.end, method: null } : null))
// The first level is the lowest the method can be started at (or where the route starts, if that is later); the last is up to the route's end.
const fromOptions = computed(() => {
  const lo = Math.max(bounds.value.start, picked.value?.minLevel ?? 1)
  const hi = Math.max(bounds.value.end - 1, lo)
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
})
const toOptions = computed(() => Array.from({ length: Math.max(bounds.value.end - rangeFrom.value, 1) }, (_, i) => rangeFrom.value + 1 + i))
function setRange(from, to) {
  rangeFrom.value = from
  rangeTo.value = to
}
// Keeps the two levels inside the options and in order (at least one level apart).
function fixRange(edited) {
  const lo = fromOptions.value[0]
  const end = bounds.value.end
  let from = Math.min(Math.max(Math.round(Number(rangeFrom.value)) || lo, lo), Math.max(end - 1, lo))
  let to = Math.min(Math.max(Math.round(Number(rangeTo.value)) || end, from + 1), end)
  if (edited === 'to' && to <= from) from = Math.max(to - 1, lo)
  setRange(from, to)
}
const openRange = () => {
  custom.value = { start: bounds.value.start, end: bounds.value.end }
  editing.value = -1
}
// The "+" on the line before step k: a new method starting at the level that step starts at. On the line after the last step (k is the
// number of steps) it opens on the last step's levels, to be narrowed down (say 75 to 90) with the level dropdowns.
const openAt = (k) => {
  const seg = props.segments[Math.min(k, props.segments.length - 1)]
  custom.value = { start: seg.startLevel, end: seg.endLevel }
  editing.value = -1
}
// A short note under a step's method name saying why the route uses it.
const tagOf = (seg) => {
  if (seg.done && seg.kind !== 'manual') return 'already trained'
  if (seg.kind === 'manual') return seg.done ? 'what you picked for these levels' : 'your pick for these levels'
  return { main: 'your chosen method', prep: 'to unlock it', post: 'after it caps out' }[seg.kind] || ''
}
const iconOf = (m) => methodIconSrc(m)
const closeBtn = ref(null)
const close = () => {
  editing.value = -1
  custom.value = null
  pickedId.value = null
}

// Two views of the choices for a step: the few best options, or every method that works for all of those levels.
const tab = ref('best')
// Every method that can be used somewhere in these levels. The ones that cover all of them are the best fit for the whole stretch;
// the others (they start later, or stop earlier) are still choices, and are used for the levels they cover.
const all = computed(() => (current.value ? overlapping(current.value.startLevel, current.value.endLevel) : []))
const covers = (m, from, to) => m.minLevel <= from && (m.maxLevel == null || m.maxLevel >= to - 1)
const whole = computed(() => (current.value ? all.value.filter((m) => covers(m, current.value.startLevel, current.value.endLevel)) : []))
// A method's xp an hour across these levels (its tiers averaged over them), so the shortlist ranks what the player would really get.
const rateHere = (m) => averageBetween(m, current.value.startLevel, current.value.endLevel)
const best = computed(() => {
  const list = whole.value.length ? whole.value : all.value
  if (!list.length) return []
  const ids = new Set()
  const top = (items, score) => items.length && ids.add(items.reduce((a, b) => (score(b) > score(a) ? b : a)).id)
  top(list, rateHere)
  top(list.filter((m) => !ids.has(m.id)), rateHere) // runner-up on XP
  top(list.filter((m) => m.gpPerHour != null && m.gpPerHour > 0), (m) => m.gpPerHour)
  top(list.filter((m) => m.gpPerHour != null), (m) => m.gpPerHour / rateHere(m))
  // The method the route uses for these levels right now stays in view.
  if (current.value?.method?.id && all.value.some((m) => m.id === current.value.method.id)) ids.add(current.value.method.id)
  return all.value.filter((m) => ids.has(m.id))
})
// Every method of the skill that can be started before the route ends: ones meant for lower levels, ones that cover this step, and ones that
// unlock later (picking one asks which levels to use it for, so it can be set for a range that starts above this step).
const catalogue = computed(() => (current.value ? methodsForSkill(props.skill).filter((m) => m.minLevel < bounds.value.end) : []))
// Meant for lower levels: still something you can do, but the planner would not pick it here.
const pastBest = (m, cur) => m.maxLevel != null && m.maxLevel + 1 <= cur.startLevel
const noteFor = (m) => (current.value && pastBest(m, current.value) ? `Best up to level ${m.maxLevel}` : '')
const shown = computed(() => (tab.value === 'best' ? best.value : catalogue.value))
// Escape closes the sheet (and only the sheet, not a dialog underneath it).
const onKey = (e) => {
  if (e.key === 'Escape') {
    e.stopPropagation()
    close()
  }
}
watch(
  () => editing.value >= 0 || !!custom.value,
  (open) => {
    if (open) {
      // A step that already has a method opens with it selected, and the levels it covers filled in, so they can be changed straight away.
      const own = current.value.method?.id
      pickedId.value = own && methodsForSkill(props.skill).some((m) => m.id === own) ? own : null
      setRange(current.value.startLevel, current.value.endLevel)
      // Start on the best options, unless the pick already made is not one of them.
      const picked = current.value?.kind === 'manual' ? current.value.method?.id : null
      tab.value = (picked && !best.value.some((m) => m.id === picked)) || !best.value.length ? 'all' : 'best'
      document.addEventListener('keydown', onKey, true)
      nextTick(() => closeBtn.value?.focus())
    } else document.removeEventListener('keydown', onKey, true)
  },
)
onBeforeUnmount(() => document.removeEventListener('keydown', onKey, true))

// Methods that work for every level from `from` up to (but not including) `to`.
const overlapping = (from, to) => methodsForSkill(props.skill).filter((m) => m.minLevel < to && (m.maxLevel == null || m.maxLevel + 1 > from))
// Picking a method in the list does not change the plan yet: it asks for the levels first (starting with the step's own levels,
// moved to where the method can be started), and "Use ..." confirms. "Let the planner pick" has no levels to ask for, so it applies at once.
function select(seg, id) {
  if (id === '__recommended') return apply(null)
  const m = methodsForSkill(props.skill).find((x) => x.id === id)
  if (!m) return
  pickedId.value = id
  const lo = Math.max(bounds.value.start, m.minLevel)
  const from = Math.min(Math.max(seg.startLevel, m.minLevel), Math.max(bounds.value.end - 1, lo))
  setRange(from, seg.endLevel > from ? seg.endLevel : bounds.value.end)
  nextTick(() => document.querySelector('.msheet-apply')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
}
function apply(methodId = pickedId.value) {
  const seg = current.value
  if (methodId) {
    const same = rangeFrom.value === seg.startLevel && rangeTo.value === seg.endLevel
    // The step already uses it (and it was not picked by hand): nothing to change.
    if (seg.kind !== 'custom' && same && methodId === seg.method?.id) return close()
    emit('set', { fromLevel: rangeFrom.value, toLevel: rangeTo.value, methodId })
  } else emit('set', { fromLevel: seg.startLevel, toLevel: seg.endLevel, methodId: null })
  close()
}

const reqCtx = inject(plannerRequirementContext, null)
// A marker next to a step whose method has a missing or unconfirmed requirement.
const flag = (seg) => routeFlag(seg.method, reqCtx?.value)
const gpClass = (gp) => (gp == null ? '' : gp >= 0 ? 'planner-gain' : 'planner-cost')
</script>
