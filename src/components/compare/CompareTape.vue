<template>
  <section class="card cmp-tape">
    <div class="cmp-tape-head">
      <h2>Tale of the tape</h2>
      <div class="cmp-score" role="img" :aria-label="`${nameA} leads ${score.a} stats, ${nameB} leads ${score.b}, out of ${score.total}`">
        <span class="cmp-score-side cmp-score-a" :class="{ 'is-lead': score.a > score.b }"><b>{{ score.a }}</b><small>{{ nameA }}</small></span>
        <span class="cmp-score-mid">of {{ score.total }}</span>
        <span class="cmp-score-side cmp-score-b" :class="{ 'is-lead': score.b > score.a }"><small>{{ nameB }}</small><b>{{ score.b }}</b></span>
      </div>
    </div>

    <div v-for="g in groups" :key="g.title" class="cmp-group">
      <h3>{{ g.title }}</h3>
      <div v-for="r in g.rows" :key="r.key" class="cmp-tape-row">
        <span class="cmp-tape-val cmp-tape-val-a" :class="{ 'is-lead': r.winner === 'a', 'is-trail': r.winner === 'b', 'cmp-gain': isGain(r, 'a') }">{{ formatCompareValue(r.kind, r.a) }}</span>
        <div class="cmp-tape-mid">
          <span class="cmp-tape-label">{{ r.label }}</span>
          <div class="cmp-bars" aria-hidden="true">
            <div class="cmp-half cmp-half-a"><i :class="{ 'is-lead': bright(r, 'a') }" :style="{ width: pct(r).a }" /></div>
            <div class="cmp-half cmp-half-b"><i :class="{ 'is-lead': bright(r, 'b') }" :style="{ width: pct(r).b }" /></div>
          </div>
        </div>
        <span class="cmp-tape-val cmp-tape-val-b" :class="{ 'is-lead': r.winner === 'b', 'is-trail': r.winner === 'a', 'cmp-gain': isGain(r, 'b') }">{{ formatCompareValue(r.kind, r.b) }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { HEADLINE_GROUPS, barShare, roundsWon, formatCompareValue } from '@/utils/compare'

const props = defineProps({
  rows: { type: Array, required: true },
  nameA: { type: String, required: true },
  nameB: { type: String, required: true },
})

const score = computed(() => roundsWon(props.rows))
const groups = computed(() => HEADLINE_GROUPS.map((g) => ({ title: g.title, rows: g.keys.map((k) => props.rows.find((r) => r.key === k)).filter(Boolean) })))
// A bar is bright for the leader, and for both sides of a tie or when only one side has data, so only a real
// loser is dimmed.
// XP and level gains always use the site's gain green, whoever is ahead.
const isGain = (r, side) => (r.kind === 'xp' || r.kind === 'levels') && r[side] > 0
const bright = (r, side) => r.winner === side || (r.winner == null && Number(r[side]) > 0)
// A non-zero bar is never thinner than a few percent, so a small value still shows up.
const pct = (r) => {
  const s = barShare(r)
  const f = (v) => (v > 0 ? `${Math.max(v * 100, 4)}%` : '0%')
  return { a: f(s.a), b: f(s.b) }
}
</script>
