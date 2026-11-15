<template>
  <div class="clan-add">
    <label class="clan-add-field">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></svg>
      <input
        ref="inputEl"
        v-model="text"
        type="search"
        maxlength="12"
        placeholder="Add a member by RuneScape name"
        aria-label="Add a member by RuneScape name"
        autocomplete="off"
        data-1p-ignore
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open && (options.length > 0 || !!newName)"
        :readonly="busy"
        @focus="openList"
        @blur="closeList"
        @input="onType"
        @keydown="onKey"
      />
    </label>
    <p v-if="alreadyIn" class="clan-add-note">{{ alreadyIn }} is already in the clan.</p>
    <CompareSuggest
      v-if="open && (options.length || newName)"
      :options="options"
      :heading="heading"
      :active="hi"
      :new-name="newName"
      :adding="busy"
      :error="failed.name === newName ? failed.message : ''"
      track-label="Add"
      new-note="Not on TickGains yet, adding them to the clan will add them to the site"
      @pick="add($event.displayName)"
      @hover="hi = $event"
      @track="add(newName)"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import CompareSuggest from '@/components/compare/CompareSuggest.vue'
import { ApiError } from '@/api/client'
import { clansApi } from '@/api/clans'
import { playersApi } from '@/api/players'
import { usePlayersStore } from '@/stores/players'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'
import { highestSkill } from '@/utils/profile'

// Owner and moderator only: adds a player to the clan straight away, no request. Typing searches the players the site already
// tracks (nothing is suggested while the box is empty). A valid name nobody tracks yet can be added too, and that adds it to the site.
const props = defineProps({
  slug: { type: String, required: true },
  // The usernames already in the clan (any case), kept out of the suggestions.
  members: { type: Array, default: () => [] },
})
const emit = defineEmits(['added'])

const store = usePlayersStore()
const { showToast } = useToast()

const VALID_NAME = /^[A-Za-z0-9 _-]{1,12}$/
const inputEl = ref(null)
const text = ref('')
const open = ref(false)
const hi = ref(-1)
const found = ref([])
const searched = ref(false)
const busy = ref(false)
const failed = reactive({ name: '', message: '' })
let timer = null

const term = computed(() => text.value.trim())
// Matches start from the first letter typed (from the players already loaded); the site search takes over from two letters.
const typing = computed(() => term.value.length >= 1)
const searchable = computed(() => term.value.length >= 2)
const inClan = computed(() => new Set(props.members.map((m) => String(m).toLowerCase())))
const heading = 'Matching players'

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
const notIn = (o) => !inClan.value.has(o.username.toLowerCase())
const localMatches = computed(() => {
  const q = term.value.toLowerCase()
  return store.players
    .filter((p) => p.username.toLowerCase().includes(q) || (p.displayName || '').toLowerCase().includes(q))
    .sort((x, y) => Number(y.username.toLowerCase().startsWith(q)) - Number(x.username.toLowerCase().startsWith(q)) || x.username.localeCompare(y.username))
    .map(asOption)
})
// Nothing is suggested until something is typed.
const options = computed(() => {
  if (!open.value || !typing.value) return []
  const rows = searchable.value && searched.value ? found.value.map(asOption) : localMatches.value
  return rows.filter(notIn).slice(0, 6)
})

// A typed name that is already a member (no point suggesting it).
const alreadyIn = computed(() => {
  if (!typing.value) return ''
  const q = term.value.toLowerCase()
  const hit = props.members.find((m) => String(m).toLowerCase() === q)
  return hit ? term.value : ''
})

// A valid name the site does not track yet, offered for adding (the server adds it to the site first).
const newName = computed(() => {
  if (failed.name && failed.name.toLowerCase() === term.value.toLowerCase()) return failed.name
  if (!open.value || !searched.value || !searchable.value || alreadyIn.value) return ''
  if (!VALID_NAME.test(term.value)) return ''
  const q = term.value.toLowerCase()
  const known = found.value.some((p) => p.username.toLowerCase() === q || (p.displayName || '').toLowerCase() === q) || store.players.some((p) => p.username.toLowerCase() === q)
  return known ? '' : term.value
})

function openList() {
  open.value = true
  hi.value = -1
  if (!store.loaded) store.loadPlayers().catch(() => {})
}
function closeList() {
  setTimeout(() => (open.value = false), 150)
}
function onType() {
  // Typing always shows the matches, even if the list was closed (Escape, or an add that just finished).
  open.value = true
  hi.value = -1
  failed.name = ''
  failed.message = ''
  clearTimeout(timer)
  searched.value = false
  const q = term.value
  if (q.length < 2) {
    found.value = []
    return
  }
  timer = setTimeout(async () => {
    try {
      const rows = await playersApi.search(q)
      if (term.value === q) {
        found.value = rows
        searched.value = true
      }
    } catch {
      found.value = []
    }
  }, 200)
}

async function add(name) {
  const rsn = String(name || '').trim()
  if (!rsn || busy.value) return
  busy.value = true
  failed.name = ''
  failed.message = ''
  try {
    const res = await clansApi.addMember(props.slug, rsn)
    if (res.alreadyMember) {
      showToast(`${res.player.displayName} is already in the clan.`)
    } else {
      showToast(`${res.player.displayName} was added to the clan.`)
      track('clan_member_add', { new_to_site: !store.players.some((p) => p.username.toLowerCase() === res.player.username.toLowerCase()) })
    }
    text.value = ''
    found.value = []
    searched.value = false
    open.value = false
    // A player new to the site is now in the list too.
    store.loadPlayers().catch(() => {})
    emit('added', res)
  } catch (err) {
    failed.name = rsn
    failed.message = err instanceof ApiError && err.message ? err.message : 'Could not add that player.'
  } finally {
    busy.value = false
    // Stay in the box: after a failure the reason shows under it, and after an add the next name can be typed straight away.
    await nextTick()
    inputEl.value?.focus()
    openList()
  }
}

function onKey(e) {
  const n = options.value.length
  if (e.key === 'Escape') {
    open.value = false
  } else if (n && e.key === 'ArrowDown') {
    e.preventDefault()
    hi.value = (hi.value + 1) % n
  } else if (n && e.key === 'ArrowUp') {
    e.preventDefault()
    hi.value = (hi.value - 1 + n) % n
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (hi.value >= 0 && options.value[hi.value]) add(options.value[hi.value].displayName)
    else if (options.value.length === 1 && typing.value && options.value[0].username.toLowerCase() === term.value.toLowerCase()) add(options.value[0].displayName)
    else if (newName.value) add(newName.value)
  }
}
</script>
