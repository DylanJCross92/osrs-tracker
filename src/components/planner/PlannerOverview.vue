<template>
  <section class="po" aria-labelledby="po-h">
    <header class="pgh">
      <div class="pgh-title">
        <h1 id="po-h">Account Planner</h1>
        <p class="pgh-sub">Open a plan to see your training path, or start a new one.</p>
      </div>
    </header>

    <!-- Plans saved in this browser only: say so, and how to keep them -->
    <GuestKeepCard place="planner" :always="false" />

    <ul class="po-grid">
      <li class="po-new">
        <RouterLink class="po-new-link" :to="{ name: 'plannerNew' }">
          <span class="po-new-plus" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg></span>
          <b>New plan</b>
          <small>Start from a ready-made plan, a skill or the Smart Planner</small>
        </RouterLink>
      </li>
      <li v-for="p in rows" :key="p.id" class="po-card">
        <RouterLink class="po-main" :to="{ name: 'plannerPlan', params: { id: p.id } }" :aria-label="`Open ${p.name}`">
          <span class="po-title">
            <b>{{ p.name }}<span v-if="onProfile.isOn(p.id)" class="po-onprofile" title="This plan is the goal on your profile">On profile</span></b>
            <span class="po-sub">
              <small>{{ p.sub }}</small>
              <span class="po-icons" aria-hidden="true">
                <img v-for="s in p.icons" :key="s" :src="skillIconSrc(s)" alt="" width="20" height="20" />
                <em v-if="p.more">+{{ p.more }}</em>
              </span>
            </span>
          </span>
          <span v-if="progress[p.id]" class="po-prog" :class="{ done: progress[p.id].pct >= 1 }">
            <span class="po-prog-top"><span>{{ progress[p.id].pct >= 1 ? 'Complete' : 'Progress' }} · {{ progress[p.id].done }} of {{ progress[p.id].total }} done</span><b>{{ pctText(progress[p.id].pct) }}</b></span>
            <span class="po-bar" role="progressbar" :aria-valuenow="Math.round(progress[p.id].pct * 100)" aria-valuemin="0" aria-valuemax="100" :aria-label="`${p.name} progress`"><i :style="{ width: progress[p.id].pct * 100 + '%' }" /></span>
          </span>
          <span v-else class="po-prog po-prog-none"><small>{{ progressLoading && p.hasPlayer ? 'Checking progress…' : p.hasPlayer ? 'This player is not tracked yet' : 'No player linked, so progress is not tracked' }}</small></span>
          <dl class="po-stats">
            <div><dt>Time</dt><dd>{{ formatHours(p.summary.totalHours) }}<small v-if="progress[p.id]" class="po-left">{{ progress[p.id].hoursLeft > 0 ? `${formatHours(progress[p.id].hoursLeft)} left` : 'Nothing left' }}</small></dd></div>
            <div><dt>At {{ p.hours }} h/day</dt><dd>{{ p.summary.days == null ? '-' : formatDays(p.summary.days) }}<small v-if="progress[p.id] && progress[p.id].daysLeft != null" class="po-left">{{ progress[p.id].hoursLeft > 0 ? `${progress[p.id].daysLeft.toLocaleString('en-US')} ${progress[p.id].daysLeft === 1 ? 'day' : 'days'} left` : 'Nothing left' }}</small></dd></div>
            <div v-if="p.summary.netGp != null"><dt>{{ p.summary.netGp >= 0 ? 'Profit' : 'GP cost' }}</dt><dd :class="p.summary.netGp >= 0 ? 'planner-gain' : 'planner-cost'">{{ formatGp(p.summary.netGp) }}</dd></div>
          </dl>
        </RouterLink>
        <div class="po-menu" :class="{ open: menuFor === p.id }">
          <button class="po-dots" type="button" aria-haspopup="menu" :aria-expanded="menuFor === p.id" :aria-label="`Options for ${p.name}`" @click.stop="toggleMenu(p.id)">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" /></svg>
          </button>
          <div v-if="menuFor === p.id" class="po-menu-list" role="menu" :aria-label="`Options for ${p.name}`" @click.stop>
            <RouterLink class="po-item" role="menuitem" :to="{ name: 'plannerEdit', params: { id: p.id } }">Edit</RouterLink>
            <button class="po-item" role="menuitem" type="button" @click="duplicate(p.id)">Duplicate</button>
            <button v-if="onProfile.available(p.id)" class="po-item" role="menuitem" type="button" :disabled="onProfile.busy.value" @click="profileToggle(p.id)">{{ onProfile.isOn(p.id) ? 'Remove from profile' : 'Show on profile' }}</button>
            <button class="po-item po-item-danger" role="menuitem" type="button" @click="askDelete(p)">Delete</button>
          </div>
        </div>
        <div class="po-foot"><small>Updated {{ p.updated }}</small></div>
      </li>
    </ul>

    <!-- Deleting asks first, in a window -->
    <Teleport to="body">
      <div v-if="pending" class="modal-overlay" @click.self="pending = null">
        <div class="modal-card save-plan" role="alertdialog" aria-modal="true" aria-labelledby="po-del-h" aria-describedby="po-del-d">
          <div class="share-modal-header">
            <h2 id="po-del-h">Delete this plan?</h2>
            <button class="btn-text" type="button" aria-label="Close" @click="pending = null">✕</button>
          </div>
          <p id="po-del-d" class="save-plan-note"><b class="po-del-name">{{ pending.name }}</b> will be deleted. This cannot be undone, and its link will stop working.</p>
          <div class="save-plan-actions po-del-actions">
            <button ref="cancelBtn" class="btn btn-ghost" type="button" @click="pending = null">Keep plan</button>
            <button class="btn po-delete" type="button" @click="confirmDelete">Delete plan</button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import GuestKeepCard from '@/components/guest/GuestKeepCard.vue'
import { formatDays, formatGp, formatHours } from '@/utils/planner'
import { summarizePlan } from '@/utils/plannerTools'
import { useProfilePlansFor } from '@/composables/useProfilePlan'

// Every saved plan as a card, each linking to the plan's own address.
const props = defineProps({
  plans: { type: Array, required: true },
  // { [planId]: { pct (0 to 1), done, total } } for the plans whose player is tracked.
  progress: { type: Object, default: () => ({}) },
  progressLoading: { type: Boolean, default: false },
  // { [planId]: totals } worked out the way the plan page does (methods the player cannot use are skipped); a card without one works out its own.
  summaries: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['duplicate', 'delete'])

// Which plan is the goal on your profile, and showing or removing one from the card's menu.
const onProfile = useProfilePlansFor(computed(() => props.plans))
function profileToggle(id) {
  menuFor.value = ''
  onProfile.toggle(id)
}

const MAX_ICONS = 5
// The three-dot menu that is open (a plan id), closed by a click anywhere else or Escape.
const menuFor = ref('')
function toggleMenu(id) {
  menuFor.value = menuFor.value === id ? '' : id
}
function duplicate(id) {
  menuFor.value = ''
  emit('duplicate', id)
}
// The plan waiting for a yes or a no.
const pending = ref(null)
const cancelBtn = ref(null)
function askDelete(p) {
  menuFor.value = ''
  pending.value = { id: p.id, name: p.name }
}
function confirmDelete() {
  const id = pending.value?.id
  pending.value = null
  if (id) emit('delete', id)
}
// The safe choice has focus, and Escape closes the window.
watch(pending, async (p) => {
  if (!p) return
  await nextTick()
  cancelBtn.value?.focus()
})
const onKey = (e) => {
  if (e.key !== 'Escape') return
  if (pending.value) pending.value = null
  else menuFor.value = ''
}
const onDoc = () => (menuFor.value = '')
onMounted(() => {
  document.addEventListener('keydown', onKey)
  document.addEventListener('click', onDoc)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.removeEventListener('click', onDoc)
})
// 0 to 1 as a percentage; a few percent keep a decimal so early progress is visible.
const pctText = (v) => {
  const p = v * 100
  return `${p > 0 && p < 10 ? p.toFixed(1) : Math.floor(p)}%`
}
const fmtDate = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
const rows = computed(() =>
  props.plans.map((p) => {
    const goals = p.goals || []
    const skills = goals.map((g) => g.skill)
    return {
      id: p.id,
      name: p.name,
      hasPlayer: !!p.player?.rsn,
      sub: [p.player?.rsn, `${goals.length} skill${goals.length === 1 ? '' : 's'}`].filter(Boolean).join(' · '),
      icons: skills.slice(0, MAX_ICONS),
      more: Math.max(skills.length - MAX_ICONS, 0),
      hours: p.hoursPerDay,
      summary: props.summaries[p.id] || summarizePlan(p),
      updated: fmtDate(p.updatedAt),
    }
  }),
)
</script>
