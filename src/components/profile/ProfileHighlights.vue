<template>
  <section v-if="rows.length" class="hl">
    <header class="hl-head">
      <h2>Highlights</h2>
      <p class="hl-sum"><b>{{ rows.length }}</b> {{ rows.length === 1 ? 'skill' : 'skills' }} at 99<template v-if="n200"> · <b>{{ n200 }}</b> at 200M XP</template></p>
    </header>

    <SkillJourneys ref="chart" :rows="rows" :min-ms="minMs" :max-ms="maxMs" :selected="selected" @select="(skill) => (selected = selected === skill ? '' : skill)" />

    <div class="hl-key" aria-hidden="true">
      <span><i class="k99">99</i> reached level 99</span>
      <span v-if="n200"><i class="k200" /> reached 200M XP</span>
    </div>

    <!-- the row you hover or pick -->
    <ul v-if="current" class="hl-now" aria-live="polite">
      <li>
        <img :src="skillIconSrc(current.skill)" alt="" width="20" height="20" />
        <b>{{ current.skill }} level 99</b>
        <span>{{ dateText(current.e99) }}</span>
        <button class="btn-text hl-share" type="button" @click="$emit('share99', current.skill)">Share</button>
      </li>
      <li v-if="current.e200">
        <img :src="skillIconSrc(current.skill)" alt="" width="20" height="20" />
        <b>{{ current.skill }} 200M XP</b>
        <span>{{ dateText(current.e200) }}</span>
      </li>
    </ul>
    <p v-else class="hl-hint">Hover or tap a skill to see when it happened. Each gold mark is a level 99, and a diamond is 200M XP.</p>

    <!-- every 99, newest first, each one shareable -->
    <div class="hl-99">
      <h3>Level 99s <small>{{ rows.length }}</small></h3>
      <ul>
        <li v-for="r in newest" :key="r.skill">
          <button class="hl-medal" type="button" :title="`Share ${r.skill} 99`" :aria-label="`Share ${r.skill} 99`" @click="$emit('share99', r.skill)">
            <img :src="skillIconSrc(r.skill)" alt="" width="16" height="16" />
            <span aria-hidden="true" />
          </button>
          <span class="hl-99-text"><b>{{ r.skill }}</b><small>{{ r.t99 == null ? 'before tracking began' : dateText(r.e99) }}</small></span>
          <button class="btn-text hl-share" type="button" @click="$emit('share99', r.skill)">Share</button>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import SkillJourneys from '@/components/profile/SkillJourneys.vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import { skillRows } from '@/utils/historyHighlights'
import { gameDay, formatGameDay } from '@/utils/gameDay'

// The big moments of a character's whole history, and only those: each skill that reached 99 (and 200M XP), when, with a way to share the 99.
const props = defineProps({
  snapshots: { type: Array, default: () => [] },
  events: { type: Array, default: () => [] }, // from skillHighlights (dated moments)
  before: { type: Array, default: () => [] }, // already reached when tracking began
})
defineEmits(['share99'])

const rows = computed(() => skillRows(props.events, props.before))
const n200 = computed(() => rows.value.filter((r) => r.e200).length)
const newest = computed(() => [...rows.value].reverse())
const minMs = computed(() => new Date(props.snapshots[0]?.capturedAt || Date.now()).getTime())
const maxMs = computed(() => new Date(props.snapshots[props.snapshots.length - 1]?.capturedAt || Date.now()).getTime())

const selected = ref('')
const chart = ref(null)
const current = computed(() => chart.value?.active || null)

function dateText(n) {
  const f = (d) => formatGameDay(gameDay(d), { month: 'short', day: 'numeric', year: 'numeric' })
  if (!n?.at) return ''
  return n.gap ? `sometime between ${formatGameDay(gameDay(n.after), { month: 'short', day: 'numeric' })} and ${f(n.at)}` : f(n.at)
}
</script>
