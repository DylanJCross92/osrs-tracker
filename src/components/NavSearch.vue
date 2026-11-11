<template>
  <div ref="rootEl" class="nav-search suggest-wrap" role="search">
    <label class="nav-search-field">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
      <input
        ref="inputEl"
        v-model="query"
        type="text"
        placeholder="Search players"
        aria-label="Search players"
        autocomplete="off"
        name="player-search"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="search"
        maxlength="12"
        data-1p-ignore
        data-lpignore="true"
        @keydown.enter="onEnter"
        @keydown.esc="close"
        @focus="focused = true"
        @blur="focused = false"
      />
      <kbd v-if="!focused && !query" class="nav-search-key" aria-hidden="true">/</kbd>
    </label>

    <RecentPlayers v-if="focused && !query.trim()" @pick="(o) => go(o)" />
    <ul v-if="focused && (suggestions.length || showNewRow)" class="search-suggest" @mousedown.prevent>
      <li v-if="suggestions.length" class="suggest-head">Tracked players</li>
      <li v-for="sg in suggestions" :key="sg.username">
        <a href="#" class="suggest-row" @click.prevent="go(sg)"><PlayerSuggestRow :player="sg" /></a>
      </li>
      <li v-if="showNewRow" class="suggest-new">
        <span class="sg-avatar sg-avatar-new" aria-hidden="true">+</span>
        <span class="sg-main"><span class="sg-name">{{ query.trim() }}</span><small class="sg-sub" :class="{ 'suggest-new-error': addError }">{{ addError || 'Not tracked yet. Track them to see gains and history.' }}</small></span>
        <button class="disc-track-btn" type="button" :disabled="adding" @click="trackNew">{{ adding ? 'Adding…' : 'Track' }}</button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PlayerSuggestRow from '@/components/PlayerSuggestRow.vue'
import RecentPlayers from '@/components/RecentPlayers.vue'
import { recordRecent } from '@/composables/useRecentPlayers'
import { playersApi } from '@/api/players'
import { ApiError } from '@/api/client'
import { usePlayersStore } from '@/stores/players'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'

const router = useRouter()
const store = usePlayersStore()
const { showToast } = useToast()

const rootEl = ref(null)
const inputEl = ref(null)
const query = ref('')
const focused = ref(false)
const suggestions = ref([])
const searched = ref(false)
const adding = ref(false)
const addError = ref('')

let timer = null
let started = false
watch(query, (q) => {
  clearTimeout(timer)
  searched.value = false
  addError.value = ''
  const term = q.trim()
  if (term && !started) {
    started = true
    track('search_started', { source: 'nav' })
  }
  if (term.length < 2) {
    suggestions.value = []
    return
  }
  timer = setTimeout(async () => {
    try {
      const rows = await playersApi.search(term)
      if (query.value.trim() === term) {
        suggestions.value = rows
        track('player_search', { source: 'nav', username_length: term.length, matches: rows.length })
      }
    } catch {
      suggestions.value = []
    } finally {
      searched.value = true
    }
  }, 250)
})

const validName = computed(() => /^[A-Za-z0-9 _-]{1,12}$/.test(query.value.trim()))
const exactMatch = computed(() => {
  const q = query.value.trim().toLowerCase()
  return suggestions.value.find((s) => s.displayName.toLowerCase() === q || s.username.toLowerCase() === q) || null
})
// The typed name, offered for tracking right in the dropdown unless it is already tracked.
const showNewRow = computed(() => query.value.trim().length >= 2 && validName.value && searched.value && !exactMatch.value)

function close() {
  query.value = ''
  suggestions.value = []
  inputEl.value?.blur()
}

// Open a player's profile. Only names picked or typed here are remembered, same as the other search boxes.
function go(player) {
  recordRecent(player)
  track('search_suggestion_selected', { source: 'nav' })
  router.push({ name: 'playerDetail', params: { username: player.username } })
  close()
}

function onEnter() {
  if (exactMatch.value) return go(exactMatch.value)
  if (showNewRow.value && !adding.value) return trackNew()
  if (suggestions.value[0]) go(suggestions.value[0])
}

// Adds a name that isn't tracked yet (same call the homepage uses), then opens the new profile.
async function trackNew() {
  const name = query.value.trim()
  if (!validName.value || adding.value) return
  adding.value = true
  addError.value = ''
  track('player_search', { source: 'nav', username_length: name.length })
  try {
    if (!store.loaded) await store.loadPlayers()
    await store.addPlayer(name)
    const found = store.players.find((p) => p.username.toLowerCase() === name.toLowerCase())
    track('player_added', { source: 'nav', is_new_player: true, player_name: name })
    showToast(`Now tracking ${found?.displayName || name}, checking Wise Old Man for history in the background.`)
    go({ username: found?.username || name, displayName: found?.displayName || name })
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      const found = store.players.find((p) => p.username.toLowerCase() === name.toLowerCase())
      go({ username: found?.username || name, displayName: found?.displayName || name })
    } else {
      addError.value = err instanceof ApiError ? err.message : 'Could not add that player.'
      track('player_search_result', { source: 'nav', result: 'error', status: err instanceof ApiError ? err.status : 0 })
    }
  } finally {
    adding.value = false
  }
}

// Press "/" anywhere (outside a text field) to jump to the search.
function onSlash(e) {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
  const el = document.activeElement
  if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
  e.preventDefault()
  inputEl.value?.focus()
}
onMounted(() => document.addEventListener('keydown', onSlash))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onSlash)
  clearTimeout(timer)
})
</script>
