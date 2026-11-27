<template>
  <div class="se" :aria-label="`Edit ${goal.skill}`">
    <!-- What the plan for this skill comes to, kept in view while it is edited -->
    <p class="se-live" aria-live="polite">
      <b>{{ goal.skill }} {{ plannedLevel }} → {{ endLevel }}</b>
      <span v-if="plan.remainingXp > 0"><b>{{ formatHours(plan.hours) }}</b> to train</span>
      <span v-else-if="(plan.questList || []).length">Covered by quests</span>
      <span v-else>Nothing left to train</span>
      <span v-if="plan.remainingXp > 0">{{ formatNum(plan.remainingXp) }} XP to go</span>
      <span v-if="plan.netGp != null && Math.abs(plan.netGp) >= 1000" class="gp-figure" :class="plan.netGp >= 0 ? 'planner-gain' : 'planner-cost'">{{ formatGp(plan.netGp) }}</span>
    </p>

    <!-- 1. The goal -->
    <section class="se-sec" aria-labelledby="se-h-goal">
      <div class="se-sec-head">
        <h4 id="se-h-goal"><i>1.</i> Set your goal</h4>
        <div class="range-tabs se-mode" role="group" aria-label="Set the goal as">
          <button type="button" :class="{ active: goalMode === 'level' }" :aria-pressed="goalMode === 'level'" @click="goalMode = 'level'">Level</button>
          <button type="button" :class="{ active: goalMode === 'xp' }" :aria-pressed="goalMode === 'xp'" @click="goalMode = 'xp'">XP</button>
        </div>
      </div>
      <div v-if="goal.allowedMethodIds?.length" class="planner-notice">
        This skill only uses {{ goal.allowedMethodIds.length }} chosen method{{ goal.allowedMethodIds.length === 1 ? '' : 's' }} (set in the skill calculator).
        <button class="btn-text" type="button" @click="$emit('patch', { allowedMethodIds: null })">Use all methods</button>
      </div>
      <div class="se-levels">
        <label>
          <span>{{ goalMode === 'level' ? 'Starting level' : 'Starting XP' }}</span>
          <NumberInput v-if="goalMode === 'level'" :model-value="startLevel" :min="1" :max="MAX_VIRTUAL_LEVEL" commit="blur" @update:model-value="setStartLevel" />
          <NumberInput v-else :model-value="goal.currentXp" :min="0" :max="MAX_XP - 1" commit="blur" @update:model-value="setStartXp" />
          <small class="se-equiv">{{ goalMode === 'level' ? `${formatNum(goal.currentXp)} XP` : `Level ${startLevel}` }}</small>
        </label>
        <span class="se-arrow" aria-hidden="true">→</span>
        <label>
          <span>{{ goalMode === 'level' ? 'Target level' : 'Target XP' }}</span>
          <NumberInput v-if="goalMode === 'level'" :model-value="endLevel" :min="2" :max="MAX_VIRTUAL_LEVEL" commit="blur" @update:model-value="setTargetLevel" />
          <NumberInput v-else :model-value="goal.targetXp" :min="1" :max="MAX_XP" commit="blur" @update:model-value="setTargetXp" />
          <small class="se-equiv">{{ goalMode === 'level' ? `${formatNum(goal.targetXp)} XP` : `Level ${endLevel}` }}</small>
        </label>
        <p class="se-gain"><b>+{{ formatNum(Math.max(goal.targetXp - goal.currentXp, 0)) }}</b><small>XP to gain</small></p>
      </div>
      <div class="se-goal-tools">
        <button v-if="canReset" class="se-reset" type="button" :title="`Set the start to the level and XP on the hiscores now (level ${hiscoreLevel}, ${formatNum(hiscoreXp)} XP)`" @click="resetToHiscores">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" /><path d="M3 3v5h5" /></svg>
          Reset start to hiscores (level {{ hiscoreLevel }})
        </button>
        <span v-else-if="hiscoreXp != null" class="se-hiscore">Hiscores: level {{ hiscoreLevel }}</span>
        <div v-if="goalChips.length" class="se-quick" role="group" aria-label="Quick goals">
          <span>Quick goals</span>
          <button v-for="l in goalChips" :key="l" type="button" @click="setTargetLevel(l)">{{ l }}</button>
        </div>
      </div>
    </section>

    <!-- 2. How the planner picks -->
    <section class="se-sec" aria-labelledby="se-h-style">
      <h4 id="se-h-style"><i>2.</i> Choose your training style</h4>
      <div class="se-opts" role="radiogroup" aria-label="Training style" :style="{ '--n': strategyChips.length }">
        <button v-for="c in strategyChips" :key="c.value" type="button" role="radio" class="se-opt" :class="{ on: goal.methodId === c.value }" :aria-checked="goal.methodId === c.value" @click="$emit('patch', { methodId: c.value })">
          <span class="se-opt-ico" aria-hidden="true">
            <svg v-if="c.icon === 'plan'" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></svg>
            <svg v-else-if="c.icon === 'fast'" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3L5 13h6l-1 8 8-10h-6l1-8z" /></svg>
            <svg v-else-if="c.icon === 'cheap'" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="5.5" /><path d="M9 6.5v5M15.5 11.5A5.5 5.5 0 1118 18a5.5 5.5 0 01-5-3" /></svg>
            <svg v-else-if="c.icon === 'balanced'" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16M7 20h10M5 8h14" /><path d="M5 8l-3 7a3 3 0 006 0L5 8zM19 8l-3 7a3 3 0 006 0l-3-7z" /></svg>
            <svg v-else viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l6-6 4 4 6-8M15 7h5v5" /></svg>
          </span>
          <span class="se-opt-text"><b>{{ c.label }}</b><small>{{ c.hint }}</small></span>
          <span class="se-opt-mark" aria-hidden="true">
            <svg v-if="goal.methodId === c.value" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5" /><path d="M8 12.3l2.8 2.8L16.2 9.5" /></svg>
            <i v-else />
          </span>
        </button>
      </div>
    </section>

    <!-- 3. What that comes to, step by step -->
    <section class="se-sec" aria-labelledby="se-h-route">
      <h4 id="se-h-route"><i>3.</i> Your recommended route</h4>
      <div class="se-stats">
        <div><small>Training time</small><b>{{ plan.remainingXp > 0 ? formatHours(plan.hours) : 'None left' }}</b></div>
        <div>
          <small>{{ plan.netGp != null && plan.netGp > 0 ? 'Estimated profit' : 'Estimated cost' }}</small>
          <b>{{ plan.netGp == null ? 'No gp data' : formatGp(Math.abs(plan.netGp)).replace('+', '') }}</b>
        </div>
        <div><small>XP needed</small><b>{{ formatNum(plan.remainingXp) }}</b></div>
      </div>

      <div v-if="routeChoices" class="se-choices">
        <template v-if="routeChoices.trained.length">
          <p class="se-hint">What did you train levels {{ routeChoices.from }} → {{ routeChoices.upTo }} with? The levels left follow it.</p>
          <div class="range-tabs se-trained" role="group" aria-label="What you trained with">
            <button v-for="f in routeChoices.trained" :key="f.id" type="button" :class="{ active: f.on }" :aria-pressed="f.on" @click="$emit('patch', { overrides: f.overrides })">{{ f.label }}</button>
            <button type="button" :class="{ active: routeChoices.plannersPick }" :aria-pressed="routeChoices.plannersPick" @click="$emit('patch', { overrides: [] })">Planner's pick</button>
          </div>
        </template>
        <template v-if="routeChoices.carryOn || routeChoices.fastest">
          <p class="se-hint">For the levels left ({{ routeChoices.upTo }} → {{ routeChoices.to }}):</p>
          <div class="se-next">
            <button v-for="o in [routeChoices.carryOn, routeChoices.fastest].filter(Boolean)" :key="o.key" type="button" class="se-next-opt" :class="{ on: o.same }" @click="$emit('patch', { overrides: o.overrides })">
              <b>{{ o.title }}</b>
              <span>{{ o.names }}</span>
              <small>{{ o.hours == null ? '' : formatHours(o.hours) }}<template v-if="o.netGp != null"> · {{ formatGp(o.netGp) }}</template><template v-if="o.key === 'fast' && o.savesHours > 0.05"> · saves {{ formatHours(o.savesHours) }}</template><template v-if="o.same"> · what the plan does now</template></small>
            </button>
          </div>
        </template>
      </div>

      <PlannerRoute :segments="routeSegments" :quests="plan.questList" :skill="goal.skill" @set="setRange" />
      <p v-if="doneRoute && doneRoute.netGp != null" class="se-hint se-made">
        Levels {{ doneStart }} → {{ doneEnd }} already trained: <b :class="doneRoute.netGp >= 0 ? 'planner-gain' : 'planner-cost'">{{ formatGp(doneRoute.netGp) }}</b> made with the methods above. Change a step to say what you really used.
      </p>
      <p v-if="overrideCount" class="se-hint">
        You chose the method for {{ overrideCount }} set{{ overrideCount === 1 ? '' : 's' }} of levels.
        <button class="btn-text" type="button" @click="$emit('patch', { overrides: [] })">Back to recommended</button>
      </p>

      <button class="se-more-link" type="button" :aria-expanded="customOpen" @click="customOpen = !customOpen">{{ customOpen ? 'Close' : 'Customize training methods' }} <span aria-hidden="true">{{ customOpen ? '↑' : '→' }}</span></button>
      <div v-if="customOpen" class="se-custom">
        <h5 class="se-sub">One method for every level</h5>
        <div class="se-pick">
          <MethodPicker :model-value="isSpecific ? goal.methodId : ''" :methods="methods" :routes="[]" @update:model-value="$emit('patch', { methodId: $event })" />
          <label v-if="goal.methodId === 'custom'" class="se-inline">
            <span>XP per hour</span>
            <NumberInput :model-value="goal.customXpPerHour" :min="1" :max="10000000" commit="blur" @update:model-value="$emit('patch', { customXpPerHour: $event })" />
          </label>
        </div>
        <p v-if="method" class="se-hint">
          {{ method.description }} · {{ method.intensity }} intensity<span class="gp-figure"> ·
          <GpTip :method="method">{{ method.gpPerHour == null ? 'no GP data' : `${formatGp(method.gpPerHour)}/h` }}</GpTip></span>
        </p>
        <button v-if="isSpecific" class="btn-text" type="button" @click="$emit('patch', { methodId: GLOBAL_STRATEGY })">Use the plan's strategy again</button>
        <h5 class="se-sub">A method for a range of levels</h5>
        <p class="se-hint">Or press Change on a step above to use a different method for just those levels.</p>
        <div class="route-range">
          <div class="route-range-form">
            <label><span>From level</span><NumberInput :model-value="rangeFrom" :min="startLevel" :max="endLevel - 1" commit="blur" @update:model-value="(v) => v && (rangeFrom = Math.min(Math.max(v, startLevel), endLevel - 1))" /></label>
            <span class="goal-levels-arrow" aria-hidden="true">→</span>
            <label><span>To level</span><NumberInput :model-value="rangeTo" :min="startLevel + 1" :max="endLevel" commit="blur" @update:model-value="(v) => v && (rangeTo = Math.min(Math.max(v, startLevel + 1), endLevel))" /></label>
            <div class="route-range-pick">
              <span>Method</span>
              <MethodPicker v-if="rangeMethods.length && rangeTo > rangeFrom" inline model-value="" :methods="rangeMethods" :allow-custom="false" @update:model-value="applyRange" />
              <small v-else class="planner-hint">{{ rangeTo > rangeFrom ? 'No single method covers all of those levels. Try a shorter range.' : 'Pick a target level above the start level.' }}</small>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. Ways to improve it -->
    <section class="se-sec" aria-labelledby="se-h-opt">
      <h4 id="se-h-opt">Optimize your route</h4>
      <div class="se-acc">
        <div v-for="r in rows" :key="r.key" class="se-acc-row" :class="{ open: openRow === r.key }">
          <button type="button" class="se-acc-head" :aria-expanded="openRow === r.key" :aria-controls="`se-acc-${r.key}`" @click="toggleRow(r.key)">
            <span class="se-acc-ico" aria-hidden="true">
              <svg v-if="r.key === 'quests'" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5M12 6c2-1.5 5-2 8-1.5v13c-3-.5-6 0-8 1.5M12 6v13" /></svg>
              <svg v-else-if="r.key === 'requirements'" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6.5l1.5 1.5 2.5-3M3.5 12.5L5 14l2.5-3M3.5 18.5L5 20l2.5-3M11 7h10M11 13h10M11 19h10" /></svg>
              <svg v-else-if="r.key === 'compare'" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20V12M12 20V5M19 20v-5" /></svg>
              <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l7-4 7 4v8l-7 4-7-4V8zM5 8l7 4 7-4M12 12v8" /></svg>
            </span>
            <span class="se-acc-text"><b>{{ r.title }}<i v-if="r.badge" :class="r.badgeClass">{{ r.badge }}</i></b><small>{{ r.text }}</small></span>
            <svg class="se-acc-chev" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>

          <div v-if="openRow === r.key" :id="`se-acc-${r.key}`" class="se-acc-body">
            <!-- Quest shortcuts -->
            <PlannerQuests
              v-if="r.key === 'quests'"
              :model-value="goal.quests"
              :skill="goal.skill"
              :current-xp="planned.currentXp"
              :target-xp="goal.targetXp"
              :method-id="resolvedId"
              :gp-value="gpValue"
              @update:model-value="$emit('patch', { quests: $event })"
            />

            <!-- What you need to have unlocked -->
            <div v-else-if="r.key === 'requirements'" class="goal-reqs">
              <p v-if="chosenBlocked" class="planner-warning">
                ⚠ {{ chosenBlocked.method.name }} may not be accessible: {{ unmetNames(chosenBlocked) }} {{ chosenBlocked.unmet.length === 1 ? 'is' : 'are' }} marked as missing.
                <button class="btn-text" type="button" @click="$emit('patch', { methodId: GLOBAL_STRATEGY })">Use the plan's strategy instead</button>
              </p>
              <p v-else-if="blockedInRoute.length" class="planner-warning">
                <template v-if="respect">⚠ Part of this route uses {{ blockedInRoute.map((a) => a.method.name).join(', ') }}, which you are missing something for. No other method covers that stretch of levels.</template>
                <template v-else>⚠ This route uses {{ blockedInRoute.map((a) => a.method.name).join(', ') }}, which you are missing something for, because "Skip methods I can't use yet" is off.</template>
              </p>
              <p v-else-if="routeState === 'unconfirmed'" class="se-hint">Confirm what you already have. Anything you are not sure about is treated as available, so nothing is hidden from you.</p>
              <p v-else class="se-hint">Everything this route needs is covered.</p>
              <div v-for="a in routeMethods" :key="a.method.id" class="goal-req-method" :class="`is-${a.state}`">
                <div class="goal-req-head">
                  <b>{{ a.method.name }}</b>
                  <span class="goal-req-state">{{ STATE_TEXT[a.state] }}</span>
                </div>
                <RequirementList :items="a.items" :method-name="a.method.name" />
              </div>
              <p class="se-hint">
                <template v-if="loggedIn">Your answers are saved to your account and used in every plan. <RouterLink :to="{ name: 'quests' }">Open your quest tracker</RouterLink></template>
                <template v-else>Your answers are saved in this browser. <RouterLink :to="{ name: 'login', query: { next: '/quests' } }">Log in</RouterLink> to keep them on your account and use them on every device.</template>
              </p>
            </div>

            <PlannerCompare v-else-if="r.key === 'compare'" :goal="resolved" :plans="compare" :plan="plan" :selected-id="resolvedId" @pick="(id) => $emit('pick', id)" />
            <PlannerMaterials v-else :plan="plan" />
          </div>
        </div>
      </div>
      <button class="se-remove" type="button" @click="$emit('remove')">Remove {{ goal.skill }} from the plan</button>
    </section>

    <div class="se-foot">
      <button class="se-cancel" type="button" @click="$emit('cancel')">Cancel changes</button>
      <button class="btn btn-primary" type="button" @click="$emit('done')">{{ saved ? 'Save changes' : 'Save goal' }}</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import NumberInput from '@/components/NumberInput.vue'
import PlannerRoute from '@/components/planner/PlannerRoute.vue'
import PlannerQuests from '@/components/planner/PlannerQuests.vue'
import PlannerCompare from '@/components/planner/PlannerCompare.vue'
import PlannerMaterials from '@/components/planner/PlannerMaterials.vue'
import MethodPicker from '@/components/planner/MethodPicker.vue'
import GpTip from '@/components/planner/GpTip.vue'
import RequirementList from '@/components/planner/RequirementList.vue'
import { methodsForSkill, getMethod } from '@/data/trainingMethods'
import { questsForSkill } from '@/data/quests'
import { useRouteRequirements } from '@/composables/useRouteRequirements'
import { useRequirements } from '@/composables/useRequirements'
import { useAuth } from '@/composables/useAuth'
import {
  AUTO_FAST,
  AUTO_CHEAP,
  AUTO_BALANCED,
  AUTO_PROFIT,
  GLOBAL_STRATEGY,
  isAuto,
  levelAtXp,
  xpAtLevel,
  MAX_VIRTUAL_LEVEL,
  MAX_XP,
  setOverrideRange,
  relevantMethods,
  profitableMethods,
  formatGp,
  formatNum,
  formatHours,
} from '@/utils/planner'
import { STRATEGY_LABELS, materialsForPlan } from '@/utils/plannerTools'

// Everything about one skill's plan, in one place: how it is trained, the levels, what it needs, quest shortcuts and the rest.
// Changes go up as `patch` events and the plan page recalculates, so the route above it is always current.
const props = defineProps({
  goal: { type: Object, required: true },
  plan: { type: Object, required: true },
  compare: { type: Object, required: true },
  globalStrategy: { type: String, required: true },
  gpValue: { type: Number, required: true },
  index: { type: Number, required: true },
  count: { type: Number, required: true },
  // The goal as it stands today (start moved up to tracked XP).
  liveGoal: { type: Object, default: null },
  // The levels already trained, planned from the start up to where the player is now (null when none): they are listed first as done.
  doneRoute: { type: Object, default: null },
  // What was trained and the ways to carry on (see routeChoices in PlannerView), or null.
  routeChoices: { type: Object, default: null },
  // The player's XP in this skill on the hiscores now (null when no player is loaded), so the start can be put back to it.
  hiscoreXp: { type: Number, default: null },
  // Whether the plan is saved (closing the editor then saves the changes), or a draft (it only applies them).
  saved: { type: Boolean, default: false },
  // Which tab opens first.
  initialTab: { type: String, default: 'method' },
})
const emit = defineEmits(['patch', 'pick', 'remove', 'done', 'cancel'])

const { respect } = useRequirements()
const { loggedIn } = useAuth()
const STATE_TEXT = { blocked: 'Requirement missing', unconfirmed: 'Needs confirming', planned: 'Your plan covers it', available: 'Requirements met' }

const isOverride = computed(() => props.goal.methodId !== GLOBAL_STRATEGY)
const resolvedId = computed(() => (props.goal.methodId === GLOBAL_STRATEGY ? props.globalStrategy : props.goal.methodId))
const planned = computed(() => props.liveGoal || props.goal)
const resolved = computed(() => ({ ...planned.value, methodId: resolvedId.value, gpValuePerHour: props.gpValue }))
const method = computed(() => (isAuto(resolvedId.value) || resolvedId.value === 'custom' ? null : getMethod(resolvedId.value)))
const startLevel = computed(() => levelAtXp(props.goal.currentXp, true))
const endLevel = computed(() => levelAtXp(props.goal.targetXp, true))
const plannedLevel = computed(() => levelAtXp(planned.value.currentXp, true))
const globalLabel = computed(() => (STRATEGY_LABELS[props.globalStrategy] || 'Fastest').toLowerCase())

// --- Requirements of every method the route uses, plus the one picked by hand
const { routeMethods, routeState } = useRouteRequirements(computed(() => props.plan), method)
const chosenBlocked = computed(() => {
  const a = method.value ? routeMethods.value.find((x) => x.method.id === method.value.id) : null
  return a && a.state === 'blocked' ? a : null
})
const blockedInRoute = computed(() => routeMethods.value.filter((a) => a.state === 'blocked' && a.method.id !== method.value?.id))
const unmetNames = (a) => a.unmet.map((i) => i.req.label).join(', ')

// --- Level or XP: a goal can be set either way. It opens on XP when the goal is not exactly a level (it was set as XP).
const atLevelStart = (xp) => xpAtLevel(Math.min(levelAtXp(xp, true), MAX_VIRTUAL_LEVEL)) === xp
const goalMode = ref(atLevelStart(props.goal.targetXp) ? 'level' : 'xp')
function setStartXp(xp) {
  if (xp == null || !Number.isFinite(xp)) return
  emit('patch', { currentXp: Math.min(Math.max(Math.floor(xp), 0), MAX_XP - 1) })
}
function setTargetXp(xp) {
  if (!xp || !Number.isFinite(xp)) return
  emit('patch', { targetXp: Math.min(Math.max(Math.floor(xp), 1), MAX_XP) })
}

// --- The hiscores: where the player really is, to put the start back to after changing it
const hiscoreLevel = computed(() => (props.hiscoreXp == null ? null : levelAtXp(props.hiscoreXp, true)))
const canReset = computed(() => props.hiscoreXp != null && props.goal.currentXp !== props.hiscoreXp && props.hiscoreXp < props.goal.targetXp)
function resetToHiscores() {
  if (canReset.value) emit('patch', { currentXp: props.hiscoreXp })
}

// --- Levels
function setStartLevel(level) {
  if (!level) return
  emit('patch', { currentXp: xpAtLevel(Math.min(level, MAX_VIRTUAL_LEVEL)) })
}
function setTargetLevel(level) {
  if (!level) return
  emit('patch', { targetXp: Math.min(xpAtLevel(Math.min(level, MAX_VIRTUAL_LEVEL)), MAX_XP) })
}

// The route as a whole: what is already trained (marked done), then what is left.
const routeSegments = computed(() => [...(props.doneRoute?.segments || []).map((seg) => ({ ...seg, done: true })), ...props.plan.segments])
const doneStart = computed(() => props.doneRoute?.segments?.[0]?.startLevel ?? startLevel.value)
const doneEnd = computed(() => props.doneRoute?.segments?.at(-1)?.endLevel ?? plannedLevel.value)

// --- Method choices
const methods = computed(() => {
  const list = relevantMethods(props.goal.skill, plannedLevel.value, endLevel.value)
  const picked = getMethod(props.goal.methodId)
  return picked && !list.some((x) => x.id === picked.id) ? [...list, picked] : list
})
const profitable = computed(() => profitableMethods(props.goal.skill, plannedLevel.value, endLevel.value))
const methodRoutes = computed(() => [
  { value: GLOBAL_STRATEGY, label: 'Follow the plan strategy', sub: STRATEGY_LABELS[props.globalStrategy] },
  { value: AUTO_FAST, label: 'Fastest route' },
  { value: AUTO_CHEAP, label: 'Cheapest route' },
  { value: AUTO_BALANCED, label: 'Balanced route' },
  ...(profitable.value.length ? [{ value: AUTO_PROFIT, label: 'Best gp per hour route' }] : []),
])

// --- Methods chosen by hand for some levels: from the route rows, or from a range typed below them
const overrideCount = computed(() => (props.goal.overrides || []).length)
function setRange({ fromLevel, toLevel, methodId }) {
  emit('patch', { overrides: setOverrideRange(props.goal.overrides, fromLevel, toLevel, methodId) })
}
const rangeOpen = ref(false)
const rangeFrom = ref(1)
const rangeTo = ref(2)
function toggleRange() {
  rangeOpen.value = !rangeOpen.value
  if (rangeOpen.value) {
    rangeFrom.value = Math.min(startLevel.value, endLevel.value - 1)
    rangeTo.value = Math.min(endLevel.value, rangeFrom.value + 10)
  }
}
const rangeMethods = computed(() => methodsForSkill(props.goal.skill).filter((m) => m.minLevel <= rangeFrom.value && (m.maxLevel == null || m.maxLevel >= rangeTo.value - 1)))
function applyRange(id) {
  setRange({ fromLevel: rangeFrom.value, toLevel: rangeTo.value, methodId: id })
  rangeOpen.value = false
}

// --- Extras
const hasQuests = computed(() => questsForSkill(props.goal.skill).length > 0)
const hasMaterials = computed(() => materialsForPlan(props.plan).rows.length > 0)

// --- The plan for this skill: quick goals, how the planner picks, and the ways to make it better
const goalChips = computed(() => [50, 60, 70, 80, 90, 99].filter((l) => l > startLevel.value && l !== endLevel.value))
const strategyChips = computed(() => [
  { value: GLOBAL_STRATEGY, label: 'Use plan strategy', hint: `Currently ${globalLabel.value}`, icon: 'plan' },
  { value: AUTO_FAST, label: 'Fastest', hint: 'Reach your goal sooner', icon: 'fast' },
  { value: AUTO_CHEAP, label: 'Cheapest', hint: 'Spend as little gp as possible', icon: 'cheap' },
  { value: AUTO_BALANCED, label: 'Balanced', hint: 'Balance time and cost', icon: 'balanced' },
  ...(profitable.value.length ? [{ value: AUTO_PROFIT, label: 'Best gp per hour', hint: 'Earn the most gp while you train', icon: 'profit' }] : []),
])
const isSpecific = computed(() => !isAuto(props.goal.methodId) && props.goal.methodId !== GLOBAL_STRATEGY)
// The tools for choosing methods by hand (one method for all levels, a range of levels) are kept out of the way until asked for.
const customOpen = ref(isSpecific.value)

// --- Optimize your route: one row for each thing that can make the plan better, opened to do it in place
const questCount = computed(() => questsForSkill(props.goal.skill).length)
const blockedCount = computed(() => routeMethods.value.filter((a) => a.state === 'blocked').length)
const rows = computed(() => {
  const list = []
  if (hasQuests.value) {
    const added = (props.goal.quests || []).length
    list.push({
      key: 'quests',
      title: 'Quest shortcuts',
      badge: added ? `${added} in plan` : '',
      badgeClass: 'se-badge',
      text: `${questCount.value} quest${questCount.value === 1 ? '' : 's'} award ${props.goal.skill} XP.`,
    })
  }
  if (routeMethods.value.length) {
    const blocked = blockedCount.value
    list.push({
      key: 'requirements',
      title: 'Training requirements',
      badge: blocked ? `${blocked} missing` : routeState.value === 'unconfirmed' ? 'confirm' : '',
      badgeClass: blocked ? 'se-badge is-bad' : 'se-badge',
      text: blocked ? 'Some methods need something you are missing.' : routeState.value === 'unconfirmed' ? 'Confirm your available unlocks.' : 'Everything this route needs is covered.',
    })
  }
  list.push({ key: 'compare', title: 'Compare strategies', badge: '', text: 'Compare time and gp across routes.' })
  if (hasMaterials.value) list.push({ key: 'materials', title: 'Materials needed', badge: '', text: `${materialsForPlan(props.plan).rows.length} item${materialsForPlan(props.plan).rows.length === 1 ? '' : 's'} to gather or buy.` })
  return list
})
// Only one row is open at a time. A link that names one (the quest or requirements review from the plan page) opens it.
const FROM_TAB = { quests: 'quests', requirements: 'requirements', more: 'compare' }
const openRow = ref(FROM_TAB[props.initialTab] || '')
function toggleRow(key) {
  openRow.value = openRow.value === key ? '' : key
}
watch(
  () => props.initialTab,
  (t) => {
    if (FROM_TAB[t]) openRow.value = FROM_TAB[t]
  },
)
// A row that no longer exists (the last blocked method was swapped out) closes.
watch(rows, (list) => {
  if (openRow.value && !list.some((r) => r.key === openRow.value)) openRow.value = ''
})
</script>
