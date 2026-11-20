<template>
  <section class="st-card fi" aria-labelledby="fi-title">
    <div class="st-card-head"><h2 id="fi-title">What the numbers say</h2><span class="st-hint">{{ people(cohort) }} in this view</span></div>
    <ul v-if="items.length" class="fi-list">
      <li v-for="(it, i) in shown" :key="i" class="fi-item" :class="`is-${it.kind}`">
        <span class="fi-icon" aria-hidden="true">{{ ICONS[it.kind] }}</span>
        <div>
          <b>{{ it.title }}</b>
          <p>{{ it.text }}</p>
        </div>
      </li>
    </ul>
    <button v-if="items.length > LIMIT" type="button" class="fi-more" @click="showAll = !showAll">{{ showAll ? 'Show fewer' : `Show ${items.length - LIMIT} more` }}</button>
    <p v-if="!items.length" class="st-empty">Nothing stands out yet.</p>
    <details class="fi-help">
      <summary>How to read these numbers</summary>
      <dl>
        <dt>Funnel steps</dt>
        <dd>Counted in sequence. A person is counted at a step only if they also got through every step before it, in that order. Each bar is a share of everyone at the start.</dd>
        <dt>"Did it at all"</dt>
        <dd>The faint bar counts everyone who did that one thing, whenever and however they got there. It can be longer than the solid bar, because some people skip ahead. The two are never the same number, and the gap is the people who skipped.</dd>
        <dt>Carried on, lost</dt>
        <dd>Carried on is the share of the step before who reached this one. Lost is how many did not. The biggest drop is where the most people were lost.</dd>
        <dt>User flow</dt>
        <dd>Each person is counted once in each column, in the part of the site they were in at that step. "Left the site" means no more pages were recorded for them. Branches are the paths people really took.</dd>
        <dt>Typical time</dt>
        <dd>The median: half of the people took less, half took more.</dd>
        <dt>Small sample</dt>
        <dd>Fewer than {{ MIN_STEP }} people reached the step before, or fewer than {{ MIN_COHORT }} are in the view. A single person can move the percentages a lot.</dd>
      </dl>
    </details>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { fmt } from './statsFormat'

const props = defineProps({
  insights: { type: Array, default: () => [] },
  funnelKey: { type: String, default: '' },
  cohort: { type: Number, default: 0 },
})

const people = (n) => `${fmt(n)} ${n === 1 ? 'person' : 'people'}`
const MIN_STEP = 10
const MIN_COHORT = 30
const ICONS = { warning: '!', drop: '↓', win: '✓', pattern: '◆' }
// What is true for everyone (warnings, the flow), and what concerns the funnel being looked at.
const LIMIT = 4
const showAll = ref(false)
const items = computed(() => props.insights.filter((i) => !i.funnel || i.funnel === props.funnelKey))
const shown = computed(() => (showAll.value ? items.value : items.value.slice(0, LIMIT)))
</script>
