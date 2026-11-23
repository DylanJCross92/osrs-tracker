<template>
  <section class="card dash-card" aria-labelledby="dash-next-h">
    <header class="dash-card-head">
      <h2 id="dash-next-h">What's next</h2>
      <span class="dash-hint">by your average over the last 7 full days</span>
    </header>

    <p v-if="!items.length" class="dash-empty">Train for a few days and your next level-ups and 99s show up here, with the day they should land.</p>

    <template v-else>
      <ol v-if="model.groups.length" class="dtl" aria-label="Upcoming goals by date">
        <li v-for="g in model.groups" :key="g.key" class="dtl-stop">
          <span class="dtl-dot" aria-hidden="true" />
          <div class="dtl-date">
            <b>{{ g.month }} {{ g.day }}</b>
            <small>{{ g.weekday }} · {{ g.whenText }}</small>
          </div>
          <ul class="dtl-items">
            <li v-for="i in g.items" :key="i.key" class="dtl-item">
              <img v-if="i.skill" :src="skillIconSrc(i.skill)" alt="" width="24" height="24" />
              <svg v-else class="dtl-star" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7z" /></svg>
              <span class="dtl-text"><b>{{ i.title }}</b><small>{{ i.detail }}</small></span>
            </li>
          </ul>
        </li>
      </ol>

      <div v-if="model.later.length" class="dlater">
        <h3>Further out</h3>
        <ul>
          <li v-for="i in model.later" :key="i.key">
            <img v-if="i.skill" :src="skillIconSrc(i.skill)" alt="" width="20" height="20" />
            <svg v-else class="dtl-star" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7z" /></svg>
            <span><b>{{ i.title }}</b> <small>{{ i.detail }}<template v-if="i.eta"> · {{ i.eta }}</template></small></span>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { timelineModel } from '@/utils/dashboard'
import { skillIconSrc } from '@/utils/osrsSkills'

// From whatsNext(): [{ key, skill, title, detail, eta, etaDays, pct }].
const props = defineProps({ items: { type: Array, required: true } })
const model = computed(() => timelineModel(props.items))
</script>
