<template>
  <div class="st-pair fn">
    <!-- Conversion funnel: visit, add or view a player, sign up, claim -->
    <section class="st-card" aria-labelledby="fn-funnel">
      <div class="st-card-head"><h2 id="fn-funnel">Conversion funnel</h2><span class="st-hint">New people, last {{ days }} days</span></div>
      <p v-if="error" class="st-empty">{{ error }}</p>
      <p v-else-if="!data" class="st-empty">Loading…</p>
      <p v-else-if="!funnel.steps[0].value" class="st-empty">Nobody has been recorded in this time yet.</p>
      <template v-else>
        <ol class="fn-steps">
          <li v-for="(s, i) in funnel.steps" :key="s.key" class="fn-step">
            <p v-if="i" class="fn-drop">
              <span aria-hidden="true">↓</span>
              <template v-if="funnel.steps[i - 1].value">{{ pctText(s.ofPrevious) }} carried on · {{ fmt(funnel.steps[i - 1].value - s.value) }} did not</template>
              <template v-else>nobody reached the step before</template>
            </p>
            <div class="fn-row">
              <span class="fn-label">{{ s.label }}</span>
              <b class="fn-num">{{ fmt(s.value) }}</b>
              <span class="fn-pct" :title="i ? 'Share of everyone who visited' : ''">{{ i ? pctText(s.ofFirst) : '100%' }}</span>
            </div>
            <span class="fn-track" role="img" :aria-label="`${s.label}: ${fmt(s.value)}`"><i :style="{ width: `${barWidth(s.value)}%`, opacity: 1 - i * 0.18 }" /></span>
            <small v-if="s.detail && s.key === 'player'" class="fn-sub">{{ fmt(s.detail.added) }} added one · {{ fmt(s.detail.viewed) }} viewed one<template v-if="s.detail.both"> · {{ fmt(s.detail.both) }} did both</template></small>
            <small v-else-if="s.detail && s.key === 'signedUp'" class="fn-sub">{{ fmt(s.detail.confirmed) }} confirmed their email</small>
          </li>
        </ol>
        <p class="st-note">
          Each step counts only people who got through the steps before it. Someone who already had an account before this period is left out.
          <template v-if="funnel.skipped.signedUp">{{ count(funnel.skipped.signedUp, 'more person', 'more people') }} signed up without adding or viewing a player first<template v-if="funnel.skipped.claimed"> ({{ fmt(funnel.skipped.claimed) }} went on to claim one)</template>, so they are not in the bars.</template>
          <template v-if="data.capped"> Only the first 50,000 people are counted.</template>
        </p>
      </template>
    </section>

    <!-- User journey: the milestones, how long each takes, and the paths people take -->
    <section class="st-card" aria-labelledby="fn-journey">
      <div class="st-card-head"><h2 id="fn-journey">User journey</h2><span class="st-hint">Typical time = the median</span></div>
      <p v-if="error" class="st-empty">{{ error }}</p>
      <p v-else-if="!data" class="st-empty">Loading…</p>
      <p v-else-if="!journey.milestones[0].value" class="st-empty">Nobody has been recorded in this time yet.</p>
      <template v-else>
        <ol class="fn-line">
          <li v-for="m in journey.milestones" :key="m.key" :class="{ 'is-empty': !m.value }">
            <span class="fn-dot" aria-hidden="true" />
            <div class="fn-line-main">
              <span class="fn-line-name">{{ m.label }}</span>
              <small v-if="m.value && m.typicalLabel">typically {{ m.typicalLabel }}</small>
              <small v-else-if="!m.value">nobody yet</small>
            </div>
            <div class="fn-line-num">
              <b>{{ fmt(m.value) }}</b>
              <small v-if="m.ofBase != null">{{ pctText(m.ofBase) }} {{ m.baseLabel }}</small>
            </div>
          </li>
        </ol>
        <h3 class="so-sub">Most common paths</h3>
        <ul class="fn-paths">
          <li v-for="p in journey.paths" :key="p.key || 'none'">
            <span class="fn-path">
              <template v-for="(name, i) in p.label.split(' → ')" :key="i">
                <span v-if="i" class="fn-arrow" aria-hidden="true">→</span>
                <span class="fn-chip" :class="{ 'is-end': i === p.label.split(' → ').length - 1 && i > 0 }">{{ name }}</span>
              </template>
            </span>
            <span class="fn-path-num"><b>{{ fmt(p.n) }}</b> <small>{{ pctText(p.pct) }}</small></span>
          </li>
        </ul>
        <p v-if="journey.otherPaths" class="st-note">{{ count(journey.otherPaths, 'person', 'people') }} took a less common path. Open anyone on the Visitors tab to see what they did, in order.</p>
        <p v-else class="st-note">Open anyone on the Visitors tab to see what they did, in order.</p>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { fmt } from './statsFormat'

const props = defineProps({
  data: { type: Object, default: null },
  error: { type: String, default: '' },
  days: { type: Number, required: true },
})

const funnel = computed(() => props.data?.funnel)
const journey = computed(() => props.data?.journey)
const top = computed(() => Math.max(1, funnel.value?.steps[0]?.value || 1))
const barWidth = (v) => (v ? Math.max(2, (v / top.value) * 100) : 0)
const pctText = (p) => (p == null ? '-' : `${Number.isInteger(p) ? p : p.toFixed(1)}%`)
const count = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`
</script>
