<template>
  <section class="hl" aria-labelledby="hl-h">
    <h2 id="hl-h" class="hl-h">Lives</h2>
    <p class="hl-lede">
      <template v-if="character.status === 'left'">This character is no longer on the Hardcore Worlds hiscores, so it has probably moved to the normal worlds.</template>
      <template v-else-if="character.resets === 0">On their first life{{ sinceText }}.</template>
      <template v-else>On life {{ character.life }}{{ sinceText }}. Started again {{ character.resets }} {{ character.resets === 1 ? 'time' : 'times' }} since we began tracking.</template>
    </p>
    <ol v-if="rows.length" class="hl-list">
      <li v-for="r in rows" :key="r.id" :class="`is-${r.kind}`">
        <span class="hl-when">{{ r.date }}</span>
        <span class="hl-what">
          <b>{{ r.title }}</b>
          <small v-if="r.detail">{{ r.detail }}</small>
        </span>
      </li>
    </ol>
    <p class="hl-note">Deaths are not on the hiscores. A reset is spotted when a skill has less XP than the last time we looked, so two deaths between checks show as one.</p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { formatRelative } from '@/utils/time'

// The history of a Hardcore Worlds character: each time it started again (a death followed by Reset), when it left (a Transfer) and when it came back.
const props = defineProps({ character: { type: Object, required: true } })

const date = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const n = (v) => (v == null ? '' : Number(v).toLocaleString('en-US'))
const best = (e) => (e.summary?.topSkills || []).map((s) => `${s.skill} ${s.level}`).join(', ')

const lastStart = computed(() => [...props.character.events].reverse().find((e) => e.kind === 'reset' || e.kind === 'joined') || null)
const sinceText = computed(() => (lastStart.value ? `, since ${date(lastStart.value.occurredAt)} (${formatRelative(lastStart.value.occurredAt)})` : ''))

const rows = computed(() =>
  [...props.character.events]
    .filter((e) => e.kind !== 'joined' || e.life > 1 || props.character.events.some((x) => x.kind === 'left'))
    .reverse()
    .map((e) => {
      if (e.kind === 'reset') {
        return { id: e.id, kind: e.kind, date: date(e.occurredAt), title: `Life ${e.life} ended at total level ${n(e.prevLevel)}`, detail: [best(e) && `Best: ${best(e)}`, e.prevXp != null ? `${n(e.prevXp)} XP` : ''].filter(Boolean).join(' · ') }
      }
      if (e.kind === 'left') return { id: e.id, kind: e.kind, date: date(e.occurredAt), title: 'Left Hardcore Worlds', detail: e.prevLevel ? `At total level ${n(e.prevLevel)}` : '' }
      return { id: e.id, kind: e.kind, date: date(e.occurredAt), title: 'Back on Hardcore Worlds', detail: e.newLevel ? `Total level ${n(e.newLevel)}` : '' }
    }),
)
</script>
