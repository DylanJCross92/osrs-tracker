<template>
  <section class="card dash-card" aria-labelledby="dash-ms-h">
    <header class="dash-card-head">
      <h2 id="dash-ms-h">Recent milestones</h2>
      <RouterLink v-if="to" class="dash-more" :to="to">All achievements →</RouterLink>
    </header>
    <p v-if="!events.length" class="dash-empty">Nothing new yet. Level-ups, achievements and records show up here as you earn them.</p>
    <ul v-else class="dm-list">
      <li v-for="e in events" :key="e.id" class="dm-item" :class="`is-${e.kind}`">
        <span class="dm-ico">
          <img v-if="e.skill" :src="skillIconSrc(e.skill)" alt="" width="22" height="22" />
          <svg v-else-if="e.kind === 'record'" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in RECORD_ICONS.trophy" :key="d" :d="d" /></svg>
          <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7z" /></svg>
        </span>
        <span class="dm-text">
          <b>{{ e.title }}</b>
          <small>{{ e.detail }}<template v-if="e.detail"> · </template>{{ whenText(e.at) }}</small>
        </span>
        <span v-if="e.cheers" class="dm-cheers" :title="`${e.cheers} congratulation${e.cheers === 1 ? '' : 's'}`">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12 21s-7-4.6-9.3-9.1C1.1 8.7 3 5 6.4 5c2 0 3.4 1.1 4.2 2.4h2.8C14.2 6.1 15.6 5 17.6 5 21 5 22.9 8.7 21.3 11.9 19 16.4 12 21 12 21z" /></svg>{{ e.cheers }}
        </span>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { whenText } from '@/utils/dashboard'
import { skillIconSrc } from '@/utils/osrsSkills'
import { RECORD_ICONS } from '@/utils/recordText'

// From recentMilestones(): [{ id, kind, skill, title, detail, at, cheers }]; `to` opens the full list.
defineProps({ events: { type: Array, required: true }, to: { type: Object, default: null } })
</script>
