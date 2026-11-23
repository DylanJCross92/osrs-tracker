<template>
  <Teleport to="body">
    <div class="modal-overlay ppv-overlay" @click.self="$emit('close')">
      <div class="modal-card ppv" role="dialog" aria-modal="true" aria-labelledby="ppv-h">
        <header class="ppv-head">
          <div>
            <span class="rp-kicker">{{ kindLabel }}</span>
            <h2 id="ppv-h">{{ plan.title }}</h2>
            <p>{{ plan.description }}</p>
          </div>
          <button ref="closeBtn" class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
        </header>

        <dl class="ppv-totals">
          <div><dt>Goals</dt><dd>{{ rows.length }} skill{{ rows.length === 1 ? '' : 's' }}</dd></div>
          <div><dt>Time</dt><dd>{{ formatHours(summary.totalHours) }}</dd></div>
          <div><dt>At {{ hoursPerDay }} h/day</dt><dd>{{ summary.days != null ? `${summary.days.toLocaleString('en-US')} days` : formatHours(summary.totalHours) }}</dd></div>
          <div v-if="summary.netGp != null"><dt>{{ summary.netGp >= 0 ? 'Profit' : 'GP cost' }}</dt><dd :class="summary.netGp >= 0 ? 'planner-gain' : 'planner-cost'">{{ formatGp(summary.netGp).replace(/ gp$/, '') }}</dd></div>
        </dl>

        <p class="ppv-note">{{ hasPlayer ? `Worked out from ${playerLabel}'s stats.` : 'Every skill starts from level 1 until you add your name.' }} The order below is the one the plan trains them in.</p>

        <ol class="ppv-rows" aria-label="Goals in this plan">
          <li v-for="(r, i) in rows" :key="r.skill">
            <span class="ppv-n">{{ i + 1 }}</span>
            <img :src="skillIconSrc(r.skill)" alt="" width="22" height="22" />
            <b>{{ r.skill }}</b>
            <span class="ppv-levels">{{ r.from }} → {{ r.to }}</span>
            <span class="ppv-time">{{ formatHours(r.hours) }}</span>
            <span v-if="r.netGp != null" class="ppv-gp" :class="r.netGp >= 0 ? 'planner-gain' : 'planner-cost'">{{ formatGp(r.netGp).replace(/ gp$/, '') }}</span>
          </li>
        </ol>

        <footer class="ppv-foot">
          <button class="btn btn-ghost" type="button" @click="$emit('close')">Back</button>
          <button class="btn btn-primary" type="button" @click="$emit('use', plan)">Use this plan</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatGp, formatHours, levelAtXp, planGoal } from '@/utils/planner'
import { resolveGoal, summarizePlan } from '@/utils/plannerTools'
import { smartOrder } from '@/utils/smartOrder'

// A look inside a recommended plan before choosing it: every goal in the order it would be trained, with its levels, time and gp.
const props = defineProps({
  plan: { type: Object, required: true },
  hasPlayer: { type: Boolean, default: false },
  playerLabel: { type: String, default: '' },
  hoursPerDay: { type: Number, default: 2 },
  globalStrategy: { type: String, default: 'auto-fast' },
  gpValue: { type: Number, default: 2_000_000 },
})
const emit = defineEmits(['close', 'use'])

const KIND_LABELS = { levels: 'All skills', combat: 'Combat', total: 'Total level' }
const kindLabel = computed(() => KIND_LABELS[props.plan.kind] || 'Plan')
const summary = computed(() => summarizePlan({ goals: props.plan.goals, globalStrategy: props.globalStrategy, gpValue: props.gpValue, hoursPerDay: props.hoursPerDay }))
// The goals in the suggested order (the plan is started in that order), each worked out on its own.
const rows = computed(() => {
  const goals = props.plan.goals
  const plans = goals.map((g) => planGoal(resolveGoal(g, props.globalStrategy, props.gpValue)))
  const { order } = smartOrder(goals, plans)
  const rank = new Map(order.map((skill, i) => [skill, i]))
  return goals
    .map((g, i) => ({ skill: g.skill, from: levelAtXp(g.currentXp, true), to: levelAtXp(g.targetXp, true), hours: plans[i].hours || 0, netGp: plans[i].netGp }))
    .sort((a, b) => rank.get(a.skill) - rank.get(b.skill))
})

// Escape closes this window only (not one it was opened from).
const closeBtn = ref(null)
const onKey = (e) => {
  if (e.key !== 'Escape') return
  e.stopImmediatePropagation()
  emit('close')
}
onMounted(() => {
  document.addEventListener('keydown', onKey, true)
  closeBtn.value?.focus()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey, true))
</script>
