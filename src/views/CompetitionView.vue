<template>
  <div class="clan cmt">
    <p v-if="loading" class="dash-loading">Loading the competition…</p>

    <section v-else-if="notFound" class="card clan-empty">
      <h1>Competition not found</h1>
      <p>That competition does not exist, or the link is wrong.</p>
      <RouterLink class="btn btn-primary" :to="{ name: 'clans' }">See clans</RouterLink>
    </section>

    <template v-else-if="data">
      <header class="card cmt-hero" :class="`is-${c.status}`">
        <div class="cmt-hero-top">
          <RouterLink class="cmt-clan" :to="{ name: 'clan', params: { slug: c.clan.slug } }">{{ c.clan.name }}</RouterLink>
          <span class="cmt-pill-status" :class="`is-${c.status}`"><i aria-hidden="true" />{{ statusLabel }}</span>
        </div>

        <div class="cmt-hero-main">
          <span class="cmt-hero-icon" aria-hidden="true">
            <img :src="skillIconSrc(c.metric === 'overall_xp' ? 'Overall' : c.skill)" alt="" width="40" height="40" />
          </span>
          <div class="cmt-hero-title">
            <h1>{{ c.title }}</h1>
            <p>
              <span class="cmt-tag">{{ metricLabel }}</span>
              <span class="cmt-tag">{{ data.entrants }} {{ data.entrants === 1 ? 'member' : 'members' }}</span>
              <span class="cmt-tag">{{ lengthLabel }}</span>
            </p>
          </div>
          <button v-if="data.viewer.canManage && isOpen" class="btn btn-ghost cmt-cancel" type="button" :disabled="busy" @click="cancel" @blur="confirming = false">{{ confirming ? 'Press again to cancel it' : 'Cancel competition' }}</button>
        </div>

        <div class="cmt-timeline" aria-label="When the competition runs">
          <div class="cmt-tl-ends">
            <div class="cmt-tl-end">
              <span>Starts</span>
              <b>{{ dayText(c.startsAt) }}</b>
              <small>{{ timeText(c.startsAt) }}</small>
            </div>
            <div class="cmt-tl-end is-right">
              <span>{{ c.status === 'finished' || pastEnd ? 'Ended' : 'Ends' }}</span>
              <b>{{ dayText(c.endsAt) }}</b>
              <small>{{ timeText(c.endsAt) }}</small>
            </div>
          </div>
          <div class="cmt-track" role="progressbar" :aria-valuenow="Math.round(progress)" aria-valuemin="0" aria-valuemax="100" :aria-label="`${Math.round(progress)}% of the competition has passed`">
            <i :style="{ width: `${progress}%` }" />
            <span v-if="c.status === 'running' && !pastEnd" class="cmt-track-now" :style="{ left: `${progress}%` }" />
          </div>
        </div>

        <div class="cmt-count" :class="{ 'is-live': c.status === 'running' && !pastEnd }">
          <template v-if="countdown">
            <span class="cmt-count-label">{{ countdown.label }}</span>
            <span class="cmt-count-blocks">
              <span v-for="u in countdown.parts" :key="u.unit" class="cmt-count-block"><b>{{ u.value }}</b><small>{{ u.unit }}</small></span>
            </span>
          </template>
          <span v-else class="cmt-count-text">{{ clock }}</span>
        </div>
      </header>

      <!-- The result -->
      <section v-if="c.status === 'finished' && winners.length" class="card cmt-winner" aria-label="Winner">
        <span class="cmt-winner-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-for="d in RECORD_ICONS.trophy" :key="d" :d="d" /></svg></span>
        <div>
          <p class="cmt-winner-label">{{ winners.length > 1 ? 'Tied for first' : 'Winner' }}</p>
          <p class="cmt-winner-name"><template v-for="(w, i) in winners" :key="w.username"><template v-if="i">{{ i === winners.length - 1 ? ' and ' : ', ' }}</template><RouterLink :to="profileRoute(w)">{{ w.displayName }}</RouterLink></template></p>
          <p class="cmt-winner-gain">+{{ formatXp(winners[0].gain) }} XP{{ c.metric === 'skill_xp' ? ` in ${c.skill}` : '' }}</p>
        </div>
      </section>
      <section v-else-if="c.status === 'finished'" class="card cmt-winner is-none">Nobody gained any XP in this competition, so there is no winner.</section>
      <section v-else-if="c.status === 'cancelled'" class="card cmt-winner is-none">This competition was cancelled.</section>

      <!-- The standings -->
      <section class="card clan-card" aria-labelledby="cmt-board-h">
        <header class="dash-card-head">
          <h2 id="cmt-board-h">{{ c.status === 'finished' ? 'Final standings' : 'Leaderboard' }}</h2>
          <span v-if="c.status === 'running'" class="dash-hint">XP gained since {{ startText }}</span>
          <span v-else-if="c.status === 'finished'" class="dash-hint">XP gained from {{ startText }} to {{ endText }}</span>
        </header>

        <p v-if="!rows.length" class="dash-empty">Nobody is taking part.</p>
        <ol v-else class="cmt-board">
          <li v-for="r in rows" :key="r.username" class="cmt-row" :class="{ 'is-top': r.rank === 1 && r.gain > 0 && !r.pending }">
            <span class="cmt-rank" :class="`is-${Math.min(r.rank, 4)}`">{{ r.rank }}</span>
            <RouterLink class="clan-avatar" :to="profileRoute(r)" :aria-label="`Open ${r.displayName}'s profile`"><PlayerAvatar :name="r.username" /></RouterLink>
            <div class="cmt-who">
              <span class="clan-name">
                <RouterLink :to="profileRoute(r)">{{ r.displayName }}</RouterLink>
                <span v-if="r.joinedLate" class="clan-chip" title="Joined after the start; counted from when they joined">Joined late</span>
              </span>
              <span class="cmt-bar" aria-hidden="true"><i :style="{ width: barWidth(r) }" /></span>
            </div>
            <div class="cmt-score">
              <template v-if="r.pending"><small>{{ c.status === 'scheduled' ? 'Starting soon' : 'Waiting for a start' }}</small></template>
              <template v-else>
                <b :class="{ 'stat-gain': r.gain > 0 }">{{ r.gain > 0 ? `+${formatXp(r.gain)}` : '0' }}</b>
                <small v-if="r.gap > 0">{{ formatXp(r.gap) }} behind</small>
                <small v-else-if="r.gap === 0 && r.gain > 0">tied</small>
              </template>
            </div>
          </li>
        </ol>
        <p class="clan-note">{{ note }}</p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { ApiError } from '@/api/client'
import { competitionsApi } from '@/api/clans'
import { useToast } from '@/composables/useToast'
import { clockText, fullDateTime, lengthText } from '@/utils/competitionForm'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { setPageMeta } from '@/utils/pageMeta'
import { RECORD_ICONS } from '@/utils/recordText'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()

const data = ref(null)
const loading = ref(true)
const notFound = ref(false)
const busy = ref(false)
const confirming = ref(false)
const now = ref(Date.now())

async function load() {
  try {
    data.value = await competitionsApi.get(route.params.id)
    notFound.value = false
    setPageMeta({ title: data.value.competition.title, description: `${data.value.competition.title}, an XP competition in ${data.value.competition.clan.name} on TickGains.`, path: `/competitions/${route.params.id}`, noindex: true })
  } catch (err) {
    data.value = null
    notFound.value = err instanceof ApiError && err.status === 404
  } finally {
    loading.value = false
  }
}

// While it is on, the page keeps itself fresh: standings every minute, the clock every few seconds.
let poll = null
let tick = null
onMounted(() => {
  load()
  poll = setInterval(() => {
    if (data.value && ['scheduled', 'running'].includes(data.value.competition.status)) load()
  }, 60_000)
  tick = setInterval(() => (now.value = Date.now()), 15_000)
})
onBeforeUnmount(() => {
  clearInterval(poll)
  clearInterval(tick)
})

const c = computed(() => data.value.competition)
const isOpen = computed(() => ['scheduled', 'running'].includes(c.value.status))
const pastEnd = computed(() => now.value >= new Date(c.value.endsAt).getTime())
const clock = computed(() => clockText(c.value, now.value))
const statusLabel = computed(() => ({ scheduled: 'Upcoming', running: pastEnd.value ? 'Finishing up' : 'Running', finished: 'Finished', cancelled: 'Cancelled' })[c.value.status])
const metricLabel = computed(() => (c.value.metric === 'overall_xp' ? 'Overall XP' : `${c.value.skill} XP`))
const startText = computed(() => fullDateTime(c.value.startsAt))
const endText = computed(() => fullDateTime(c.value.endsAt))
const dayText = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(new Date(d).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
const timeText = (d) => new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
// How far through it is, 0 to 100.
const progress = computed(() => {
  if (c.value.status === 'finished') return 100
  const start = new Date(c.value.startsAt).getTime()
  const end = new Date(c.value.endsAt).getTime()
  if (c.value.status !== 'running' || now.value <= start) return 0
  return Math.min(Math.max(((now.value - start) / (end - start)) * 100, 0), 100)
})
// The time left to the start (before it) or to the end (while it runs), as days, hours and minutes. Null otherwise.
const countdown = computed(() => {
  const start = new Date(c.value.startsAt).getTime()
  const end = new Date(c.value.endsAt).getTime()
  let label
  let ms
  if (c.value.status === 'scheduled' || (c.value.status === 'running' && now.value < start)) [label, ms] = ['Starts in', start - now.value]
  else if (c.value.status === 'running' && now.value < end) [label, ms] = ['Ends in', end - now.value]
  else return null
  const mins = Math.max(Math.floor(ms / 60_000), 0)
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  const minutes = mins % 60
  const parts = [
    ...(days ? [{ unit: days === 1 ? 'day' : 'days', value: days }] : []),
    { unit: hours === 1 ? 'hour' : 'hours', value: hours },
    ...(days ? [] : [{ unit: minutes === 1 ? 'min' : 'mins', value: minutes }]),
  ]
  return { label, parts }
})
const lengthLabel = computed(() => lengthText(new Date(c.value.endsAt) - new Date(c.value.startsAt)))
const profileRoute = (m) => ({ name: 'playerDetail', params: { username: m.username } })

// Each row with the gap to the player above it (finished results are stored without it).
const rows = computed(() =>
  (data.value?.standings || []).map((r, i, all) => ({ ...r, gap: r.gapToAbove !== undefined ? r.gapToAbove : i === 0 ? null : all[i - 1].gain - r.gain })),
)
const winners = computed(() => rows.value.filter((r) => r.rank === 1 && r.gain > 0 && !r.pending))
const top = computed(() => Math.max(...rows.value.map((r) => r.gain), 0))
const barWidth = (r) => (top.value > 0 && !r.pending ? `${Math.max((r.gain / top.value) * 100, r.gain > 0 ? 3 : 0)}%` : '0%')

const note = computed(() => {
  if (c.value.status === 'scheduled') return 'The leaderboard starts moving once the competition begins. Everyone is measured from their XP at the start.'
  if (c.value.status === 'running') return 'Gains update each time the hiscores are checked, about once an hour. Final numbers are taken from a fresh check when it ends.'
  if (c.value.status === 'finished') return 'Final numbers were taken from a fresh hiscores check when the competition ended.'
  return ''
})

async function cancel() {
  if (!confirming.value) {
    confirming.value = true
    return
  }
  confirming.value = false
  busy.value = true
  try {
    await competitionsApi.cancel(c.value.id)
    showToast('The competition was cancelled.')
    await load()
  } catch (err) {
    showToast(err instanceof ApiError ? err.message : 'Could not cancel it, please try again.')
  } finally {
    busy.value = false
  }
}
void router
</script>
