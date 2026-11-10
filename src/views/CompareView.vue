<template>
  <div class="cmp">
    <section class="card cmp-intro" :class="{ 'is-compact': hasNames }">
      <p v-if="challenger" class="cmp-challenge" role="status">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in SWORDS" :key="d" :d="d" /></svg>
        <span><b>{{ challenger }}</b> challenged you. {{ hasNames ? 'Here is how the week stacks up.' : 'Enter your RSN to see who gained more this week.' }}</span>
      </p>
      <h1>Compare OSRS players</h1>
      <p class="cmp-sub">Put two accounts side by side: XP gained, levels, rank movement and how consistently each one trains.</p>
      <form class="cmp-form" @submit.prevent="submit">
        <label class="cmp-field cmp-field-a">
          <i class="cmp-key cmp-key-a" aria-hidden="true" />
          <input ref="elA" v-model="inputA" type="text" maxlength="12" placeholder="Player one" aria-label="First player" autocomplete="off" name="rsn-one" role="combobox" :aria-expanded="focused === 'a' && options.length > 0" @focus="openList('a')" @blur="closeList('a')" @input="typed.a = true" @keydown="onKey('a', $event)" />
          <CompareSuggest v-if="focused === 'a' && options.length" :options="options" :heading="heading" :active="hi" @pick="pick('a', $event)" @hover="hi = $event" @remove="removeRecentPlayer" />
        </label>
        <button type="button" class="cmp-swap" aria-label="Swap the two players" title="Swap players" @click="swapInputs">
          <span class="cmp-swap-vs">VS</span>
          <svg class="cmp-swap-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h12l-3-3M17 17H5l3 3" /></svg>
        </button>
        <label class="cmp-field cmp-field-b">
          <i class="cmp-key cmp-key-b" aria-hidden="true" />
          <input ref="elB" v-model="inputB" type="text" maxlength="12" placeholder="Player two" aria-label="Second player" autocomplete="off" name="rsn-two" role="combobox" :aria-expanded="focused === 'b' && options.length > 0" @focus="openList('b')" @blur="closeList('b')" @input="typed.b = true" @keydown="onKey('b', $event)" />
          <CompareSuggest v-if="focused === 'b' && options.length" :options="options" :heading="heading" :active="hi" class="cmp-suggest-right" @pick="pick('b', $event)" @hover="hi = $event" @remove="removeRecentPlayer" />
        </label>
        <button class="btn btn-primary cmp-go" type="submit" :disabled="!canSubmit">Compare</button>
      </form>

      <div v-if="hasNames" class="cmp-period range-tabs" role="group" aria-label="Gain period">
        <button v-for="p in PERIODS" :key="p.key" type="button" :class="{ active: period === p.key }" @click="period = p.key">{{ p.label }}</button>
      </div>

      <div v-if="rivals.length" class="cmp-rivals">
        <span class="cmp-rivals-label">Your rivals{{ me ? ` vs ${me}` : '' }}</span>
        <span v-for="r in rivals" :key="r" class="cmp-rival">
          <RouterLink :to="rivalLink(r)">{{ r }}</RouterLink>
          <button type="button" :aria-label="`Remove ${r} from your rivals`" @click="removeRival(r)">×</button>
        </span>
      </div>
      <p v-else-if="!hasNames" class="cmp-hint">Save a player as a rival after comparing and they will show up here next time. Rivals are kept in this browser only.</p>

      <div v-if="!hasNames && suggestedPairs.length" class="cmp-rivals">
        <span class="cmp-rivals-label">Try a matchup</span>
        <RouterLink v-for="p in suggestedPairs" :key="p.a + p.b" class="cmp-pair" :to="pairLink(p.a, p.b)">{{ p.a }} <span>vs</span> {{ p.b }}</RouterLink>
      </div>
    </section>

    <template v-if="hasNames">
      <div v-if="sideA.status === 'loading' || sideB.status === 'loading'" class="card"><p class="empty-hint">Loading both players…</p></div>

      <template v-else>
        <section v-for="s in missingSides" :key="s.key" class="card cmp-missing">
          <p><b>{{ s.name }}</b> {{ s.status === 'empty' ? 'has no history yet.' : "isn't being tracked yet." }}</p>
          <button v-if="s.status === 'untracked'" class="btn btn-primary" :disabled="tracking === s.key" @click="startTracking(s.key)">
            {{ tracking === s.key ? 'Adding…' : `Start tracking ${s.name}` }}
          </button>
          <p v-else class="cmp-hint">Check back after the next hourly update.</p>
        </section>

        <template v-if="ready">
          <section class="card cmp-head">
            <div class="cmp-head-grid">
              <div v-for="s in [sideA, sideB]" :key="s.key" class="cmp-player" :class="{ 'is-lead': leader === s.key }">
                <span class="cmp-avatar" aria-hidden="true"><PlayerAvatar :name="s.player.username" /></span>
                <RouterLink class="cmp-name" :to="{ name: 'playerDetail', params: { username: s.player.username } }">{{ s.player.displayName }}</RouterLink>
                <span class="cmp-meta">Overall {{ s.latest.overallLevel.toLocaleString('en-US') }} · {{ formatXp(s.latest.overallXp) }} XP</span>
                <span v-if="leader === s.key" class="cmp-crown">Ahead {{ periodPhrase }}</span>
              </div>
              <span class="cmp-vs cmp-vs-big" aria-hidden="true">vs</span>
            </div>
            <div class="cmp-verdict">
              <p class="cmp-sr">{{ verdict }}</p>
              <div class="cmp-vd" aria-hidden="true">
                <div class="cmp-vd-nums">
                  <span class="cmp-vd-side cmp-vd-a" :class="{ 'is-lead': gainRow.winner === 'a' }"><b :class="{ 'cmp-gain': gainRow.a > 0 }">{{ formatSignedXp(gainRow.a) }}</b><small>XP {{ periodPhrase }}</small></span>
                  <span class="cmp-vd-mid" :class="gainRow.winner ? `is-${gainRow.winner}` : ''">
                    <template v-if="gainRow.winner">{{ gainRow.winner === 'a' ? '◀ ' : '' }}{{ formatXp(gainDiff) }} lead{{ gainRow.winner === 'b' ? ' ▶' : '' }}</template>
                    <template v-else>{{ gainRow.a || gainRow.b ? 'Dead heat' : 'No XP yet' }}</template>
                  </span>
                  <span class="cmp-vd-side cmp-vd-b" :class="{ 'is-lead': gainRow.winner === 'b' }"><b :class="{ 'cmp-gain': gainRow.b > 0 }">{{ formatSignedXp(gainRow.b) }}</b><small>XP {{ periodPhrase }}</small></span>
                </div>
                <div class="cmp-vd-bar" :class="{ 'is-empty': !shareTotal }">
                  <i class="cmp-vd-seg cmp-vd-seg-a" :class="{ 'is-lead': gainRow.winner === 'a' }" :style="{ flexGrow: shareTotal ? gainRow.a : 1 }"><span v-if="pctA >= 12">{{ pctA }}%</span></i>
                  <i class="cmp-vd-seg cmp-vd-seg-b" :class="{ 'is-lead': gainRow.winner === 'b' }" :style="{ flexGrow: shareTotal ? gainRow.b : 1 }"><span v-if="100 - pctA >= 12">{{ 100 - pctA }}%</span></i>
                </div>
                <div class="cmp-vd-skills">
                  <span class="cmp-vd-skills-label">Skills led <b class="cmp-tip-a">{{ leads.a }}</b> <em>:</em> <b class="cmp-tip-b">{{ leads.b }}</b></span>
                  <div class="cmp-pips">
                    <span v-for="r in skillPips" :key="r.skill" class="cmp-pip" :class="`cmp-pip-${r.winner || 'none'}`" :title="pipTitle(r)"><img :src="skillIconSrc(r.skill)" :alt="r.skill" width="18" height="18" /></span>
                  </div>
                </div>
              </div>
            </div>
            <div class="cmp-actions">
              <button class="btn btn-ghost" @click="copyLink">Copy link</button>
              <RouterLink class="btn btn-ghost" :to="pairLink(sideB.player.username, sideA.player.username)">Swap</RouterLink>
              <button v-if="!isMe(sideA.player.username)" class="btn btn-ghost" @click="iAm(sideA.player.displayName)">I am {{ sideA.player.displayName }}</button>
              <button v-if="!isMe(sideB.player.username)" class="btn btn-ghost" @click="toggleRival(sideB.player.displayName)">{{ isRival(sideB.player.username) ? `Remove ${sideB.player.displayName} as rival` : `Save ${sideB.player.displayName} as rival` }}</button>
            </div>
          </section>

          <CompareTape :rows="headline" :name-a="sideA.player.displayName" :name-b="sideB.player.displayName" />

          <CompareHighlights :a="highlightA" :b="highlightB" :phrase="periodPhrase" />

          <section class="card">
            <div class="chart-header"><h2>Daily XP, last {{ daysA.length }} days</h2></div>
            <CompareDays :days-a="daysA" :days-b="daysB" :name-a="sideA.player.displayName" :name-b="sideB.player.displayName" />
          </section>

          <CompareSkills :rows="skillRows" :name-a="sideA.player.displayName" :name-b="sideB.player.displayName" :phrase="periodPhrase" />
        </template>
      </template>
    </template>
  </div>
</template>

<script setup>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayersStore } from '@/stores/players'
import { useToast } from '@/composables/useToast'
import { useGainPeriod } from '@/composables/useGainPeriod'
import { useRivals } from '@/composables/useRivals'
import { ApiError } from '@/api/client'
import { skillIconSrc, formatXp, formatSignedXp } from '@/utils/osrsSkills'
import { highestSkill } from '@/utils/profile'
import { trackedSnapshots, dailyXp, compareSkills, compareHeadline, skillLeads, topGainSkill, bestDay } from '@/utils/compare'
import { setPageMeta } from '@/utils/pageMeta'
import { track } from '@/utils/analytics'
import CompareSuggest from '@/components/compare/CompareSuggest.vue'
import { useRecentPlayers, recordRecent } from '@/composables/useRecentPlayers'
import { playersApi } from '@/api/players'
import CompareDays from '@/components/compare/CompareDays.vue'
import CompareTape from '@/components/compare/CompareTape.vue'
import CompareHighlights from '@/components/compare/CompareHighlights.vue'
import CompareSkills from '@/components/compare/CompareSkills.vue'

const route = useRoute()
const router = useRouter()
const store = usePlayersStore()
const { showToast } = useToast()
const { period } = useGainPeriod()
const { me, rivals, isMe, isRival, setMe, addRival, removeRival } = useRivals()

const PERIODS = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: '7 days' },
  { key: 'month', label: '30 days' },
]
const PHRASE = { day: 'today', week: 'in the last 7 days', month: 'in the last 30 days' }
const periodPhrase = computed(() => PHRASE[period.value])

const nameA = computed(() => String(route.params.a || '').trim())
const nameB = computed(() => String(route.params.b || '').trim())
const hasNames = computed(() => !!(nameA.value && nameB.value))

// Arriving from a friend's challenge link: they are filled in as player two and your own box is next.
const fromChallenge = computed(() => route.query.from === 'challenge')
const challenger = computed(() => (fromChallenge.value ? String(route.query.vs || nameB.value || '').trim() : ''))
const SWORDS = ['M14.5 17.5L3 6V3h3l11.5 11.5', 'M13 19l6-6', 'M16 16l4 4', 'M19 21l2-2', 'M14.5 6.5L18 3h3v3l-3.5 3.5', 'M5 14l4 4', 'M7 17l-3 3', 'M3 19l2 2']

const inputA = ref(nameA.value || me.value || '')
const inputB = ref(nameB.value || String(route.query.vs || ''))
const canSubmit = computed(() => {
  const a = inputA.value.trim()
  const b = inputB.value.trim()
  return !!a && !!b && a.toLowerCase() !== b.toLowerCase()
})

// The challenge is about the week, so open on the 7-day view. If the link came without your name, start in your box.
if (fromChallenge.value) period.value = 'week'
watch(() => route.query.vs, (v) => {
  if (v && !hasNames.value) inputB.value = String(v)
})
onMounted(() => {
  if (fromChallenge.value && !hasNames.value && !inputA.value) nextTick(() => elA.value?.focus())
})

// --- player suggestions ---------------------------------------------------------------------------------------------
// Empty box: recommend the biggest recent gainers. Typing: match tracked players by name as you go.
const elA = ref(null)
const elB = ref(null)
const focused = ref('')
const hi = ref(-1)
const found = ref([])
let searchTimer = null
const inputOf = (k) => (k === 'a' ? inputA : inputB)
const termOf = (k) => inputOf(k).value.trim()
const otherName = (k) => (k === 'a' ? inputB : inputA).value.trim().toLowerCase()
const asOption = (p) => {
  const tracked = store.players.find((x) => x.username.toLowerCase() === p.username.toLowerCase())
  return {
    username: p.username,
    displayName: p.displayName || p.username,
    badge: p.badge ?? tracked?.badge ?? null,
    overallLevel: p.overallLevel ?? tracked?.latest?.overallLevel ?? null,
    overallXp: p.overallXp ?? tracked?.latest?.overallXp ?? null,
    topSkill: p.topSkill ?? (tracked?.latest ? highestSkill(tracked.latest)?.skill : null) ?? null,
    weekGain: p.weekGain ?? tracked?.gains?.week?.xp ?? 0,
  }
}
const recommended = computed(() =>
  [...store.players]
    .filter((p) => p.gains?.week?.xp > 0)
    .sort((x, y) => y.gains.week.xp - x.gains.week.xp)
    .map(asOption),
)
const typing = computed(() => !!focused.value && termOf(focused.value).length >= 2)
const { options: recentOptions, remove: removeRecentPlayer } = useRecentPlayers()
const options = computed(() => {
  if (!focused.value) return []
  const skip = otherName(focused.value)
  const ok = (o) => o.username.toLowerCase() !== skip
  if (typing.value) return found.value.map(asOption).filter(ok).slice(0, 6)
  // Empty box: your recent players first, then the biggest recent gainers to fill the list.
  const recents = recentOptions.value.filter(ok)
  const seen = new Set(recents.map((o) => o.username.toLowerCase()))
  const rest = recommended.value.filter((o) => ok(o) && !seen.has(o.username.toLowerCase()))
  return [...recents, ...rest].slice(0, 6)
})
const heading = computed(() => (typing.value ? 'Matching players' : 'Recommended players'))

function openList(k) {
  focused.value = k
  hi.value = -1
  if (!store.loaded) store.loadPlayers().catch(() => {})
}
function closeList(k) {
  setTimeout(() => {
    if (focused.value === k) focused.value = ''
  }, 120)
}
function onType(k) {
  if (focused.value !== k) return
  hi.value = -1
  clearTimeout(searchTimer)
  const term = termOf(k)
  if (term.length < 2) {
    found.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    try {
      const rows = await playersApi.search(term)
      if (focused.value === k && termOf(k) === term) found.value = rows
    } catch {
      found.value = []
    }
  }, 200)
}
watch(inputA, () => onType('a'))
watch(inputB, () => onType('b'))

// Only names typed into a box (or picked from the search results / recent list) count as searches, a link to a
// matchup or a recommended pick does not. `input` events come from the keyboard only, never from picking.
const typed = { a: false, b: false }
function pick(k, o) {
  if (typing.value || o.recent) recordRecent(o)
  typed[k] = false
  inputOf(k).value = o.displayName
  found.value = []
  focused.value = ''
  track('compare_suggestion_selected', { side: k, source: typing.value ? 'search' : o.recent ? 'recent' : 'recommended' })
  // Move on to the other box when it is still empty, so picking two players takes two taps.
  const next = k === 'a' ? elB : elA
  if (!inputOf(k === 'a' ? 'b' : 'a').value.trim()) next.value?.focus()
}
function onKey(k, e) {
  const n = options.value.length
  if (e.key === 'Escape') {
    focused.value = ''
  } else if (n && e.key === 'ArrowDown') {
    e.preventDefault()
    hi.value = (hi.value + 1) % n
  } else if (n && e.key === 'ArrowUp') {
    e.preventDefault()
    hi.value = (hi.value - 1 + n) % n
  } else if (e.key === 'Enter' && hi.value >= 0 && options.value[hi.value]) {
    e.preventDefault()
    pick(k, options.value[hi.value])
  }
}

const enc = encodeURIComponent
const pairLink = (a, b) => `/compare/${enc(a)}/${enc(b)}`
const rivalLink = (r) => (me.value && me.value.toLowerCase() !== r.toLowerCase() ? pairLink(me.value, r) : `/compare/${enc(r)}`)

function swapInputs() {
  const a = inputA.value
  inputA.value = inputB.value
  inputB.value = a
}

function submit() {
  if (!canSubmit.value) return
  track('compare_submit', { source: 'form' })
  // Close any open suggestion list, the results are what you want to see.
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  for (const k of ['a', 'b']) {
    if (!typed[k]) continue
    const hit = store.players.find((x) => x.username.toLowerCase() === termOf(k).toLowerCase())
    if (hit) recordRecent(hit)
    typed[k] = false
  }
  router.push({ path: pairLink(inputA.value.trim(), inputB.value.trim()), query: fromChallenge.value ? { from: 'challenge' } : {} })
}

// A few real matchups for first-time visitors: the biggest recent gainers, paired off.
const suggestedPairs = computed(() => {
  const top = [...store.players]
    .filter((p) => p.gains?.week?.xp > 0)
    .sort((x, y) => y.gains.week.xp - x.gains.week.xp)
    .slice(0, 6)
  const pairs = []
  for (let i = 0; i + 1 < top.length; i += 2) pairs.push({ a: top[i].displayName, b: top[i + 1].displayName })
  return pairs
})

// --- loading both sides -------------------------------------------------------------------------------------------
const emptySide = (key) => ({ key, name: '', status: 'idle', player: null, snaps: [], tracked: [], latest: null, top: null })
const sideA = reactive(emptySide('a'))
const sideB = reactive(emptySide('b'))
const sideOf = (key) => (key === 'a' ? sideA : sideB)
const tracking = ref('')
let runId = 0

const findPlayer = (name) => store.players.find((p) => p.username.toLowerCase() === name.toLowerCase()) ?? null

function applySnapshots(side, snaps) {
  side.snaps = snaps
  side.tracked = trackedSnapshots(side.player, snaps)
  side.latest = snaps[snaps.length - 1] ?? null
  side.top = side.latest ? highestSkill(side.latest) : null
  side.status = side.latest ? 'ready' : 'empty'
}

async function loadSide(key, name, id) {
  const side = sideOf(key)
  Object.assign(side, emptySide(key), { name, status: 'loading' })
  const player = findPlayer(name)
  if (!player) {
    side.status = 'untracked'
    return
  }
  side.player = player
  try {
    applySnapshots(side, await store.fetchSnapshots(player.id))
  } catch {
    side.status = 'untracked'
    showToast(`Could not load ${name}.`)
    return
  }
  // Pick up anything new from the hiscores after the saved data is already showing, like the profile page does.
  try {
    await store.refreshPlayer(player.id)
    if (id !== runId) return
    side.player = findPlayer(name) || side.player
    applySnapshots(side, await store.fetchSnapshots(player.id))
  } catch {
    // Non-fatal, the saved data is already on screen.
  }
}

async function loadBoth() {
  const id = ++runId
  if (!hasNames.value) {
    Object.assign(sideA, emptySide('a'))
    Object.assign(sideB, emptySide('b'))
    if (!store.loaded) store.loadPlayers().catch(() => {})
    return
  }
  if (!store.loaded) await store.loadPlayers().catch(() => {})
  await Promise.all([loadSide('a', nameA.value, id), loadSide('b', nameB.value, id)])
  if (id === runId) track('compare_view', { both_tracked: sideA.status === 'ready' && sideB.status === 'ready' })
}

watch(
  [nameA, nameB],
  () => {
    inputA.value = nameA.value || inputA.value
    inputB.value = nameB.value || String(route.query.vs || '')
    loadBoth()
  },
  { immediate: true },
)

watch(
  [nameA, nameB, () => sideA.player?.displayName, () => sideB.player?.displayName],
  () => {
    const a = sideA.player?.displayName || nameA.value
    const b = sideB.player?.displayName || nameB.value
    if (a && b) {
      setPageMeta({
        title: `${a} vs ${b} | OSRS XP Comparison`,
        description: `Compare ${a} and ${b} in Old School RuneScape: XP gained, levels, rank movement and training consistency, side by side on TickGains.`,
        path: pairLink(a, b),
      })
    } else {
      setPageMeta({
        title: 'Compare OSRS Players',
        description: 'Compare two Old School RuneScape players side by side: XP gained, levels, rank movement and how consistently each one trains.',
        path: '/compare',
      })
    }
  },
  { immediate: true },
)

async function startTracking(key) {
  const side = sideOf(key)
  tracking.value = key
  track('compare_start_tracking')
  try {
    await store.addPlayer(side.name)
    showToast(`Now tracking ${side.name}, history is importing in the background.`)
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 409)) {
      showToast(err instanceof ApiError ? err.message : 'Could not add that player.')
      tracking.value = ''
      return
    }
  }
  tracking.value = ''
  await loadSide(key, side.name, runId)
}

const missingSides = computed(() => [sideA, sideB].filter((s) => s.status === 'untracked' || s.status === 'empty'))
const ready = computed(() => sideA.status === 'ready' && sideB.status === 'ready')

// --- results ------------------------------------------------------------------------------------------------------
const headline = computed(() => (ready.value ? compareHeadline(sideA.tracked, sideB.tracked, sideA.latest, sideB.latest, period.value) : []))
const skillRows = computed(() => (ready.value ? compareSkills(sideA.tracked, sideB.tracked, sideA.latest, sideB.latest, period.value) : []))
const leads = computed(() => skillLeads(skillRows.value))
// Two weeks of days, minus any run of empty days at the start (a newly tracked player has no data before they were
// added), but never fewer than a week so the chart keeps its shape.
const days = computed(() => {
  if (!ready.value) return { a: [], b: [] }
  const a = dailyXp(sideA.tracked, 14)
  const b = dailyXp(sideB.tracked, 14)
  let start = 0
  while (start < a.length - 7 && a[start].xp === 0 && b[start].xp === 0) start++
  return { a: a.slice(start), b: b.slice(start) }
})
const daysA = computed(() => days.value.a)
const daysB = computed(() => days.value.b)

// The overall gain row drives the split bar; the 24 skill rows (Overall left out) drive the skill pips.
const gainRow = computed(() => headline.value.find((r) => r.key === 'gain') || { a: 0, b: 0, winner: null })
const gainDiff = computed(() => Math.abs(gainRow.value.a - gainRow.value.b))
const shareTotal = computed(() => Math.max(gainRow.value.a, 0) + Math.max(gainRow.value.b, 0))
const pctA = computed(() => (shareTotal.value ? Math.round((Math.max(gainRow.value.a, 0) / shareTotal.value) * 100) : 50))
const skillPips = computed(() => skillRows.value.filter((r) => r.skill !== 'Overall'))
function pipTitle(r) {
  const gain = (g) => (g > 0 ? `+${formatXp(g)}` : 'no gain')
  return `${r.skill}: ${sideA.player.displayName} ${gain(r.a.gain)}, ${sideB.player.displayName} ${gain(r.b.gain)}`
}

const leader = computed(() => headline.value.find((r) => r.key === 'gain')?.winner || null)
const verdict = computed(() => {
  if (!ready.value) return ''
  const row = headline.value.find((r) => r.key === 'gain')
  const nameOf = (k) => (k === 'a' ? sideA.player.displayName : sideB.player.displayName)
  if (!row.a && !row.b) return `Neither player has gained XP ${periodPhrase.value}.`
  if (!row.winner) return `Dead heat: both players gained ${formatXp(row.a)} XP ${periodPhrase.value}.`
  const w = row.winner
  const other = w === 'a' ? 'b' : 'a'
  const diff = Math.abs(row.a - row.b)
  return `${nameOf(w)} gained ${formatXp(diff)} more XP than ${nameOf(other)} ${periodPhrase.value}, and leads in ${leads.value[w]} of 24 skills.`
})


const streakOf = (k) => headline.value.find((r) => r.key === 'streak')?.[k] ?? 0
const highlightFor = (side, key) => ({
  name: side.player.displayName,
  streak: streakOf(key),
  best: bestDay(side.tracked, 30),
  top: topGainSkill(skillRows.value, key),
})
const highlightA = computed(() => (ready.value ? highlightFor(sideA, 'a') : { name: '', streak: 0, best: null, top: null }))
const highlightB = computed(() => (ready.value ? highlightFor(sideB, 'b') : { name: '', streak: 0, best: null, top: null }))

// --- actions ------------------------------------------------------------------------------------------------------
async function copyLink() {
  track('compare_share_copy')
  try {
    await navigator.clipboard.writeText(window.location.href)
    showToast('Link copied.')
  } catch {
    showToast('Could not copy, copy the address bar instead.')
  }
}
function iAm(name) {
  setMe(name)
  showToast(`Saved ${name} as you, rivals will compare against them.`)
  track('compare_set_me')
}
function toggleRival(name) {
  if (isRival(name)) {
    removeRival(name)
    showToast(`Removed ${name} from your rivals.`)
    return
  }
  if (addRival(name)) {
    showToast(`Saved ${name} as a rival.`)
    track('compare_rival_save')
  } else {
    showToast('You can keep up to 10 rivals, remove one first.')
  }
}
</script>
