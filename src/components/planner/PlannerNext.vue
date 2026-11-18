<template>
  <section v-if="model.groups.length || model.later.length" class="pn" aria-labelledby="pn-h">
    <header class="pn-head">
      <h2 id="pn-h">What's next</h2>
      <span class="dash-hint">dated at {{ hoursPerDay }} h/day</span>
    </header>

    <div class="pn-card">
      <ol v-if="model.groups.length" class="dtl" aria-label="Upcoming levels and goals by date">
        <li v-for="g in model.groups" :key="g.key" class="dtl-stop">
          <span class="dtl-dot" aria-hidden="true" />
          <div class="dtl-date">
            <b>{{ g.month }} {{ g.day }}<template v-if="g.year !== thisYear">, {{ g.year }}</template></b>
            <small>{{ g.weekday }} · {{ g.whenText }}</small>
          </div>
          <ul class="dtl-items">
            <li v-for="i in g.items" :key="i.key" class="dtl-item" :class="`dtl-${i.kind}`">
              <img :src="skillIconSrc(i.skill)" alt="" width="24" height="24" />
              <span class="dtl-text"><b>{{ i.title }}</b><small>{{ i.detail }}</small></span>
              <span class="dtl-tag">{{ i.tag }}</span>
            </li>
          </ul>
        </li>
      </ol>

      <div v-if="model.later.length" class="dlater" :class="{ first: !model.groups.length }">
        <h3 v-if="model.groups.length">Further out</h3>
        <ul>
          <li v-for="i in model.later" :key="i.key">
            <img :src="skillIconSrc(i.skill)" alt="" width="20" height="20" />
            <span><b>{{ i.title }}</b> <small>{{ i.dateText }} · {{ i.tag }}</small></span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { timelineModel } from '@/utils/dashboard'
import { skillIconSrc } from '@/utils/osrsSkills'

// The days the plan reaches its next level, its next milestone and each goal (items from planNext()).
// A plan can run for months, so the timeline looks a year ahead before anything goes to "Further out".
const props = defineProps({
  items: { type: Array, required: true },
  hoursPerDay: { type: Number, required: true },
})
const HORIZON = 365
const thisYear = new Date().getFullYear()
const model = computed(() => timelineModel(props.items, Date.now(), HORIZON))
</script>
