<template>
  <div class="prs" :class="{ 'is-gap': !step.seg.method, done: step.done }">
    <button class="prs-head" type="button" :aria-expanded="open" @click="$emit('toggle')">
      <span class="prs-num" :class="{ done: step.done }" aria-hidden="true">{{ step.done ? '✓' : step.number }}</span>
      <img v-if="showSkill" :src="skillIconSrc(step.skill)" :alt="step.skill" width="22" height="22" />
      <span class="prs-main">
        <b>{{ showSkill ? `${step.skill} ` : '' }}<em>{{ step.seg.startLevel }} → {{ step.seg.endLevel }}</em></b>
        <span class="prs-method">
          <img v-if="icon" class="route-ico" :src="icon" alt="" width="20" height="20" loading="lazy" />{{ step.seg.method ? step.seg.method.name : 'No catalog method' }}
          <RouteReqTip v-if="flag" :flag="flag" />
        </span>
      </span>
      <span class="prs-stats">
        <span class="prs-hours">{{ step.seg.hours == null ? '-' : formatHours(step.seg.hours) }}</span>
        <span class="prs-gp" :class="step.seg.netGp == null ? '' : step.seg.netGp >= 0 ? 'planner-gain' : 'planner-cost'"><i v-if="step.seg.method && step.seg.method.id && isLive(step.seg.method.id, step.seg.method.xpPerHour)" class="live-dot" title="Worked out from live Grand Exchange prices" aria-hidden="true" />{{ step.seg.netGp == null ? 'Unpriced' : formatGp(step.seg.netGp) }}</span>
      </span>
      <svg class="prs-chev" :class="{ open }" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </button>

    <div v-if="open" class="prs-body">
      <p v-if="step.seg.method?.description" class="prs-desc">{{ step.seg.method.description }}</p>
      <dl class="prs-facts">
        <div><dt>{{ step.done ? 'XP gained' : 'XP to gain' }}</dt><dd>{{ formatNum(step.seg.xp) }}</dd></div>
        <div v-if="step.seg.xpPerHour"><dt>XP per hour</dt><dd>~{{ formatNum(step.seg.xpPerHour) }}</dd></div>
        <div><dt>Time</dt><dd>{{ step.seg.hours == null ? '-' : formatHours(step.seg.hours) }}</dd></div>
        <div>
          <dt>Net GP</dt>
          <dd :class="step.seg.netGp == null ? '' : step.seg.netGp >= 0 ? 'planner-gain' : 'planner-cost'">
            <GpTip :method="step.seg.method && step.seg.method.gpPerHour !== undefined && step.seg.method.id ? step.seg.method : null" :hours="step.seg.hours">{{ step.seg.netGp == null ? 'Unpriced' : formatGp(step.seg.netGp) }}</GpTip>
          </dd>
        </div>
        <div v-if="step.seg.method?.intensity"><dt>Effort</dt><dd>{{ step.seg.method.intensity }}</dd></div>
        <div v-if="step.startDate && !step.done"><dt>When</dt><dd>{{ fmt(step.startDate) }} → {{ fmt(step.endDate) }}</dd></div>
      </dl>

      <div v-if="avail && avail.items.length" class="prs-reqs">
        <h4>Requirements <span class="prs-reqs-state" :class="`is-${avail.state}`">{{ STATE_TEXT[avail.state] }}</span></h4>
        <RequirementList :items="avail.items" :method-name="step.seg.method.name" />
      </div>
      <p v-else-if="step.seg.method" class="planner-hint">No special requirements beyond the level.</p>

      <button class="btn-text prs-edit" type="button" @click="$emit('open-goal')">Change the method for these levels in the {{ step.skill }} goal →</button>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import GpTip from '@/components/planner/GpTip.vue'
import { isLive } from '@/utils/methodPricing'
import RequirementList from '@/components/planner/RequirementList.vue'
import { plannerRequirementContext } from '@/composables/plannerRequirementContext'
import { methodAvailability, routeFlag } from '@/utils/requirements'
import RouteReqTip from '@/components/planner/RouteReqTip.vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import { methodIconSrc } from '@/data/methodIcons'
import { formatGp, formatHours, formatNum } from '@/utils/planner'

const props = defineProps({
  step: { type: Object, required: true },
  open: { type: Boolean, default: false },
  // Name the skill on the row (the flat order view needs it; the grouped view already has the skill as a heading).
  showSkill: { type: Boolean, default: false },
})
defineEmits(['toggle', 'open-goal'])

const STATE_TEXT = { blocked: 'Requirement missing', unconfirmed: 'Needs confirming', planned: 'Your plan covers it', available: 'Requirements met' }
const reqCtx = inject(plannerRequirementContext, null)
const avail = computed(() => (props.step.seg.method?.requirements && reqCtx ? methodAvailability(props.step.seg.method, reqCtx.value) : null))
const flag = computed(() => routeFlag(props.step.seg.method, reqCtx?.value))
const icon = computed(() => methodIconSrc(props.step.seg.method))
const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
</script>
