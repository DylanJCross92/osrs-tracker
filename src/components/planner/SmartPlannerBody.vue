<template>
  <div class="spl-body">
    <div v-if="!hasPlayer" class="spl-name">
      <p><b>More accurate with your name.</b> Right now every skill starts at level 1. Enter your RuneScape name and every step starts from your real levels.</p>
      <slot name="name-box" />
    </div>
    <p v-else class="spl-fits" role="status">Using {{ playerLabel || 'your' }}{{ playerLabel ? "'s" : '' }} levels.</p>

    <div class="spl-grid">
      <!-- the questions -->
      <div class="spl-q">
        <fieldset class="spl-ask">
          <legend>Free-to-play or members?</legend>
          <div class="spl-opts" role="radiogroup" aria-label="Membership">
            <button type="button" role="radio" :aria-checked="profile.members" :class="{ on: profile.members }" @click="set({ members: true }, 'members')">Members</button>
            <button type="button" role="radio" :aria-checked="!profile.members" :class="{ on: !profile.members }" @click="set({ members: false }, 'members')">Free-to-play</button>
          </div>
        </fieldset>

        <fieldset class="spl-ask">
          <legend>What do you want most?</legend>
          <div class="spl-choices" role="radiogroup" aria-label="Main goal">
            <button v-for="g in GOALS" :key="g.key" type="button" role="radio" :aria-checked="profile.goal === g.key" :class="{ on: profile.goal === g.key }" @click="set({ goal: g.key }, 'goal')">
              <b>{{ g.label }}</b><small>{{ g.hint }}</small>
            </button>
          </div>
        </fieldset>

        <fieldset class="spl-ask">
          <legend>How much time and gp do you have?</legend>
          <div class="pset-hours">
            <div class="pset-read"><b>{{ profile.hours }}</b> hour{{ profile.hours === 1 ? '' : 's' }} a day</div>
            <div class="pset-range">
              <button type="button" aria-label="Half an hour less" :disabled="profile.hours <= 0.5" @click="set({ hours: profile.hours - 0.5 }, 'hours')">−</button>
              <input type="range" min="0.5" max="12" step="0.5" :value="profile.hours" :style="{ '--fill': fill + '%' }" aria-label="Hours played per day" @input="set({ hours: Number($event.target.value) }, 'hours')" />
              <button type="button" aria-label="Half an hour more" :disabled="profile.hours >= 12" @click="set({ hours: profile.hours + 0.5 }, 'hours')">+</button>
            </div>
          </div>
          <div class="spl-opts spl-gp" role="radiogroup" aria-label="Starting gp">
            <button v-for="g in GP_LEVELS" :key="g.key" type="button" role="radio" :aria-checked="profile.gp === g.key" :class="{ on: profile.gp === g.key }" @click="set({ gp: g.key }, 'gp')">{{ g.label }}</button>
          </div>
        </fieldset>

        <fieldset class="spl-ask">
          <legend>How experienced are you?</legend>
          <div class="spl-opts" role="radiogroup" aria-label="Experience">
            <button v-for="e in EXPERIENCE" :key="e.key" type="button" role="radio" :aria-checked="profile.experience === e.key" :class="{ on: profile.experience === e.key }" :title="e.hint" @click="set({ experience: e.key }, 'experience')">{{ e.label }}</button>
          </div>
          <div class="spl-opts" role="radiogroup" aria-label="Account type">
            <button type="button" role="radio" :aria-checked="!profile.iron" :class="{ on: !profile.iron }" @click="set({ iron: false }, 'account')">Main account</button>
            <button type="button" role="radio" :aria-checked="profile.iron" :class="{ on: profile.iron }" @click="set({ iron: true }, 'account')">Ironman</button>
          </div>
        </fieldset>
      </div>

      <!-- the steps -->
      <div class="spl-r" aria-live="polite">
        <div class="spl-rhead">
          <h3>Your plan, step by step</h3>
          <p v-if="!touched" class="spl-basis">Based on a typical player. Answer on the left to tailor it.</p>
        </div>

        <div v-if="thinking" class="spl-think" aria-hidden="true">
          <div v-for="n in 4" :key="n" class="spl-skel" :style="{ '--d': `${n * 90}ms` }" />
        </div>

        <template v-else>
          <p v-if="shown.empty" class="empty-hint">Nothing to recommend for these answers yet. Try changing one of them.</p>
          <section v-for="p in shown.phases" :key="p.id" class="spl-phase" :class="{ later: p.later }">
            <header>
              <span class="spl-num">{{ p.later ? '›' : '1' }}</span>
              <div><b>{{ p.later ? `Then: ${p.title.charAt(0).toLowerCase()}${p.title.slice(1)}` : p.title }}</b><small v-if="p.later">After this plan, as your levels reach these.</small><small v-else-if="p.why">{{ p.why }}</small></div>
            </header>
            <ol>
              <li v-for="(r, i) in p.rows.slice(0, SHOW_ROWS)" :key="r.skill" :style="{ '--i': i }">
                <img :src="skillIconSrc(r.skill)" alt="" width="26" height="26" />
                <div class="spl-main">
                  <b>{{ r.skill }}<em>{{ r.from }} → {{ r.to }}</em></b>
                  <span v-for="t in r.reasons" :key="t">{{ t }}</span>
                  <span v-if="r.quests.length" class="spl-quests">Quest shortcut{{ r.quests.length === 1 ? '' : 's' }}: {{ r.quests.join(', ') }}</span>
                </div>
                <div class="spl-fig">
                  <b>{{ r.hours == null ? '-' : formatHours(r.hours) }}</b>
                  <small v-if="r.netGp != null && Math.abs(r.netGp) >= 1000" :class="r.netGp >= 0 ? 'planner-gain' : 'planner-cost'">{{ gpShort(r.netGp) }}</small>
                </div>
              </li>
            </ol>
            <p v-if="p.rows.length > SHOW_ROWS" class="spl-more">and {{ p.rows.length - SHOW_ROWS }} more {{ p.rows.length - SHOW_ROWS === 1 ? 'skill' : 'skills' }}</p>
          </section>

          <p v-for="n in shown.notes" :key="n" class="spl-note">{{ n }}</p>
          <p v-if="shown.profile.iron" class="spl-note">Costs use Grand Exchange prices. As an ironman you gather these supplies yourself, so read gp as the value of what you gather.</p>
        </template>

        <footer class="spl-foot">
          <p v-if="!thinking && !shown.empty" class="spl-sum">
            <b>{{ shown.totals.goals }}</b> goal{{ shown.totals.goals === 1 ? '' : 's' }} · about <b>{{ formatHours(shown.totals.hours) }}</b>
            <template v-if="shown.totals.days"> · <b>{{ shown.totals.days.toLocaleString('en-US') }}</b> day{{ shown.totals.days === 1 ? '' : 's' }} at {{ shown.settings.hoursPerDay }} h/day</template>
            <template v-if="shown.totals.netGp != null && Math.abs(shown.totals.netGp) >= 1000"> · <b :class="shown.totals.netGp >= 0 ? 'planner-gain' : 'planner-cost'">{{ gpShort(shown.totals.netGp) }}</b></template>
          </p>
          <div class="spl-actions">
            <button class="btn btn-primary" type="button" :disabled="thinking || shown.empty" @click="start">Start this plan</button>
            <a class="spl-alt" href="#ps-start" @click.prevent="$emit('ready-made')">or pick a ready-made plan</a>
          </div>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { usePlannerProfile } from '@/composables/usePlannerProfile'
import { EXPERIENCE, GOALS, GP_LEVELS, recommend } from '@/utils/smartPlanner'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatGp, formatHours } from '@/utils/planner'
import { track } from '@/utils/analytics'

// The Smart Planner: a few questions and the steps they lead to, changing as the answers change (see utils/smartPlanner.js). "Start this plan"
// hands the answers to the planner, which builds the plan from the player's stats at that moment.
const props = defineProps({
  skills: { type: Object, default: null },
  hasPlayer: { type: Boolean, default: false },
  playerLabel: { type: String, default: '' },
})
const emit = defineEmits(['start', 'ready-made'])

const SHOW_ROWS = 6
const { profile, touched, answer } = usePlannerProfile()
const fill = computed(() => ((profile.value.hours - 0.5) / 11.5) * 100)
const gpShort = (n) => formatGp(Math.round(n)).replace(/ gp$/, '')

// Worked out as soon as anything changes, but shown after a short beat so a change reads as the plan being worked out.
const live = computed(() => recommend(profile.value, props.skills))
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
const shown = ref(live.value)
const thinking = ref(false)
let timer = null
watch(live, (v) => {
  if (reduced) {
    shown.value = v
    return
  }
  thinking.value = true
  clearTimeout(timer)
  timer = setTimeout(() => {
    shown.value = live.value
    thinking.value = false
  }, 380)
})
onBeforeUnmount(() => clearTimeout(timer))

function set(patch, question) {
  answer(patch)
  track('smart_planner_answer', { question })
}
function start() {
  track('smart_planner_start', { goal: profile.value.goal, members: profile.value.members, experience: profile.value.experience, iron: profile.value.iron, hasPlayer: props.hasPlayer, goals: shown.value.totals.goals })
  emit('start', { ...profile.value })
}
</script>
