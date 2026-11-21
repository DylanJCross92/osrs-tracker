<template>
  <section class="path" aria-labelledby="path-h">
    <header class="path-head-main">
      <div class="path-head-row">
        <h2 id="path-h">Training path</h2>
        <button v-if="canSuggest" class="btn-text path-smart" type="button" @click="openSuggestion">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.7 1.8L21.5 19.5l-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z" /></svg>
          {{ fits ? 'Why this order?' : 'Smart order' }}
        </button>
      </div>
      <p v-if="dragging" class="path-reorder-hint" role="status">Drop <b>{{ dragging }}</b> where it should be trained.</p>
      <p v-else>Your skills in the order the plan trains them, with every step.<template v-if="goals.length > 1">{{ fits ? ' Ordered to suit your levels.' : '' }}{{ ' ' }}Drag a skill to change the order.</template></p>
    </header>

    <ol class="path-list" :class="{ reordering: !!dragging }">
      <li
        v-for="(g, i) in goals"
        :id="`path-${g.skill.toLowerCase()}`"
        :key="g.skill"
        :ref="(el) => setItemRef(el, i)"
        class="path-card"
        :class="[`cat-${entries[i]?.category}`, { done: isDone(i), hl: highlight === g.skill, 'can-drag': canDrag(i), dragging: dragging === g.skill }]"
        :style="itemStyle(i)"
        @pointerdown="onDown($event, i)"
      >
        <header class="path-head">
          <span class="path-n" aria-hidden="true">{{ shownNumber(i) }}</span>
          <img :src="skillIconSrc(g.skill)" :alt="g.skill" width="30" height="30" />
          <span class="path-title">
            <RouterLink v-if="planId" class="path-name" :to="{ name: 'plannerSkill', params: { id: planId, skill: g.skill.toLowerCase() } }" :title="`Link to ${g.skill} in this plan`"><b>{{ g.skill }}</b></RouterLink>
            <b v-else class="path-name">{{ g.skill }}</b>
            <em>{{ levelAtXp(g.currentXp, true) }} → {{ levelAtXp(g.targetXp, true) }}</em>
            <span v-if="i === nextIndex && !dragging" class="path-next">Up next</span>
          </span>
          <span class="path-when">
            <template v-if="isDone(i)"><b class="path-ok">✓ Done</b></template>
            <template v-else>
              <b>{{ formatHours(plans[i].hours) }}</b>
              <small v-if="entries[i] && !entries[i].done">by {{ fmtShort(entries[i].endDate) }}</small>
            </template>
          </span>
          <div class="path-menu" :class="{ open: menuFor === g.skill }">
            <button class="po-dots" type="button" aria-haspopup="menu" :aria-expanded="menuFor === g.skill" :aria-label="`Options for ${g.skill}`" @click.stop="toggleMenu(g.skill)">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" /></svg>
            </button>
            <div v-if="menuFor === g.skill" class="po-menu-list" role="menu" :aria-label="`Options for ${g.skill}`" @click.stop>
              <button v-if="editSkill !== g.skill" class="po-item" role="menuitem" type="button" @click="editFromMenu(g.skill)">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>
                Edit
              </button>
              <button v-if="canShare(i)" class="po-item" role="menuitem" type="button" @click="shareFromMenu(i)">
                <ShareIcon name="share" />
                Share
              </button>
              <button class="po-item po-item-danger" role="menuitem" type="button" @click="removeFromMenu(i)">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" /></svg>
                Delete from plan
              </button>
            </div>
          </div>
        </header>

        <div v-if="progress?.per?.[i]" class="path-prog">
          <span class="path-prog-top">
            <span>{{ progress.per[i].done ? 'Complete' : `Level ${progress.per[i].liveLevel} of ${progress.per[i].targetLevel}` }}</span>
            <b>{{ pctText(progress.per[i].pct) }}</b>
          </span>
          <span class="path-bar" role="progressbar" :aria-valuenow="Math.round(progress.per[i].pct * 100)" aria-valuemin="0" aria-valuemax="100" :aria-label="`${g.skill} progress`"><i :style="{ width: progress.per[i].pct * 100 + '%' }" /></span>
        </div>

        <!-- Being edited: the editor takes the place of the route (the route is inside it, and changes as you edit) -->
        <slot v-if="editSkill === g.skill" name="editor" :goal="g" :index="i" />
        <template v-else-if="!isDone(i)">
          <PlannerRoute :segments="plans[i].segments" :quests="plans[i].questList" />
          <PlannerPathDetails :plan="plans[i]" :goal="g" @patch="(patch) => emit('patch', g.skill, patch)" />
        </template>
      </li>
    </ol>
    <button class="path-add" type="button" @click="$emit('add')">+ Add a skill</button>

    <ShareRouteModal
      v-if="sharing >= 0 && goals[sharing]"
      :skill="goals[sharing].skill"
      :start-level="levelAtXp(goals[sharing].currentXp, true)"
      :end-level="levelAtXp(goals[sharing].targetXp, true)"
      :segments="plans[sharing].segments"
      :hours="plans[sharing].hours"
      :net-gp="plans[sharing].netGp"
      :label="`${strategyLabel} route`"
      @close="sharing = -1"
    />
    <SmartOrderModal v-if="suggestion" :suggestion="suggestion" :goals="goals" :has-player="hasPlayer" @close="suggestion = null" @apply="applySuggestion" @add-name="addName" />
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import PlannerRoute from '@/components/planner/PlannerRoute.vue'
import PlannerPathDetails from '@/components/planner/PlannerPathDetails.vue'
import ShareIcon from '@/components/ShareIcon.vue'
import ShareRouteModal from '@/components/planner/ShareRouteModal.vue'
import SmartOrderModal from '@/components/planner/SmartOrderModal.vue'
import { smartOrder } from '@/utils/smartOrder'
import { track } from '@/utils/analytics'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatHours, levelAtXp } from '@/utils/planner'

// A read-only view of the plan: each skill in training order as a card with its route, nothing to type into.
const props = defineProps({
  goals: { type: Array, required: true },
  plans: { type: Array, required: true },
  entries: { type: Array, default: () => [] },
  progress: { type: Object, default: null },
  strategyLabel: { type: String, default: 'Fastest' },
  // The saved plan's id, so each skill can link to itself (/planner/<id>/<skill>). Empty for a plan that is not saved.
  planId: { type: String, default: '' },
  // The skill named in the address: scrolled to and outlined.
  highlight: { type: String, default: '' },
  // The skill whose editor is open.
  editSkill: { type: String, default: '' },
  // Whether the plan is worked out from a player's real stats (without one, every skill starts at level 1).
  hasPlayer: { type: Boolean, default: true },
})
const emit = defineEmits(['edit', 'add', 'reorder', 'remove', 'patch', 'reorder-all', 'add-name'])

// --- The suggested order (utils/smartOrder.js): a window with the reasons, and a button to use it --------------------------------------
const suggestion = ref(null)
// Whether the plan is already in the suggested order, so the button can explain it instead of offering a change.
const fits = computed(() => canSuggest.value && !smartOrder(props.goals, props.plans).changed)
const canSuggest = computed(() => props.goals.length >= 2 && props.goals.filter((_, i) => !isDone(i)).length >= 2)
function openSuggestion() {
  suggestion.value = smartOrder(props.goals, props.plans)
  track('planner_smart_order_opened', { skills: props.goals.length, changed: suggestion.value.changed })
}
function addName() {
  suggestion.value = null
  track('planner_smart_order_add_name')
  emit('add-name')
}
function applySuggestion(order) {
  suggestion.value = null
  track('planner_smart_order_used', { skills: order.length })
  emit('reorder-all', order)
}

const isDone = (i) => props.plans[i]?.remainingXp === 0 || !!props.progress?.per?.[i]?.done
// The first skill with something left to train.
const nextIndex = computed(() => props.goals.findIndex((_, i) => !isDone(i)))
const fmtShort = (d) => (d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '')
const pctText = (v) => {
  const p = v * 100
  return `${p > 0 && p < 10 ? p.toFixed(1) : Math.floor(p)}%`
}

// --- The three-dot menu on each card: Edit, Share and Delete from plan ------------------------------------------------------------------
// The skill whose menu is open, closed by a click anywhere else or Escape.
const menuFor = ref('')
const sharing = ref(-1)
const toggleMenu = (skill) => (menuFor.value = menuFor.value === skill ? '' : skill)
const canShare = (i) => !isDone(i) && !!props.plans[i]?.segments?.length
function editFromMenu(skill) {
  menuFor.value = ''
  emit('edit', skill)
}
function removeFromMenu(i) {
  menuFor.value = ''
  emit('remove', props.goals[i].skill)
}
function shareFromMenu(i) {
  menuFor.value = ''
  sharing.value = i
}
const closeMenu = () => (menuFor.value = '')
const onMenuKey = (e) => e.key === 'Escape' && closeMenu()
onMounted(() => {
  document.addEventListener('click', closeMenu)
  document.addEventListener('keydown', onMenuKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenu)
  document.removeEventListener('keydown', onMenuKey)
})

// --- Drag a skill card to change the order it is trained in --------------------------------------------------------------
// Press on the top of a card (its title row or progress bar, not a button or link) and drag. While you drag, every card folds down to its title
// row so the whole order is in view, the others slide aside to make room, and letting go drops the card there. A touch screen
// needs a short press first, so scrolling still works.
const GAP = 14
const dragging = ref('')
const drag = reactive({ from: -1, to: -1, dy: 0, h: 0 })
const items = []
const setItemRef = (el, i) => {
  if (el) items[i] = el
}
let st = null
let raf = 0
const canDrag = (i) => props.goals.length > 1 && props.editSkill !== props.goals[i]?.skill

function onDown(e, i) {
  if (st || (e.pointerType === 'mouse' && e.button !== 0) || !canDrag(i)) return
  // Only the top of the card picks it up: the title row and the progress bar above the route. The route rows and the details underneath are left alone.
  if (!e.target.closest('.path-head, .path-prog')) return
  if (e.target.closest('button, a, input, select, textarea, label, .se, .planner-route')) return
  st = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, from: i, active: false, timer: 0 }
  // Touch and pen: hold for a moment first, so a swipe is still a scroll.
  if (e.pointerType !== 'mouse') st.timer = setTimeout(begin, 260)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', stop)
  window.addEventListener('keydown', onKey)
  window.addEventListener('touchmove', holdScroll, { passive: false })
}
function holdScroll(e) {
  if (st?.active) e.preventDefault()
}
async function begin() {
  if (!st || st.active) return
  st.active = true
  const el = items[st.from]
  const r = el.getBoundingClientRect()
  st.grab = Math.max(8, Math.min(st.y - r.top, 36))
  dragging.value = props.goals[st.from].skill
  document.body.style.userSelect = 'none'
  window.getSelection()?.removeAllRanges()
  // Every card is folded now: measure where they sit.
  await nextTick()
  if (!st) return
  const top = (n) => n.getBoundingClientRect().top + window.scrollY
  st.tops = props.goals.map((_, j) => top(items[j]))
  st.heights = props.goals.map((_, j) => items[j].getBoundingClientRect().height)
  drag.from = st.from
  drag.to = st.from
  drag.h = st.heights[st.from]
  update()
  loop()
}
function onMove(e) {
  if (!st || e.pointerId !== st.id) return
  if (!st.active) {
    const moved = Math.hypot(e.clientX - st.x, e.clientY - st.y)
    if (st.type === 'mouse') {
      if (moved > 6) {
        st.y = e.clientY
        begin()
      }
    } else if (moved > 10) stop()
    return
  }
  st.y = e.clientY
  update()
}
function update() {
  if (!st?.tops) return
  const desired = st.y + window.scrollY - st.grab
  drag.dy = desired - st.tops[st.from]
  const center = desired + st.heights[st.from] / 2
  let to = 0
  for (let j = 0; j < props.goals.length; j++) if (j !== st.from && st.tops[j] + st.heights[j] / 2 < center) to++
  drag.to = to
}
// Near the top or bottom edge of the screen the page scrolls on its own.
function loop() {
  if (!st?.active) return
  const edge = 90
  if (st.y < edge) window.scrollBy(0, -Math.ceil((edge - st.y) / 6))
  else if (st.y > window.innerHeight - edge) window.scrollBy(0, Math.ceil((st.y - (window.innerHeight - edge)) / 6))
  update()
  raf = requestAnimationFrame(loop)
}
async function onUp(e) {
  if (!st || e.pointerId !== st.id) return
  const moved = st.active && drag.to !== drag.from
  const { from, to } = drag
  if (moved) emit('reorder', from, to)
  await nextTick()
  stop()
}
function onKey(e) {
  if (e.key === 'Escape') stop()
}
function stop() {
  if (!st) return
  clearTimeout(st.timer)
  cancelAnimationFrame(raf)
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', stop)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('touchmove', holdScroll)
  document.body.style.userSelect = ''
  st = null
  dragging.value = ''
  drag.from = -1
  drag.to = -1
  drag.dy = 0
}
// The card being dragged follows the pointer; the cards between its old and new place slide out of the way.
function itemStyle(i) {
  if (!dragging.value || drag.from < 0) return null
  if (i === drag.from) return { transform: `translateY(${drag.dy}px)`, transition: 'none' }
  const step = drag.h + GAP
  if (drag.from < i && i <= drag.to) return { transform: `translateY(${-step}px)` }
  if (drag.to <= i && i < drag.from) return { transform: `translateY(${step}px)` }
  return null
}
// While dragging, the numbers show the order the cards would have if dropped now.
function shownNumber(i) {
  if (!dragging.value || drag.from < 0) return i + 1
  if (i === drag.from) return drag.to + 1
  if (drag.from < i && i <= drag.to) return i
  if (drag.to <= i && i < drag.from) return i + 2
  return i + 1
}
onBeforeUnmount(stop)
</script>
