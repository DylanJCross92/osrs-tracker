<template>
  <div class="spw">
    <!-- where you are -->
    <nav class="spw-progress" aria-label="Steps">
      <ol>
        <li v-for="(s, i) in STEPS" :key="s.key" :class="{ on: i === step, done: i < step }">
          <button type="button" :disabled="i > furthest || (i > 0 && !hasPlayer)" :aria-current="i === step ? 'step' : undefined" @click="go(i)"><span>{{ i + 1 }}</span>{{ s.label }}</button>
        </li>
      </ol>
    </nav>

    <!-- 1: you (the player, then what kind of account) -->
    <section v-if="current === 'who'" class="spw-step" aria-labelledby="spw-h">
      <h3 id="spw-h">{{ hasPlayer ? `Planning for ${playerLabel || 'you'}` : 'Enter your RuneScape name' }}</h3>
      <p v-if="!hasPlayer" class="spw-sub">The Smart Planner uses your real levels, so it needs your name.</p>
      <slot name="name-box" />
      <template v-if="hasPlayer">
        <fieldset class="spl-ask">
          <legend>Free-to-play or members?</legend>
          <div class="spl-choices two" role="radiogroup" aria-label="Membership">
            <button type="button" role="radio" :aria-checked="profile.members" :class="{ on: profile.members }" @click="set({ members: true }, 'members')"><b>Members</b><small>Every skill and method</small></button>
            <button type="button" role="radio" :aria-checked="!profile.members" :class="{ on: !profile.members }" @click="set({ members: false }, 'members')"><b>Free-to-play</b><small>The free skills only</small></button>
          </div>
        </fieldset>
        <fieldset class="spl-ask">
          <legend>Main account or ironman?</legend>
          <div class="spl-choices two" role="radiogroup" aria-label="Account type">
            <button type="button" role="radio" :aria-checked="!profile.iron" :class="{ on: !profile.iron }" @click="set({ iron: false }, 'account')"><b>Main account</b><small>You can buy and sell</small></button>
            <button type="button" role="radio" :aria-checked="profile.iron" :class="{ on: profile.iron }" @click="set({ iron: true }, 'account')"><b>Ironman</b><small>You gather everything yourself</small></button>
          </div>
        </fieldset>
      </template>
    </section>

    <!-- 2: the goal -->
    <section v-else-if="current === 'goal'" class="spw-step" aria-labelledby="spw-h">
      <h3 id="spw-h">What do you want most?</h3>
      <div class="spl-choices" role="radiogroup" aria-label="Main goal">
        <button v-for="g in goalChoices" :key="g.key" type="button" role="radio" :aria-checked="profile.goal === g.key" :class="[{ on: profile.goal === g.key }, 'spw-goal']" @click="set({ goal: g.key }, 'goal')">
          <span class="spw-goal-art" aria-hidden="true"><img v-for="s in GOAL_ART[g.key]" :key="s" :src="s.startsWith('/') ? s : skillIconSrc(s)" alt="" width="26" height="26" /></span>
          <span class="spw-goal-text"><b>{{ g.label }}</b><small>{{ g.hint }}</small></span>
        </button>
      </div>
    </section>

    <!-- 3: time and gp -->
    <section v-else-if="current === 'time'" class="spw-step" aria-labelledby="spw-h">
      <h3 id="spw-h">How much time and gp do you have?</h3>
      <fieldset class="spl-ask">
        <legend>Hours a day you can play</legend>
        <div class="pset-hours">
          <div class="pset-read"><b>{{ profile.hours }}</b> hour{{ profile.hours === 1 ? '' : 's' }} a day</div>
          <div class="pset-range">
            <button type="button" aria-label="Half an hour less" :disabled="profile.hours <= 0.5" @click="set({ hours: profile.hours - 0.5 }, 'hours')">−</button>
            <input type="range" min="0.5" max="12" step="0.5" :value="profile.hours" :style="{ '--fill': fill + '%' }" aria-label="Hours played per day" @input="set({ hours: Number($event.target.value) }, 'hours')" />
            <button type="button" aria-label="Half an hour more" :disabled="profile.hours >= 12" @click="set({ hours: profile.hours + 0.5 }, 'hours')">+</button>
          </div>
        </div>
      </fieldset>
      <!-- An ironman cannot buy anything, so there is no gp to ask about -->
      <fieldset v-if="!profile.iron" class="spl-ask">
        <legend>Gp you can spend</legend>
        <div class="spl-gp" role="radiogroup" aria-label="Starting gp">
          <button v-for="(g, i) in GP_LEVELS" :key="g.key" type="button" role="radio" :aria-checked="profile.gp === g.key" :class="{ on: profile.gp === g.key }" @click="set({ gp: g.key }, 'gp')">
            <CoinStack :level="i + 1" />
            <span>{{ g.label }}</span>
          </button>
        </div>
      </fieldset>
    </section>

    <!-- 4: the plan -->
    <section v-else class="spw-step spw-result" aria-labelledby="spw-h" aria-live="polite">
      <h3 id="spw-h">Your plan</h3>
      <ul class="spw-chips" aria-label="Your answers">
        <li><button type="button" @click="go(0)">{{ playerLabel || 'Your levels' }}<small>change</small></button></li>
        <li><button type="button" @click="go(1)">{{ profile.members ? 'Members' : 'Free-to-play' }}{{ profile.iron ? ' · Ironman' : '' }}</button></li>
        <li><button type="button" @click="go(2)">{{ goalLabel }}</button></li>
        <li><button type="button" @click="go(3)">{{ profile.hours }} h a day{{ profile.iron ? '' : ` · ${gpLabel}` }}</button></li>
      </ul>

      <div v-if="thinking" class="spl-think" aria-hidden="true">
        <div v-for="n in 4" :key="n" class="spl-skel" :style="{ '--d': `${n * 90}ms` }" />
      </div>

      <template v-else>
        <p v-if="shown.empty" class="empty-hint">Nothing to recommend for these answers. Go back and change one of them.</p>
        <section v-for="p in shown.phases" :key="p.id" class="spl-phase" :class="{ later: p.later }">
          <header>
            <span class="spl-num">{{ p.later ? '›' : phaseNumber(p) }}</span>
            <div><b>{{ p.later ? `Then: ${lower(p.title)}` : p.title }}</b><small v-if="p.later">{{ laterLine(p) }}</small><small v-else-if="p.why">{{ p.why }}</small></div>
          </header>
          <ol v-if="!p.later">
            <li v-for="(r, i) in p.rows.slice(0, SHOW_ROWS)" :key="r.skill || r.id" :style="{ '--i': i }">
              <template v-if="r.kind === 'quest'">
                <span class="spw-quest" aria-hidden="true">★</span>
                <div class="spl-main"><b>{{ r.title }}</b><span>{{ r.rewards }}</span><span v-for="t in r.reasons || []" :key="t" class="spl-why">{{ t }}</span></div>
                <div class="spl-fig"><b v-if="r.hours">{{ r.estimated ? '~' : '' }}{{ formatHours(r.hours) }}</b><small v-if="r.estimated">estimate</small></div>
              </template>
              <template v-else>
                <img :src="skillIconSrc(r.skill)" alt="" width="26" height="26" />
                <div class="spl-main">
                  <b>{{ r.skill }}<em>{{ r.from }} → {{ r.to }}</em></b>
                  <span v-for="t in r.reasons" :key="t">{{ t }}</span>
                  <span v-if="r.quests.length" class="spl-quests">Quest shortcut{{ r.quests.length === 1 ? '' : 's' }}: {{ r.quests.join(', ') }}</span>
                </div>
                <div class="spl-fig">
                  <b>{{ r.hours == null ? '-' : formatHours(r.hours) }}</b>
                  <small v-if="r.netGp != null && Math.abs(r.netGp) >= 1000" class="gp-figure" :class="r.netGp >= 0 ? 'planner-gain' : 'planner-cost'">{{ gpShort(r.netGp) }}</small>
                </div>
              </template>
            </li>
          </ol>
          <p v-if="!p.later && p.rows.length > SHOW_ROWS" class="spl-more">and {{ p.rows.length - SHOW_ROWS }} more</p>
        </section>

        <p v-for="n in shown.notes" :key="n" class="spl-note">{{ n }}</p>
        <p v-if="shown.profile.iron" class="spl-note">As an ironman you gather what these routes use yourself, so the cheapest routes lead and gp is left out. The plan's supplies list shows what to gather.</p>
        <p v-if="shown.profile.goal === 'money' && !shown.empty" class="spl-note">Check each method's requirements before you start; the plan lists them.</p>
        <details v-if="!shown.empty" class="spl-checks">
          <summary>What this plan assumed, and what it left out</summary>
          <ul>
            <li>Combat level {{ shown.assumed.combat }}, worked out from your levels.</li>
            <li>{{ shown.assumed.members ? 'Members' : 'Free-to-play' }}{{ shown.assumed.iron ? ', ironman' : '' }}.</li>
            <li v-if="shown.assumed.doneQuests">{{ shown.assumed.doneQuests }} quest{{ shown.assumed.doneQuests === 1 ? '' : 's' }} you marked finished in the planner are left out.</li>
            <li v-else>No quests are marked finished, so any of them could be suggested. Mark the ones you have done in the <RouterLink :to="{ name: 'quests' }">quest and diary tracker</RouterLink>.</li>
            <li>Quest lengths are for a first run, not a speedrun, and rates are approximate.</li>
          </ul>
          <template v-if="shown.skippedQuests.length">
            <b class="spl-checks-h">Left out for now</b>
            <ul>
              <li v-for="q in shown.skippedQuests" :key="q.id"><b>{{ q.title }}</b> {{ q.reason }}</li>
            </ul>
          </template>
        </details>
        <p v-if="!shown.empty" class="spl-sum">
          <b>{{ shown.totals.goals }}</b> goal{{ shown.totals.goals === 1 ? '' : 's' }} · about <b>{{ formatHours(shown.totals.hours) }}</b>
          <template v-if="shown.totals.days"> · <b>{{ shown.totals.days.toLocaleString('en-US') }}</b> day{{ shown.totals.days === 1 ? '' : 's' }} at {{ shown.settings.hoursPerDay }} h/day</template>
          <template v-if="shown.totals.netGp != null && Math.abs(shown.totals.netGp) >= 1000 && !shown.profile.iron"> · <b :class="shown.totals.netGp >= 0 ? 'planner-gain' : 'planner-cost'">{{ gpShort(shown.totals.netGp) }}</b></template>
        </p>
        <p v-if="!shown.empty" class="spl-report"><button class="btn-text" type="button" @click="reportOpen = true">This plan looks wrong</button></p>
      </template>
    </section>
    <SmartPlanReport v-if="reportOpen" :plan="shown" @close="reportOpen = false" />

    <!-- the first thing we would do, so far (the recommendation, along the way) -->
    <p v-if="current !== 'plan' && hasPlayer && teaser" class="spw-teaser" aria-live="polite"><span aria-hidden="true">✦</span> So far we would start with <b>{{ teaser }}</b>.</p>

    <footer class="spw-nav">
      <button v-if="step > 0" class="btn btn-ghost" type="button" @click="go(step - 1)">Back</button>
      <span class="spw-grow" />
      <a v-if="current === 'plan'" class="spl-alt" href="#ps-start" @click.prevent="$emit('ready-made')">or pick a ready-made plan</a>
      <button v-if="current !== 'plan'" class="btn btn-primary" type="button" :disabled="current === 'who' && !hasPlayer" @click="go(step + 1)">{{ current === 'time' ? 'Show my plan' : 'Continue' }}</button>
      <button v-else class="btn btn-primary" type="button" :disabled="thinking || shown.empty" @click="start">Start this plan</button>
    </footer>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePlannerProfile } from '@/composables/usePlannerProfile'
import { useRequirements } from '@/composables/useRequirements'
import { EXPERIENCE, GOALS, GP_LEVELS, recommend } from '@/utils/smartPlanner'
import { skillIconSrc } from '@/utils/osrsSkills'
import CoinStack from '@/components/planner/CoinStack.vue'
import SmartPlanReport from '@/components/planner/SmartPlanReport.vue'
import { formatGp, formatHours } from '@/utils/planner'
import { track } from '@/utils/analytics'

// The skills that stand for each goal, drawn beside it
const GOAL_ART = {
  skills: ['Overall'],
  money: ['/icons/methods/coins_10000.png', 'Runecraft', 'Mining'],
  combat: ['Attack', 'Strength', 'Defence'],
  quests: ['Magic', 'Slayer', 'Crafting'],
  afk: ['Woodcutting', 'Fishing', 'Hitpoints'],
  hardcore: ['Runecraft', 'Agility', 'Mining'],
}

// The Smart Planner, one question at a time: who, a little about you, the goal, time and gp, then the plan (see utils/smartPlanner.js). Each
// step says what we would start with so far. "Start this plan" hands the answers to the planner, which builds the plan from the player's
// stats at that moment.
const props = defineProps({
  skills: { type: Object, default: null },
  hasPlayer: { type: Boolean, default: false },
  playerLabel: { type: String, default: '' },
})
const emit = defineEmits(['start', 'ready-made'])

const STEPS = [
  { key: 'who', label: 'You' },
  { key: 'goal', label: 'Goal' },
  { key: 'time', label: 'Time and gp' },
  { key: 'plan', label: 'Your plan' },
]
const SHOW_ROWS = 8
const { profile, answer } = usePlannerProfile()
const step = ref(0)
const reportOpen = ref(false)
const furthest = ref(step.value)
const current = computed(() => STEPS[step.value].key)
function go(i) {
  // Nothing past the name step without a player: the plan is worked out from their levels.
  if (i > 0 && !props.hasPlayer) return
  step.value = Math.max(0, Math.min(STEPS.length - 1, i))
  furthest.value = Math.max(furthest.value, step.value)
  track('smart_planner_step', { step: STEPS[step.value].key })
}

const fill = computed(() => ((profile.value.hours - 0.5) / 11.5) * 100)
const gpShort = (n) => formatGp(Math.round(n)).replace(/ gp$/, '')
// "Make money" reads as "make money" mid-sentence, but a title that opens with an acronym ("AFK training") keeps its capitals
const lower = (t) => (/^[A-Z]{2}/.test(t) ? t : `${t.charAt(0).toLowerCase()}${t.slice(1)}`)
// "Make money" is not offered to an ironman (nothing can be sold).
const goalChoices = computed(() => GOALS.filter((g) => !(profile.value.iron && g.key === 'money')))
const goalLabel = computed(() => GOALS.find((g) => g.key === profile.value.goal)?.label || '')
const gpLabel = computed(() => GP_LEVELS.find((g) => g.key === profile.value.gp)?.label || '')

// Worked out as soon as anything changes; the plan step shows it after a short beat so a change reads as the plan being worked out.
// Quests marked finished (in the planner's quest tracker) are left out of the steps.
const { doneQuestIds } = useRequirements()
const live = computed(() => recommend(profile.value, props.skills, { done: new Set(doneQuestIds.value) }))
const teaser = computed(() => {
  const p = live.value.phases.find((x) => !x.later)
  return p && live.value.totals.goals ? `${lower(p.title)} (${live.value.totals.goals} goal${live.value.totals.goals === 1 ? '' : 's'}, about ${formatHours(live.value.totals.hours)})` : ''
})
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
const shown = ref(live.value)
const thinking = ref(false)
let timer = null
// Seeing the finished plan is logged once each time the plan step is reached, when the plan is really on screen (after the short beat),
// not again every time the answers or the player's stats work it out afresh while it stays open.
let viewedLogged = false
function logViewed() {
  if (viewedLogged || current.value !== 'plan' || shown.value.empty) return
  viewedLogged = true
  track('smart_planner_plan_viewed', { goal: profile.value.goal, goals: shown.value.totals.goals })
}
watch(
  [live, current],
  () => {
    if (current.value !== 'plan') viewedLogged = false
    if (current.value !== 'plan' || reduced) {
      shown.value = live.value
      thinking.value = false
      logViewed()
      return
    }
    thinking.value = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      shown.value = live.value
      thinking.value = false
      logViewed()
    }, 450)
  },
  { flush: 'post' },
)
onBeforeUnmount(() => clearTimeout(timer))

// If the player is taken away (Change on the name box), back to the name.
watch(
  () => props.hasPlayer,
  (has) => {
    if (!has) {
      step.value = 0
      furthest.value = 0
    }
  },
)
// 1, 2, 3 for the steps of the plan itself (what comes later has no number).
const phaseNumber = (p) => shown.value.phases.filter((x) => !x.later).indexOf(p) + 1
const laterLine = (p) => `${p.rows.length} more ${p.rows.length === 1 ? 'skill' : 'skills'}, after this plan.`

// The first step counts too (moving between steps is tracked in go()). Seeing the finished plan, for the funnel, is logged by logViewed() above.
onMounted(() => track('smart_planner_step', { step: STEPS[0].key }))

// An answer counts once, not every time it is changed in quick succession (dragging the hours slider sends a change at every notch).
const lastAnswer = new Map()
function set(patch, question) {
  answer(patch)
  const now = Date.now()
  if (now - (lastAnswer.get(question) || 0) > 1500) track('smart_planner_answer', { question })
  lastAnswer.set(question, now)
}
function start() {
  track('smart_planner_start', { goal: profile.value.goal, members: profile.value.members, experience: profile.value.experience, iron: profile.value.iron, hasPlayer: props.hasPlayer, goals: shown.value.totals.goals })
  emit('start', { ...profile.value })
}
</script>
