<template>
  <div class="cmp-highlights">
    <section v-for="p in players" :key="p.key" class="card cmp-hl" :class="`cmp-hl-${p.key}`">
      <h3><i class="cmp-key" :class="`cmp-key-${p.key}`" />{{ p.name }}</h3>
      <ul>
        <li>
          <span class="cmp-hl-icon cmp-hl-flame" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2c1 3.2 4.5 5.2 4.5 9.3 0 1.2-.4 2.2-1 3 .1-1.6-.7-2.7-1.6-3.4.1 2.3-1.1 3.3-2.1 3.9-1.2.7-2 1.6-2 2.9 0 .4.1.8.3 1.1C7.9 18.1 6.5 16.4 6.5 14c0-3.8 3.3-5 4-8.2.4-1.5.2-2.8.9-3.8z" /><path d="M12 22c-2.5 0-4.2-1.5-4.2-3.7 0-1.2.6-2.2 1.5-2.9.2 1.8 1.3 2.7 2.7 2.7s2.4-.9 2.7-2.4c.9.7 1.5 1.7 1.5 2.6 0 2.2-1.7 3.7-4.2 3.7z" opacity=".55" /></svg></span>
          <div><span class="cmp-hl-label">Streak</span><b>{{ p.streak > 0 ? `${p.streak} day${p.streak === 1 ? '' : 's'} in a row` : 'No active streak' }}</b></div>
        </li>
        <li>
          <span class="cmp-hl-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4" /></svg></span>
          <div><span class="cmp-hl-label">Best day, last 30</span><b v-if="p.best"><span class="cmp-gain">+{{ formatXp(p.best.xp) }} XP</span> <small>{{ dayLabel(p.best.key) }}</small></b><b v-else>No XP yet</b></div>
        </li>
        <li>
          <span class="cmp-hl-icon cmp-hl-skill" aria-hidden="true"><img v-if="p.top" :src="skillIconSrc(p.top.skill)" :alt="p.top.skill" width="22" height="22" /><svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" /></svg></span>
          <div><span class="cmp-hl-label">Top skill {{ phrase }}</span><b v-if="p.top">{{ p.top.skill }} <small class="cmp-gain">+{{ formatXp(p.top.gain) }} XP</small></b><b v-else>No gains</b></div>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { skillIconSrc, formatXp } from '@/utils/osrsSkills'

const props = defineProps({
  a: { type: Object, required: true },
  b: { type: Object, required: true },
  phrase: { type: String, default: '' },
})
const players = computed(() => [
  { key: 'a', ...props.a },
  { key: 'b', ...props.b },
])
const dayLabel = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
</script>
