<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card adm-modal" role="dialog" aria-modal="true" aria-labelledby="adm-xp-h">
      <header class="share-modal-header">
        <div>
          <h2 id="adm-xp-h">XP gained on TickGains</h2>
          <p class="adm-sub">Total across every tracked player</p>
        </div>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </header>

      <ul class="adm-xp">
        <li v-for="r in rows" :key="r.key" class="adm-xp-row">
          <div class="adm-xp-label"><b>{{ r.label }}</b><small>{{ r.note }}</small></div>
          <div class="adm-xp-num">
            <b class="stat-gain">+{{ r.xp.toLocaleString('en-US') }}</b>
            <small>{{ r.players.toLocaleString('en-US') }} {{ r.players === 1 ? 'player' : 'players' }} gained<template v-if="r.perDay"> · about {{ formatXp(r.perDay) }} a day</template></small>
          </div>
        </li>
      </ul>
      <p class="adm-foot">Worked out from the saved hiscores of every tracked player. The last day runs from 6 AM to 6 AM Eastern.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { formatXp } from '@/utils/osrsSkills'

// For admins: the XP gained across the whole site over the last day, 7 days and 30 days, from the players Discover already has.
const props = defineProps({ players: { type: Array, required: true } })
const emit = defineEmits(['close'])

const PERIODS = [
  { key: 'day', label: 'Last day', note: 'since 6 AM Eastern', days: 1 },
  { key: 'week', label: '7 days', note: 'the last week', days: 7 },
  { key: 'month', label: '30 days', note: 'the last month', days: 30 },
]
const rows = computed(() =>
  PERIODS.map((p) => {
    let xp = 0
    let players = 0
    for (const player of props.players) {
      const gain = player.gains?.[p.key]?.xp
      if (gain > 0) {
        xp += gain
        players++
      }
    }
    // A day's total is part of a day, so an average per day only makes sense for the longer windows.
    return { ...p, xp, players, perDay: p.days > 1 ? Math.round(xp / p.days) : 0 }
  }),
)

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
