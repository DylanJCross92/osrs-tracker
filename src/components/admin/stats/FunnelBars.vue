<template>
  <div class="fbar">
    <p v-if="!top" class="st-empty">Nobody has been recorded for this funnel yet.</p>
    <template v-else>
      <p v-if="worst" class="fbar-worst" role="note">
        <b>Biggest drop:</b> between "{{ funnel.steps[funnel.biggestDrop - 1].label }}" and "{{ worst.label }}", {{ people(worst.lost) }} ({{ pctText(100 - (worst.ofPrevious || 0)) }}) did not go on.
        <span v-if="worst.lowSample" class="fbar-chip is-warn">small sample</span>
      </p>
      <ol class="fbar-steps">
        <template v-for="(s, i) in funnel.steps" :key="s.key">
          <li v-if="i" class="fbar-drop" :class="{ 'is-worst': i === funnel.biggestDrop }">
            <span class="fbar-drop-main">
              <span aria-hidden="true">↓</span>
              <b>{{ pctText(s.ofPrevious) }}</b> carried on
              <span class="fbar-lost">{{ fmt(s.lost) }} lost</span>
              <span v-if="i === funnel.biggestDrop" class="fbar-chip is-worst">Biggest drop</span>
              <span v-if="s.lowSample" class="fbar-chip is-warn" title="Few people reached the step before, so this percentage may be chance">small sample</span>
            </span>
            <small v-if="s.medianLabel">typically {{ s.medianLabel }} after the step before</small>
          </li>
          <li class="fbar-step" :title="stepTitle(s, i)">
            <div class="fbar-head">
              <span class="fbar-label">{{ s.label }}</span>
              <b class="fbar-num">{{ fmt(s.value) }}</b>
              <span class="fbar-pct">{{ i ? pctText(s.ofFirst) : '100%' }}</span>
            </div>
            <span class="fbar-track" role="img" :aria-label="`${s.label}: ${fmt(s.value)} people in order, ${fmt(s.independent)} at all`">
              <i v-if="s.bypassed" class="fbar-ghost" :style="{ width: `${width(s.independent)}%` }" />
              <i class="fbar-fill" :class="{ 'is-worst': i === funnel.biggestDrop }" :style="{ width: `${width(s.value)}%` }" />
            </span>
            <small v-if="s.bypassed" class="fbar-note">{{ fmt(s.independent) }} did this at any point, {{ fmt(s.bypassed) }} of them without getting here in order</small>
          </li>
        </template>
      </ol>
      <p class="st-note fbar-key"><span class="fbar-swatch" aria-hidden="true" /> Solid bar: people who reached the step in order. <span class="fbar-swatch is-ghost" aria-hidden="true" /> Faint bar: everyone who did it at all, in any order.</p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { fmt } from './statsFormat'

const props = defineProps({ funnel: { type: Object, required: true } })

const top = computed(() => props.funnel.steps[0]?.value || 0)
const worst = computed(() => (props.funnel.biggestDrop != null ? props.funnel.steps[props.funnel.biggestDrop] : null))
const width = (v) => (v ? Math.max(1.5, Math.min(100, (v / top.value) * 100)) : 0)
const people = (n) => `${fmt(n)} ${n === 1 ? 'person' : 'people'}`
const pctText = (p) => (p == null ? '-' : `${Number.isInteger(p) ? p : p.toFixed(1)}%`)
const stepTitle = (s, i) => `${s.label}: ${fmt(s.value)} in order${i ? ` (${pctText(s.ofFirst)} of everyone)` : ''}; ${fmt(s.independent)} did it at all`
</script>
