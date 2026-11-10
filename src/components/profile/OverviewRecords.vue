<template>
  <section class="card ov-records" aria-label="Records">
    <header class="ov-head">
      <div>
        <h2><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in RECORD_ICONS.trophy" :key="d" :d="d" /></svg>Records to beat</h2>
        <p class="ov-sub">{{ subtitle }}</p>
      </div>
      <button type="button" class="btn btn-ghost ov-all" @click="$emit('records')">All records →</button>
    </header>

    <p v-if="loading" class="empty-hint">Loading records…</p>
    <p v-else-if="!picked.length" class="empty-hint">The record book is empty for now. Records are built from the XP {{ name }} gains while tracked, so play a session and check back.</p>

    <div v-else class="ov-rec-grid">
      <button v-for="r in picked" :key="r.key" type="button" class="ov-rec" :class="{ 'is-locked': r.locked, 'is-fire': r.onFire, 'is-close': r.close }" @click="$emit('records')">
        <span v-if="r.onFire" class="ov-rec-tag is-fire">Falling now</span>
        <span v-else-if="r.close" class="ov-rec-tag">Within reach</span>
        <span class="ov-rec-ico"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in iconForRecord(r)" :key="d" :d="d" /></svg></span>
        <span class="ov-rec-title">{{ r.title }}</span>
        <template v-if="r.locked">
          <span class="ov-rec-note">{{ r.unlockHint }}</span>
        </template>
        <template v-else>
          <span class="ov-rec-value" :class="{ 'stat-gain': r.unit === 'xp' }">{{ recordValueText(r) }}<small>{{ recordUnitText(r) }}</small></span>
          <span class="ov-rec-note">{{ recordWhenText(r, today) }}</span>
          <span v-if="r.current" class="ov-rec-meter">
            <span class="ov-meter"><i :style="{ width: `${Math.max(r.pct * 100, r.pct > 0 ? 4 : 0)}%` }" /></span>
            <small>{{ recordChaseText(r) }}</small>
          </span>
        </template>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { RECORD_ICONS, iconForRecord, recordValueText, recordUnitText, recordWhenText, recordChaseText } from '@/utils/recordText'

defineEmits(['records'])
const props = defineProps({
  records: { type: Array, default: () => [] },
  today: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  name: { type: String, default: 'this player' },
})

const FEATURED = ['best-day', 'longest-streak', 'best-week']

// The three headline records, each flagged when it is being broken right now or is within striking distance.
const picked = computed(() =>
  FEATURED.map((key) => props.records.find((r) => r.key === key))
    .filter(Boolean)
    .map((r) => ({
      ...r,
      onFire: !r.locked && r.fresh && r.end === props.today && r.current && r.current.value >= r.value,
      close: !r.locked && r.key !== 'best-day' && r.current && r.pct >= 0.5 && r.pct < 1,
    })),
)

const subtitle = computed(() => {
  const fire = picked.value.find((r) => r.onFire)
  if (fire) return `${fire.title} is falling right now.`
  const close = picked.value.find((r) => r.close)
  if (close) return `${close.title} is within reach.`
  return 'The numbers to chase. A big session could break them.'
})
</script>
