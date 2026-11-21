<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-card so" role="dialog" aria-modal="true" aria-labelledby="so-h" aria-describedby="so-d">
        <div class="so-head">
          <svg class="so-star s1" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.2 8.8L23 12l-8.8 2.2L12 23l-2.2-8.8L1 12l8.8-2.2z" /></svg>
          <svg class="so-star s2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.2 8.8L23 12l-8.8 2.2L12 23l-2.2-8.8L1 12l8.8-2.2z" /></svg>
          <svg class="so-star s3" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.2 8.8L23 12l-8.8 2.2L12 23l-2.2-8.8L1 12l8.8-2.2z" /></svg>
          <svg class="so-star s4" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.2 8.8L23 12l-8.8 2.2L12 23l-2.2-8.8L1 12l8.8-2.2z" /></svg>
          <span class="so-spark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z" /></svg>
          </span>
          <div class="so-title">
            <span class="so-eyebrow">Tailored to your plan</span>
            <h2 id="so-h">Smart order</h2>
            <p id="so-d">{{ ready ? `Read ${suggestion.summary.skills} skills against your levels, costs and what each one unlocks.` : 'Reading your levels, costs and what each skill unlocks…' }}</p>
          </div>
          <button class="so-close" type="button" aria-label="Close" @click="$emit('close')">✕</button>
        </div>

        <!-- A short "thinking" beat before the answer shows -->
        <div v-if="!ready" class="so-think" aria-hidden="true">
          <div v-for="n in 4" :key="n" class="so-skel" :style="{ '--d': `${n * 90}ms` }" />
        </div>

        <template v-else>
          <ul class="so-chips" aria-label="What it found">
            <li v-if="suggestion.summary.links"><b>{{ suggestion.summary.links }}</b> {{ suggestion.summary.links === 1 ? 'skill helps another' : 'skill links used' }}</li>
            <li v-if="suggestion.summary.earners"><b>{{ suggestion.summary.earners }}</b> earn gp first</li>
            <li v-if="suggestion.summary.spenders"><b>{{ suggestion.summary.spenders }}</b> big spend later</li>
            <li v-if="suggestion.summary.netGp != null" :class="suggestion.summary.netGp >= 0 ? 'gain' : 'cost'">Plan {{ gp(suggestion.summary.netGp) }}</li>
          </ul>
          <!-- No player yet: the order is only as good as the levels it was worked out from -->
          <div v-if="!hasPlayer" class="so-name" role="note">
            <p><b>More accurate with your name.</b> Right now every skill starts at level 1. Add your RuneScape name and the order uses your real levels.</p>
            <button class="btn btn-ghost so-name-btn" type="button" @click="$emit('add-name')">Add my RuneScape name</button>
          </div>
          <p v-if="!suggestion.changed" class="so-fits" role="status">Your order already fits. Nothing to change.</p>
          <ol class="so-list">
            <li v-for="(skill, i) in suggestion.order" :key="skill" :style="{ '--i': i }">
              <span class="so-n" aria-hidden="true">{{ i + 1 }}</span>
              <img :src="skillIconSrc(skill)" alt="" width="28" height="28" />
              <div class="so-main">
                <b>{{ skill }}<em v-if="levels[skill]">{{ levels[skill] }}</em></b>
                <span v-for="r in suggestion.reasons[skill] || []" :key="r">{{ r }}</span>
              </div>
              <div v-if="figure(skill)" class="so-fig" :class="figure(skill).tone" :title="figure(skill).title">
                <b>{{ figure(skill).value }}</b>
                <small>{{ figure(skill).rate }}</small>
                <i :style="{ width: `${figure(skill).bar}%` }" aria-hidden="true" />
              </div>
            </li>
          </ol>
        </template>

        <div class="save-plan-actions">
          <button class="btn btn-ghost" type="button" @click="$emit('close')">Keep mine</button>
          <button ref="useBtn" class="btn btn-primary" type="button" :disabled="!ready || !suggestion.changed" @click="$emit('apply', suggestion.order)">Use this order</button>
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
const props = defineProps({ suggestion: { type: Object, required: true }, goals: { type: Array, required: true }, hasPlayer: { type: Boolean, default: true } })
const emit = defineEmits(['close', 'apply', 'add-name'])
const useBtn = ref(null)
// A short pause before the answer, so it reads as worked out. Skipped for anyone who asked for less motion.
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
const ready = ref(!!reduced)
let timer = null

const levels = computed(() => Object.fromEntries(props.goals.map((g) => [g.skill, `${levelAtXp(g.currentXp, true)} → ${levelAtXp(g.targetXp, true)}`])))
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
