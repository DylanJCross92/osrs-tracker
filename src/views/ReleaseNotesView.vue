<template>
  <article class="rn">
    <header class="rn-head">
      <h1>Release notes</h1>
      <p>What is new on TickGains, day by day. Only days with something to report are listed.</p>
      <div class="rn-filters" role="group" aria-label="Show">
        <button v-for="f in filters" :key="f.key" type="button" :class="{ on: kind === f.key }" :aria-pressed="kind === f.key" @click="kind = f.key">
          {{ f.label }}<small>{{ f.count }}</small>
        </button>
      </div>
    </header>

    <section v-for="d in shown" :key="d.date" class="rn-day" :aria-labelledby="`rn-${d.date}`">
      <h2 :id="`rn-${d.date}`"><time :datetime="d.date">{{ dayText(d.date) }}</time><small>{{ yearText(d.date) }}</small></h2>
      <ul>
        <li v-for="(it, i) in d.items" :key="i">
          <span class="rn-tag" :class="`is-${it.kind}`">{{ KINDS[it.kind] }}</span>
          <span class="rn-text">{{ it.text }}</span>
        </li>
      </ul>
    </section>
    <p v-if="!shown.length" class="rn-none">Nothing of that kind yet.</p>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue'
import { KINDS, RELEASE_NOTES } from '@/data/releaseNotes'
import { setPageMeta } from '@/utils/pageMeta'

setPageMeta({
  title: 'Release Notes: What\'s New on TickGains',
  description: 'Everything new on TickGains, day by day: new features, improvements and bug fixes for the OSRS XP tracker, account planner, Smart Planner, Discover and clans.',
  path: '/release-notes',
})

const kind = ref('all')
const count = (k) => RELEASE_NOTES.reduce((n, d) => n + d.items.filter((i) => k === 'all' || i.kind === k).length, 0)
const filters = computed(() => [{ key: 'all', label: 'Everything' }, ...Object.entries(KINDS).map(([key, label]) => ({ key, label }))].map((f) => ({ ...f, count: count(f.key) })))
// Days with something of the chosen kind, with just those lines.
const shown = computed(() =>
  RELEASE_NOTES.map((d) => ({ ...d, items: d.items.filter((i) => kind.value === 'all' || i.kind === kind.value) })).filter((d) => d.items.length),
)

const asDate = (iso) => new Date(`${iso}T12:00:00Z`)
const dayText = (iso) => asDate(iso).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'long', day: 'numeric' })
const yearText = (iso) => asDate(iso).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric' })
</script>
