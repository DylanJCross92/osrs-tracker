<template>
  <section class="pn" aria-labelledby="pn-h">
    <div v-if="first" class="pn-card">
      <div class="pn-kicker"><span id="pn-h">What to train next</span></div>
      <div class="pn-main">
        <img class="pn-ico" :src="skillIconSrc(first.skill)" :alt="first.skill" width="44" height="44" />
        <div class="pn-what">
          <b>{{ first.skill }} <em>{{ first.seg.startLevel }} → {{ first.seg.endLevel }}</em></b>
          <span><img v-if="icon" class="route-ico" :src="icon" alt="" width="20" height="20" />{{ first.seg.method ? first.seg.method.name : 'No catalog method for these levels' }}</span>
        </div>
        <dl class="pn-meta">
          <div><dt>XP</dt><dd>{{ formatNum(first.seg.xp) }}</dd></div>
          <div><dt>Time</dt><dd>{{ formatHours(first.hours) }}</dd></div>
          <div v-if="first.seg.netGp != null"><dt>{{ first.seg.netGp >= 0 ? 'Profit' : 'Cost' }}</dt><dd :class="first.seg.netGp >= 0 ? 'planner-gain' : 'planner-cost'">{{ formatGp(first.seg.netGp) }}</dd></div>
        </dl>
      </div>
      <p v-if="then.length" class="pn-then">
        <span>Then</span>
        <template v-for="(s, k) in then" :key="s.id">
          <span class="pn-then-step"><img :src="skillIconSrc(s.skill)" alt="" width="16" height="16" />{{ s.skill }} {{ s.seg.startLevel }} → {{ s.seg.endLevel }}</span>
          <i v-if="k < then.length - 1" aria-hidden="true">›</i>
        </template>
      </p>
      <div class="pn-actions">
        <button class="btn btn-primary" type="button" @click="$emit('open-goal', first.goalIndex)">Open {{ first.skill }} goal</button>
        <button class="btn btn-ghost" type="button" @click="$emit('see-route')">See the route</button>
      </div>
    </div>
    <div v-else class="pn-card pn-done" role="status">
      <div class="pn-kicker"><span id="pn-h">What to train next</span></div>
      <p><b>Every goal is already reached.</b> Add a new goal or pick a recommended plan to keep going.</p>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import { methodIconSrc } from '@/data/methodIcons'
import { formatGp, formatHours, formatNum } from '@/utils/planner'

const props = defineProps({
  // The training steps in order (see utils/planSteps.js).
  steps: { type: Array, required: true },
})
defineEmits(['open-goal', 'see-route'])

const first = computed(() => props.steps[0] || null)
const icon = computed(() => methodIconSrc(first.value?.seg.method))
const then = computed(() => props.steps.slice(1, 3))
</script>
