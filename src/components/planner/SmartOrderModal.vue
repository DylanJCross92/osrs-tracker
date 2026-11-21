<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-card smo" role="dialog" aria-modal="true" aria-labelledby="smo-h" aria-describedby="smo-d">
        <div class="smo-head">
          <svg class="smo-star s1" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.2 8.8L23 12l-8.8 2.2L12 23l-2.2-8.8L1 12l8.8-2.2z" /></svg>
          <svg class="smo-star s2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.2 8.8L23 12l-8.8 2.2L12 23l-2.2-8.8L1 12l8.8-2.2z" /></svg>
          <svg class="smo-star s3" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.2 8.8L23 12l-8.8 2.2L12 23l-2.2-8.8L1 12l8.8-2.2z" /></svg>
          <svg class="smo-star s4" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.2 8.8L23 12l-8.8 2.2L12 23l-2.2-8.8L1 12l8.8-2.2z" /></svg>
          <span class="smo-spark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z" /></svg>
          </span>
          <div class="smo-title">
            <span class="smo-eyebrow">Tailored to your plan</span>
            <h2 id="smo-h">Smart order</h2>
            <p id="smo-d" :class="{ 'smo-ok': ready && !suggestion.changed }">
              <template v-if="!ready">Reading your levels, costs and what each skill unlocks…</template>
              <template v-else-if="suggestion.changed">Read {{ suggestion.summary.skills }} skills against your levels, costs and what each one unlocks.</template>
              <template v-else><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Already the best order for your levels and costs.</template>
            </p>
          </div>
          <button class="smo-close" type="button" aria-label="Close" @click="$emit('close')">✕</button>
        </div>

        <!-- A short "thinking" beat before the answer shows -->
        <div v-if="!ready" class="smo-think" aria-hidden="true">
          <div v-for="n in 4" :key="n" class="smo-skel" :style="{ '--d': `${n * 90}ms` }" />
        </div>

        <template v-else>
          <!-- No player yet: the order is only as good as the levels it was worked out from. The name goes in right here, in the planner's own player box (with its recent players and suggestions). -->
          <div v-if="!hasPlayer" class="smo-name">
            <p class="smo-name-lead"><b>More accurate with your name.</b> Right now every skill starts at level 1. Enter your RuneScape name and the order uses your real levels.</p>
            <slot name="name-box" />
          </div>
          <p v-else-if="openedWithoutPlayer" class="smo-fits" role="status">Now using {{ playerLabel || 'your' }}{{ playerLabel ? "'s" : '' }} levels. The order below is worked out from them.</p>
          <div class="smo-colhead">
            <span>Net cost</span>
            <b v-if="suggestion.summary.netGp != null" :class="suggestion.summary.netGp >= 0 ? 'gain' : 'cost'" title="Earned or spent over the whole plan at today's prices">{{ gp(suggestion.summary.netGp) }}</b>
          </div>
          <ol class="smo-list">
            <li v-for="(skill, i) in suggestion.order" :key="skill" :style="{ '--i': i }">
              <span class="smo-n" :title="moved(skill, i) ? `Was number ${was.get(skill) + 1} in your order` : undefined">
                <span aria-hidden="true">{{ i + 1 }}</span>
                <small v-if="moved(skill, i)" class="smo-mv" :class="was.get(skill) > i ? 'up' : 'down'"><span aria-hidden="true">{{ was.get(skill) > i ? '↑' : '↓' }}</span> was {{ was.get(skill) + 1 }}</small>
              </span>
              <img :src="skillIconSrc(skill)" alt="" width="28" height="28" />
              <div class="smo-main">
                <b>{{ skill }}<em v-if="levels[skill]">{{ levels[skill] }}</em></b>
                <span v-for="r in suggestion.reasons[skill] || []" :key="r">{{ r }}</span>
              </div>
              <div v-if="figure(skill)" class="smo-fig" :class="figure(skill).tone" :title="figure(skill).title">
                <b>{{ figure(skill).value }}</b>
                <small>{{ figure(skill).rate }}</small>
                <i :style="{ width: `${figure(skill).bar}%` }" aria-hidden="true" />
              </div>
            </li>
          </ol>
        </template>

        <div class="save-plan-actions">
          <template v-if="suggestion.changed">
            <button class="btn btn-ghost" type="button" @click="$emit('close')">Keep mine</button>
            <button ref="useBtn" class="btn btn-primary" type="button" :disabled="!ready" @click="$emit('apply', suggestion.order)">Use this order</button>
          </template>
          <button v-else ref="useBtn" class="btn btn-primary" type="button" @click="$emit('close')">Looks good</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatGp, levelAtXp } from '@/utils/planner'

// The suggestion from utils/smartOrder.js: the order with a short reason for each skill, what each skill's goal earns or costs in gp (the
// figure on the right, with a bar for how big it is next to the others), and a button to use it.
const props = defineProps({
  suggestion: { type: Object, required: true },
  goals: { type: Array, required: true },
  hasPlayer: { type: Boolean, default: true },
  playerLabel: { type: String, default: '' },
})
const emit = defineEmits(['close', 'apply'])
const useBtn = ref(null)
// Opened without a player: once one is loaded from the box above the list, say the order now uses their levels.
const openedWithoutPlayer = !props.hasPlayer
// A short pause before the answer, so it reads as worked out. Skipped for anyone who asked for less motion.
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
const ready = ref(!!reduced)
let timer = null

const levels = computed(() => Object.fromEntries(props.goals.map((g) => [g.skill, `${levelAtXp(g.currentXp, true)} → ${levelAtXp(g.targetXp, true)}`])))
// Where each skill sits in the order you have now, so a skill that moves shows where it came from.
const was = computed(() => new Map(props.goals.map((g, i) => [g.skill, i])))
const moved = (skill, i) => props.suggestion.changed && was.value.has(skill) && was.value.get(skill) !== i
const maxAbs = computed(() => Math.max(1, ...Object.values(props.suggestion.stats || {}).map((s) => Math.abs(s.netGp || 0))))
const gp = (n) => formatGp(Math.round(n)).replace(/ gp$/, '')
function figure(skill) {
  const s = props.suggestion.stats?.[skill]
  if (!s || s.netGp == null || s.hours <= 0) return null
  const tone = s.netGp >= 0 ? 'gain' : 'cost'
  return {
    tone,
    value: gp(s.netGp),
    rate: s.gph != null ? `${gp(s.gph)} gp/h` : '',
    bar: Math.max(4, Math.round((Math.abs(s.netGp) / maxAbs.value) * 100)),
    title: `${s.netGp >= 0 ? 'Earns' : 'Costs'} ${formatGp(Math.round(Math.abs(s.netGp))).replace(/^[+-]/, '')} over this goal at today's prices`,
  }
}

const onKey = (e) => {
  if (e.key === 'Escape') emit('close')
}
onMounted(async () => {
  document.addEventListener('keydown', onKey)
  if (!ready.value) timer = setTimeout(() => (ready.value = true), 700)
  await nextTick()
  useBtn.value?.focus()
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  clearTimeout(timer)
})
</script>
