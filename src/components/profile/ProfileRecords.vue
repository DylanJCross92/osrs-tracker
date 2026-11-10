<template>
  <section class="rec">
    <div v-if="loading" class="card"><p class="empty-hint">Loading records…</p></div>
    <div v-else-if="error" class="card"><p class="empty-hint">Could not load records right now.</p></div>

    <div v-else-if="!hero" class="card rec-empty">
      <svg class="rec-empty-icon" viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in ICONS.trophy" :key="d" :d="d" /></svg>
      <h2>The record book is empty</h2>
      <p>Records are built from the XP {{ player.displayName }} gains while tracked on TickGains. Play a session, come back, and the first records will be waiting here. Then the only goal is to beat them.</p>
    </div>

    <template v-else>
      <!-- Records being set right now -->
      <div v-if="onFire.length" class="rec-fire" role="status">
        <span class="rec-fire-dot" aria-hidden="true" />
        <b>Record day.</b>
        <span>{{ onFire.length === 1 ? 'A record is falling' : `${onFire.length} records are falling` }} right now: {{ onFire.map((r) => r.title.toLowerCase()).join(', ') }}.</span>
      </div>

      <!-- Hero: the one number to beat -->
      <div class="rec-hero" :class="{ 'is-target': target === hero.key }" :data-record="hero.key">
        <span class="rec-hero-glow" aria-hidden="true" />
        <svg class="rec-hero-trophy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in ICONS.trophy" :key="d" :d="d" /></svg>
        <div class="rec-hero-main">
        <div class="rec-hero-top">
          <span class="rec-eyebrow"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in ICONS.trophy" :key="d" :d="d" /></svg>Record book</span>
          <span v-if="hero.fresh" class="rec-new">New</span>
        </div>
        <h2 class="rec-hero-name">{{ player.displayName }}'s biggest day</h2>
        <div class="rec-hero-value" :aria-label="`${formatXp(hero.value)} XP`">
          <b class="stat-gain">{{ formatXp(shownHero) }}</b><span>XP</span>
        </div>
        <p class="rec-hero-sub">
          {{ whenText(hero) }}
          <template v-if="hero.detail"> · mostly <img :src="skillIconSrc(hero.detail.skill)" alt="" width="18" height="18" />{{ hero.detail.skill }} <b class="stat-gain">+{{ formatXp(hero.detail.xp) }}</b></template>
        </p>

        </div>

        <div class="rec-hero-side">
        <div class="rec-beat">
          <div class="rec-beat-row">
            <span>Today so far <b class="stat-gain">{{ formatXp(hero.current.value) }}</b></span>
            <span class="rec-beat-need">{{ gapText(hero) }}</span>
          </div>
          <div class="rec-bar" :class="{ full: hero.pct >= 1 }"><i :style="{ width: `${Math.max(hero.pct * 100, hero.pct > 0 ? 3 : 0)}%` }" /></div>
        </div>

        <div class="rec-hero-actions">
          <button class="btn btn-primary" type="button" @click="share(hero)"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in ICONS.share" :key="d" :d="d" /></svg>Share this record</button>
          <span class="rec-since">{{ data.trackedDays }} {{ data.trackedDays === 1 ? 'day' : 'days' }} tracked since {{ dayText(data.since, true) }}</span>
        </div>
        </div>
      </div>

      <!-- Records within striking distance -->
      <div v-if="chasing.length" class="rec-block">
        <h3 class="rec-h">Within reach</h3>
        <p class="rec-sub">These are close. A good session could break them.</p>
        <div class="rec-chase-grid">
          <article v-for="r in chasing" :key="r.key" class="rec-chase">
            <header><span class="rec-ico"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in iconFor(r)" :key="d" :d="d" /></svg></span><b>{{ r.title }}</b><span class="rec-pct">{{ Math.floor(r.pct * 100) }}%</span></header>
            <div class="rec-bar"><i :style="{ width: `${r.pct * 100}%` }" /></div>
            <p>{{ chaseText(r) }}</p>
          </article>
        </div>
      </div>

      <!-- The headline records -->
      <div v-if="others.length" class="rec-block">
        <h3 class="rec-h">Hall of records</h3>
        <div class="rec-grid">
          <article v-for="r in others" :key="r.key" class="rec-tile" :class="{ locked: r.locked, fresh: r.fresh, 'is-target': target === r.key }" :data-record="r.key">
            <span v-if="r.fresh" class="rec-new rec-tile-new">New</span>
            <header>
              <span class="rec-ico"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in iconFor(r)" :key="d" :d="d" /></svg></span>
              <h4>{{ r.title }}</h4>
            </header>
            <template v-if="r.locked">
              <p class="rec-locked">{{ r.unlockHint }}</p>
            </template>
            <template v-else>
              <div class="rec-value" :class="{ 'stat-gain': r.unit === 'xp' }">{{ valueText(r) }}<small>{{ unitText(r) }}</small></div>
              <p class="rec-when">{{ whenText(r) }}</p>
              <div v-if="r.current" class="rec-mini">
                <div class="rec-bar"><i :style="{ width: `${Math.max(r.pct * 100, r.pct > 0 ? 3 : 0)}%` }" /></div>
                <small>{{ chaseText(r) }}</small>
              </div>
              <button class="rec-share" type="button" @click="share(r)"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in ICONS.share" :key="d" :d="d" /></svg>Share</button>
            </template>
          </article>
        </div>
      </div>

      <!-- Best day in every skill -->
      <div v-if="skillRecords.length" class="rec-block">
        <h3 class="rec-h">Skill records</h3>
        <p class="rec-sub">The most XP in a single day, skill by skill.</p>
        <div class="rec-skill-grid">
          <article v-for="r in skillRecords" :key="r.key" class="rec-skill" :class="{ fresh: r.fresh, 'is-target': target === r.key }" :data-record="r.key">
            <img :src="skillIconSrc(r.skill)" :alt="r.skill" width="30" height="30" />
            <div class="rec-skill-main">
              <b>{{ r.skill }}</b>
              <span class="stat-gain">{{ formatXp(r.value) }} XP</span>
              <small>{{ whenText(r) }}</small>
            </div>
            <span v-if="r.fresh" class="rec-new rec-skill-new">New</span>
            <button class="rec-share rec-share-icon" type="button" :aria-label="`Share ${r.title}`" @click="share(r)"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in ICONS.share" :key="d" :d="d" /></svg></button>
          </article>
        </div>
      </div>
    </template>

    <RecordShareModal v-if="sharing" :username="player.username" :display-name="player.displayName" :record="sharing" @close="sharing = null" />
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { recordsApi } from '@/api/records'
import { skillIconSrc, formatXp } from '@/utils/osrsSkills'
import { formatGameDay, addGameDays } from '@/utils/gameDay'
import { track } from '@/utils/analytics'
import RecordShareModal from '@/components/profile/RecordShareModal.vue'

const props = defineProps({ player: { type: Object, required: true } })
const route = useRoute()

const ICONS = {
  trophy: ['M8 21h8M12 17v4M7 4h10v6a5 5 0 01-10 0V4z', 'M17 6h3v2a3 3 0 01-3 3', 'M7 6H4v2a3 3 0 003 3'],
  flame: ['M12 3c1 3 4 4.5 4 8.5a4 4 0 01-8 0c0-1.7.8-2.8 1.6-3.8.3 1.2 1 1.8 1.6 1.8C11 7.5 11 5 12 3z'],
  star: ['M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7z'],
  layers: ['M12 3l9 5-9 5-9-5 9-5z', 'M3 13l9 5 9-5'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M9 3v4', 'M15 3v4'],
  lock: ['M6 11h12v9H6z', 'M8 11V8a4 4 0 018 0v3'],
  share: ['M4 12v7h16v-7', 'M12 16V3', 'M7 8l5-5 5 5'],
}
const iconFor = (r) =>
  r.locked
    ? ICONS.lock
    : ({ 'best-day': ICONS.trophy, 'best-week': ICONS.calendar, 'best-month': ICONS.calendar, 'longest-streak': ICONS.flame, 'most-levels-day': ICONS.star, 'most-skills-day': ICONS.layers })[r.key] || ICONS.trophy

const loading = ref(true)
const error = ref(false)
const data = ref({ records: [], today: '', since: null, trackedDays: 0 })
const sharing = ref(null)

async function load() {
  loading.value = true
  error.value = false
  try {
    data.value = await recordsApi.get(props.player.username)
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}
watch(() => props.player.username, load, { immediate: true })

const records = computed(() => data.value.records || [])
const hero = computed(() => records.value.find((r) => r.key === 'best-day') || null)
// Records that exist first, the ones still waiting on more history after them.
const others = computed(() => records.value.filter((r) => r.group === 'headline' && r.key !== 'best-day').sort((a, b) => Number(!!a.locked) - Number(!!b.locked)))
const skillRecords = computed(() => records.value.filter((r) => r.group === 'skill'))
// Close to being broken: more than halfway there, but not yet beaten.
const chasing = computed(() =>
  records.value
    .filter((r) => !r.locked && r.key !== 'best-day' && r.current && r.pct >= 0.5 && r.pct < 1)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3),
)
// Records that are being set today.
const onFire = computed(() => records.value.filter((r) => !r.locked && r.fresh && r.end === data.value.today && r.current && r.current.value >= r.value))
const target = computed(() => (typeof route.query.record === 'string' ? route.query.record : ''))

// --- wording ---------------------------------------------------------------------------------------------------
const dayText = (key, withYear = false) => {
  if (!key) return ''
  const sameYear = key.slice(0, 4) === (data.value.today || '').slice(0, 4)
  return formatGameDay(key, { month: 'short', day: 'numeric', ...(withYear && !sameYear ? { year: 'numeric' } : {}) })
}
function whenText(r) {
  if (!r.end) return ''
  if (r.start === r.end) {
    if (r.end === data.value.today) return 'Set today'
    if (r.end === addGameDays(data.value.today, -1)) return 'Set yesterday'
    return `Set ${dayText(r.end, true)}`
  }
  return `${dayText(r.start)} to ${dayText(r.end, true)}`
}
const valueText = (r) => (r.unit === 'xp' ? formatXp(r.value) : r.value.toLocaleString('en-US'))
const unitText = (r) => ({ xp: 'XP', days: r.value === 1 ? 'day' : 'days', levels: r.value === 1 ? 'level' : 'levels', skills: 'skills' })[r.unit] || ''
// Just the distance to the record: "+468K XP to beat it".
function gapText(r) {
  const c = r.current
  if (!c) return ''
  if (c.value >= r.value) return 'Record in progress, keep going'
  const gap = r.value - c.value + 1
  return r.unit === 'xp' ? `+${formatXp(gap)} XP to beat it` : `${gap} more to beat it`
}
// How far off the record you are, in the record's own unit.
function chaseText(r) {
  const c = r.current
  if (!c) return ''
  if (c.value >= r.value) return r.key === 'longest-streak' ? 'Streak record in progress' : 'Record in progress, keep going'
  const gap = r.value - c.value + 1
  if (r.key === 'longest-streak') return `${c.value} ${c.value === 1 ? 'day' : 'days'} now, ${gap} more to beat it`
  if (r.unit === 'xp') return `${formatXp(c.value)} ${c.label}, +${formatXp(gap)} to beat it`
  return `${c.value} ${c.label}, ${gap} more to beat it`
}

// --- the big number counts up when the tab opens ---------------------------------------------------------------
const shownHero = ref(0)
let raf = 0
function countUp(to) {
  cancelAnimationFrame(raf)
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduce || typeof requestAnimationFrame === 'undefined') {
    shownHero.value = to
    return
  }
  const start = performance.now()
  const duration = 1100
  const step = (now) => {
    const t = Math.min((now - start) / duration, 1)
    shownHero.value = Math.round(to * (1 - (1 - t) ** 3))
    if (t < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}
watch(() => hero.value?.value, (v) => v != null && countUp(v), { immediate: true })
onBeforeUnmount(() => cancelAnimationFrame(raf))

// A shared link (?record=key) scrolls to its record.
watch(
  [loading, target],
  async ([isLoading, key]) => {
    if (isLoading || !key) return
    await nextTick()
    // A beat after the page settles, so the router's own scroll-to-top on arrival does not undo it. (Instant rather
    // than smooth: the jump lands the same everywhere, including browsers that throttle smooth scrolling.)
    setTimeout(() => document.querySelector(`[data-record="${key}"]`)?.scrollIntoView({ block: 'center' }), 350)
  },
  { immediate: true },
)

function share(record) {
  track('record_share_open', { record: record.key })
  sharing.value = record
}
</script>
