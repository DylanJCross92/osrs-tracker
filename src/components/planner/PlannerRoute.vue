<template>
  <ol v-if="segments.length" class="planner-route">
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
      :class="['planner-step', `planner-step-${seg.kind}`, { 'planner-step-gap': !seg.method, 'is-pick': !!skill }]"
      v-bind="skill ? { role: 'button', tabindex: 0, 'aria-haspopup': 'dialog', 'aria-label': `Choose a method for levels ${seg.startLevel} to ${seg.endLevel}`, title: 'Choose a method for these levels' } : {}"
      @click="skill && (editing = k)"
      @keydown.enter.self.prevent="skill && (editing = k)"
      @keydown.space.self.prevent="skill && (editing = k)"
    >
      <span class="planner-step-levels">{{ seg.startLevel }} → {{ seg.endLevel }}</span>
      <span class="planner-step-name">
        <img v-if="iconOf(seg.method)" class="route-ico" :src="iconOf(seg.method)" alt="" width="20" height="20" loading="lazy" />{{ seg.method ? seg.method.name : 'No catalog method' }}
        <RouteReqTip v-if="flag(seg)" :flag="flag(seg)" />
        <em v-if="seg.kind === 'manual'">your pick for these levels</em>
        <em v-else-if="seg.kind === 'main'">your chosen method</em>
        <em v-else-if="seg.kind === 'prep'">to unlock it</em>
        <em v-else-if="seg.kind === 'post'">after it caps out</em>
      </span>
      <span class="planner-step-meta">
        {{ formatNum(seg.xp) }} xp<template v-if="seg.xpPerHour"> · ~{{ formatNum(seg.xpPerHour) }} xp/h</template>
      </span>
      <span class="planner-step-gp" :class="gpClass(seg.netGp)"><i v-if="seg.method && seg.method.id && isLive(seg.method.id, seg.method.xpPerHour)" class="live-dot" title="Worked out from live Grand Exchange prices" aria-hidden="true" /><GpTip :method="seg.method && seg.method.gpPerHour !== undefined && seg.method.id ? seg.method : null" :hours="seg.hours">{{ seg.netGp == null ? 'Unpriced' : formatGp(seg.netGp) }}</GpTip></span>
      <span class="planner-step-hours">{{ seg.hours == null ? '-' : formatHours(seg.hours) }}</span>
      <svg v-if="skill" class="planner-step-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </li>
  </ol>

  <!-- The choices open over the page, so nothing underneath moves -->
  <Teleport to="body">
    <div v-if="skill && current" class="modal-overlay msheet-overlay" @click.self="close">
      <div class="modal-card msheet" role="dialog" aria-modal="true" aria-labelledby="msheet-h">
        <div class="share-modal-header">
          <h2 id="msheet-h">Method for levels {{ current.startLevel }} to {{ current.endLevel }}</h2>
          <button ref="closeBtn" class="btn-text" type="button" aria-label="Close" @click="close">✕</button>
        </div>
        <div class="msheet-tabs pm-tabs" role="tablist" aria-label="Which methods to show">
          <button type="button" role="tab" :aria-selected="tab === 'best'" :class="{ active: tab === 'best' }" @click="tab = 'best'">Recommended<small>the best options for these levels</small></button>
          <button type="button" role="tab" :aria-selected="tab === 'all'" :class="{ active: tab === 'all' }" @click="tab = 'all'">All training methods<small>{{ catalogue.length }} you can use in these levels</small></button>
        </div>
        <p v-if="current.kind === 'manual'" class="msheet-reset">
          You picked <b>{{ current.method?.name }}</b> for these levels.
          <button class="btn-text" type="button" @click="choose(current, '__recommended')">Let the planner pick instead</button>
        </p>
        <p v-if="tab === 'best' && !best.length" class="msheet-note">No method in the catalog covers these levels. Open All training methods to see what exists for {{ skill }}.</p>
        <p v-if="tab === 'all' && partialCount" class="msheet-note">{{ partialCount }} of these only cover some of the levels. Picking one uses it for the levels it covers, and the planner fills the rest.</p>
        <MethodPicker
          :key="tab"
          inline
          :initial-sort="tab === 'best' ? 'xp' : 'level'"
          :model-value="current.method?.id || ''"
          :methods="shown"
          :note-for="noteFor"
          :allow-custom="false"
          @update:model-value="(id) => choose(current, id)"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import GpTip from '@/components/planner/GpTip.vue'
import MethodPicker from '@/components/planner/MethodPicker.vue'
import { routeFlag } from '@/utils/requirements'
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
const current = computed(() => props.segments[editing.value] || null)
const iconOf = (m) => methodIconSrc(m)
const closeBtn = ref(null)
const close = () => (editing.value = -1)

// Two views of the choices for a step: the few best options, or every method that works for all of those levels.
const tab = ref('best')
// Every method that can be used somewhere in these levels. The ones that cover all of them are the best fit for the whole stretch;
// the others (they start later, or stop earlier) are still choices, and are used for the levels they cover.
const all = computed(() => (current.value ? overlapping(current.value.startLevel, current.value.endLevel) : []))
const covers = (m, from, to) => m.minLevel <= from && (m.maxLevel == null || m.maxLevel >= to - 1)
const whole = computed(() => (current.value ? all.value.filter((m) => covers(m, current.value.startLevel, current.value.endLevel)) : []))
const best = computed(() => {
  const list = whole.value.length ? whole.value : all.value
  if (!list.length) return []
  const ids = new Set()
  const top = (items, score) => items.length && ids.add(items.reduce((a, b) => (score(b) > score(a) ? b : a)).id)
  top(list, (m) => m.xpPerHour)
  top(list.filter((m) => !ids.has(m.id)), (m) => m.xpPerHour) // runner-up on XP
  top(list.filter((m) => m.gpPerHour != null && m.gpPerHour > 0), (m) => m.gpPerHour)
  top(list.filter((m) => m.gpPerHour != null), (m) => m.gpPerHour / m.xpPerHour)
  // The method the route uses for these levels right now stays in view.
  if (current.value?.method?.id && all.value.some((m) => m.id === current.value.method.id)) ids.add(current.value.method.id)
  return all.value.filter((m) => ids.has(m.id))
})
const partialCount = computed(() => all.value.length - whole.value.length)
// Every method of the skill that is unlocked by the end of these levels: ones meant for lower levels, ones that cover the whole stretch,
// and ones that unlock partway through. Methods that need a level this stretch never reaches are left out.
const catalogue = computed(() => (current.value ? methodsForSkill(props.skill).filter((m) => m.minLevel < current.value.endLevel) : []))
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
  () => editing.value >= 0,
  (open) => {
    if (open) {
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
function choose(seg, id) {
  // Picking what the route already uses (and was not picked by hand) changes nothing.
  if (id !== '__recommended' && seg.kind !== 'manual' && id === seg.method?.id) return close()
  const m = id === '__recommended' ? null : methodsForSkill(props.skill).find((x) => x.id === id)
  // A method that only covers part of the levels is set for the levels it covers; the planner keeps filling the rest.
  // (One meant for lower levels, picked on purpose, is used for the whole step.)
  const past = m && m.maxLevel != null && m.maxLevel + 1 <= seg.startLevel
  const fromLevel = m ? Math.max(seg.startLevel, m.minLevel) : seg.startLevel
  const toLevel = m && m.maxLevel != null && !past ? Math.min(seg.endLevel, m.maxLevel + 1) : seg.endLevel
  emit('set', { fromLevel, toLevel, methodId: m ? m.id : null })
  close()
}

const reqCtx = inject(plannerRequirementContext, null)
// A marker next to a step whose method has a missing or unconfirmed requirement.
const flag = (seg) => routeFlag(seg.method, reqCtx?.value)
const gpClass = (gp) => (gp == null ? '' : gp >= 0 ? 'planner-gain' : 'planner-cost')
</script>
