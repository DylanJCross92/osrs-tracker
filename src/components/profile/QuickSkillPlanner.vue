<template>
  <div class="qp">
    <div class="qp-head">
      <h3 v-if="!hideTitle" class="qp-title">Quick planner</h3>
      <span v-else />
      <RouterLink class="qp-full" :to="{ name: 'planner', query: plannerQuery }" @click="track('quick_planner_open_full', { skill })">Open in full planner →</RouterLink>
    </div>

    <p v-if="maxed" class="qp-note">{{ skill }} is at 200M XP, the most the game counts. Nothing left to plan here.</p>

    <!-- Goal -->
    <div v-else class="qp-goal" role="group" aria-label="Goal">
      <span class="qp-label">Goal</span>
      <button v-for="o in options" :key="o.key" type="button" class="qp-chip" :class="{ active: active.key === o.key }" @click="pick(o.key)">{{ o.label }}</button>
      <label class="qp-custom" :class="{ active: active.key === 'custom' }">
        <span>Custom level</span>
        <input v-model.number="customLevel" type="number" inputmode="numeric" :min="level + 1" max="126" :placeholder="String(level + 1)" aria-label="Custom target level" @focus="pick('custom')" @input="pick('custom')" />
      </label>
    </div>

    <p v-if="!maxed && !hasTarget" class="qp-note">Pick a goal above to see how long it takes.</p>

    <template v-else-if="hasTarget">
      <!-- Answer -->
      <div class="qp-tiles">
        <div class="qp-tile"><small>XP to go</small><b>{{ formatNum(plan.remainingXp) }}</b></div>
        <div class="qp-tile"><small>Time</small><b>{{ plan.hours == null ? '-' : formatHours(plan.hours) }}</b></div>
        <div class="qp-tile">
          <small>At <select v-model.number="hoursPerDay" class="qp-hpd" aria-label="Hours played per day"><option v-for="h in HPD" :key="h" :value="h">{{ h }} h</option></select> a day</small>
          <b>{{ days == null ? '-' : days === 0 ? 'Done' : `${days} ${days === 1 ? 'day' : 'days'}` }}</b>
        </div>
        <div class="qp-tile"><small>Net GP</small><b :class="gpClass(plan.netGp)">{{ plan.netGp == null ? 'No GP data' : formatGp(plan.netGp) }}</b></div>
      </div>

      <!-- Route -->
      <div class="qp-strategies" role="tablist" aria-label="Route">
        <button v-for="s in STRATEGIES" :key="s.key" type="button" role="tab" :aria-selected="strategy === s.key" class="qp-tab" :class="{ active: strategy === s.key }" @click="setStrategy(s.key)">{{ s.label }}</button>
      </div>
      <p class="qp-strategy-note">{{ STRATEGIES.find((s) => s.key === strategy).note }}</p>
      <PlannerRoute :segments="plan.segments" />
      <p v-if="plan.warning" class="qp-warn">{{ plan.warning }}</p>

      <!-- Methods -->
      <details v-if="methodRows.length" class="qp-methods">
        <summary>Compare training methods ({{ methodRows.length }})</summary>
        <div class="planner-table-scroll">
          <table class="planner-table">
            <caption class="sr-only">{{ skill }} training methods for this goal</caption>
            <thead><tr><th>Method</th><th class="num">XP per hour</th><th class="num">Time</th><th class="num">Net GP</th></tr></thead>
            <tbody>
              <tr v-for="r in methodRows" :key="r.method.id">
                <td>{{ r.method.name }}</td>
                <td class="num">{{ formatNum(r.method.xpPerHour) }}</td>
                <td class="num">{{ formatHours(r.plan.hours) }}</td>
                <td class="num" :class="gpClass(r.plan.netGp)">{{ r.plan.netGp == null ? 'No GP data' : formatGp(r.plan.netGp) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
      <p class="qp-foot">Estimates use typical rates for each method, so real times vary with gear, boosts and how you play.</p>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import PlannerRoute from '@/components/planner/PlannerRoute.vue'
import { AUTO_FAST, AUTO_CHEAP, AUTO_BALANCED, AUTO_PROFIT, MAX_XP, compareMethods, encodePlan, formatGp, formatHours, formatNum, levelAtXp, planGoal, xpAtLevel } from '@/utils/planner'
import { track } from '@/utils/analytics'

const props = defineProps({
  skill: { type: String, required: true },
  xp: { type: Number, required: true },
  username: { type: String, default: '' },
  // The modal has its own heading.
  hideTitle: { type: Boolean, default: false },
})

const HPD = [1, 2, 3, 4, 6, 8]
const STRATEGIES = [
  { key: AUTO_FAST, label: 'Fastest', note: 'The quickest method at every level on the way.' },
  { key: AUTO_BALANCED, label: 'Balanced', note: 'Weighs gp costs against your time, so it avoids methods that burn gold for little speed.' },
  { key: AUTO_CHEAP, label: 'Cheapest', note: 'The lowest gp cost per XP, even when it takes longer.' },
  { key: AUTO_PROFIT, label: 'Best gp/hour', note: 'The method that earns the most gp for each hour you play. Cheapest keeps more gp over the whole goal, but this one pays best per hour.' },
]
const MILESTONE_LEVELS = [50, 60, 70, 75, 80, 85, 90, 92, 95, 99]
const MILESTONE_XP = [10_000_000, 25_000_000, 50_000_000, 100_000_000, 200_000_000]

const hoursPerDay = ref(2)
const strategy = ref(AUTO_FAST)
const sel = ref('')
const customLevel = ref(null)

const level = computed(() => levelAtXp(props.xp, true))
const maxed = computed(() => props.xp >= MAX_XP)

// Goals worth offering: the next level, the next couple of round levels and 99; past 99 it is XP milestones.
const options = computed(() => {
  const list = []
  if (props.xp < xpAtLevel(99)) {
    const next = level.value + 1
    list.push({ key: `l${next}`, label: next === 99 ? 'Level 99' : `Next level (${next})`, targetXp: xpAtLevel(next) })
    const rounds = MILESTONE_LEVELS.filter((m) => m > next)
    for (const m of rounds.slice(0, 2)) if (!list.some((o) => o.targetXp === xpAtLevel(m))) list.push({ key: `l${m}`, label: `Level ${m}`, targetXp: xpAtLevel(m) })
    if (!list.some((o) => o.targetXp === xpAtLevel(99))) list.push({ key: 'l99', label: 'Level 99', targetXp: xpAtLevel(99) })
  } else {
    for (const t of MILESTONE_XP.filter((m) => m > props.xp).slice(0, 3)) list.push({ key: `x${t}`, label: `${t / 1_000_000}M XP`, targetXp: t })
  }
  return list
})

const customTarget = computed(() => {
  const l = Math.floor(Number(customLevel.value))
  return Number.isFinite(l) && l > level.value && l <= 126 ? Math.min(xpAtLevel(l), MAX_XP) : null
})
const active = computed(() => {
  if (sel.value === 'custom') return { key: 'custom', targetXp: customTarget.value }
  return options.value.find((o) => o.key === sel.value) || options.value[0] || { key: '', targetXp: null }
})
const hasTarget = computed(() => active.value.targetXp != null && active.value.targetXp > props.xp)

function pick(key) {
  if (sel.value !== key) track('quick_planner_goal', { skill: props.skill, goal: key === 'custom' ? 'custom' : 'preset' })
  sel.value = key
}
function setStrategy(key) {
  strategy.value = key
  track('quick_planner_route', { skill: props.skill, route: key })
}

// A different skill (or a new player) starts over from the first goal.
watch(() => [props.skill, props.username], () => {
  sel.value = ''
  customLevel.value = null
  strategy.value = AUTO_FAST
})

const goal = computed(() => ({ skill: props.skill, currentXp: props.xp, targetXp: active.value.targetXp || 0 }))
const plan = computed(() => (hasTarget.value ? planGoal({ ...goal.value, methodId: strategy.value }) : null))
const days = computed(() => (plan.value?.hours == null ? null : plan.value.hours === 0 ? 0 : Math.ceil(plan.value.hours / hoursPerDay.value)))
// Each catalog method on its own (with a fastest climb up to it), quickest first.
const methodRows = computed(() => (hasTarget.value ? compareMethods(goal.value).slice(0, 8) : []))

const plannerQuery = computed(() => {
  const target = active.value.targetXp
  if (!target || target <= props.xp) return props.username ? { u: props.username } : {}
  const params = encodePlan({ username: props.username, hoursPerDay: hoursPerDay.value, goals: [{ skill: props.skill, currentXp: props.xp, targetXp: target, methodId: strategy.value, customXpPerHour: 0 }] })
  return Object.fromEntries(params)
})

const gpClass = (gp) => (gp == null ? '' : gp >= 0 ? 'planner-gain' : 'planner-cost')
</script>
