<template>
  <div class="calc-lookup">
    <div v-if="player && !editing" class="calc-lookup-loaded">
      <b>{{ player.displayName }}</b>
      <span>{{ skill }} level {{ level }} · {{ formatNum(xp) }} XP</span>
      <span class="calc-muted">Stats updated {{ formatRelative(player.latest.capturedAt) }}</span>
      <button class="btn-text" type="button" @click="editing = true">Change player</button>
      <button class="btn-text" type="button" @click="clear">Clear</button>
    </div>
    <div v-else class="suggest-wrap">
      <form class="add-player-form" autocomplete="off" @submit.prevent="find">
        <input v-model="name" type="search" name="osrs-player-lookup" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="OSRS name (optional)" autocomplete="off" maxlength="12" :disabled="loading" aria-label="OSRS player name" data-1p-ignore data-lpignore="true" @focus="searchFocused = true" @blur="searchFocused = false" />
        <button class="btn btn-primary" type="submit" :disabled="loading || !name.trim()">{{ loading ? 'Finding…' : 'Load my stats' }}</button>
        <button v-if="player" class="btn btn-ghost" type="button" @click="editing = false">Cancel</button>
      </form>
      <RecentPlayers v-if="searchFocused && !name.trim()" @pick="pick" />
      <ul v-if="suggestions.length" class="search-suggest">
        <li class="suggest-head">Already tracked</li>
        <li v-for="sg in suggestions" :key="sg.username">
          <a href="#" class="suggest-row" @click.prevent="pick(sg)"><PlayerSuggestRow :player="sg" /></a>
        </li>
      </ul>
      <p v-if="error" class="planner-error">{{ error }} You can still enter your XP by hand.</p>
      
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { usePlayersStore } from '@/stores/players'
import { playersApi } from '@/api/players'
import PlayerSuggestRow from '@/components/PlayerSuggestRow.vue'
import RecentPlayers from '@/components/RecentPlayers.vue'
import { recordRecent } from '@/composables/useRecentPlayers'
import { track } from '@/utils/analytics'
import { formatRelative } from '@/utils/time'
import { levelAtXp, formatNum } from '@/utils/planner'

const props = defineProps({ skill: { type: String, required: true } })
const emit = defineEmits(['loaded', 'cleared'])

const store = usePlayersStore()
const name = ref('')
const player = ref(null)
const editing = ref(false)
const loading = ref(false)
const error = ref('')
const searchFocused = ref(false)

const xp = computed(() => (props.skill === 'Overall' ? player.value?.latest?.overallXp : player.value?.latest?.skills?.[props.skill]?.xp) ?? 0)
const level = computed(() => levelAtXp(xp.value, true))

// Typeahead among already-tracked players.
const suggestions = ref([])
let timer = null
watch(name, (q) => {
  clearTimeout(timer)
  const term = (q || '').trim()
  if (term.length < 2) {
    suggestions.value = []
    return
  }
  timer = setTimeout(async () => {
    try {
      const rows = await playersApi.search(term)
      if ((name.value || '').trim() === term) suggestions.value = rows
    } catch {
      suggestions.value = []
    }
  }, 250)
})

function pick(sg) {
  suggestions.value = []
  name.value = sg.displayName
  find()
}

async function find() {
  suggestions.value = []
  const rsn = name.value.trim()
  if (!rsn) return
  if (!/^[A-Za-z0-9 _-]{1,12}$/.test(rsn)) {
    error.value = 'Usernames are 1 to 12 characters: letters, numbers, spaces, hyphens or underscores.'
    return
  }
  loading.value = true
  error.value = ''
  track('calc_lookup', { skill: props.skill })
  try {
    if (!store.loaded) await store.loadPlayers()
    const lookup = () => store.players.find((p) => p.username.toLowerCase() === rsn.toLowerCase())
    // Unknown names go through the normal tracking flow (Hiscores lookup and history import).
    if (!lookup()) {
      await store.addPlayer(rsn)
      track('player_added', { source: 'calculator', is_new_player: true, player_name: rsn })
    }
    const found = lookup()
    if (!found?.latest) throw new Error('No stats found for that player yet.')
    player.value = found
    recordRecent(found)
    name.value = found.displayName
    editing.value = false
    emit('loaded', found)
  } catch (err) {
    error.value = err?.message || 'Could not find that player on the OSRS Hiscores.'
  } finally {
    loading.value = false
  }
}

function clear() {
  player.value = null
  name.value = ''
  emit('cleared')
}

defineExpose({ player })
</script>
