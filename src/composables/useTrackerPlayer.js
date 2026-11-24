import { computed, ref } from 'vue'
import { usePlayersStore } from '@/stores/players'
import { useRivals } from '@/composables/useRivals'
import { SKILL_NAMES } from '@/utils/osrsSkills'
import { recordRecent } from '@/composables/useRecentPlayers'
import { track } from '@/utils/analytics'

// The player the quest and diary tracker tailors its suggestions to: levels from their tracked stats, so it can say "you can start this now" and
// "you are 3 Mining short". Optional (the tracker works without), remembered in this browser, and defaulting to the player the visitor said is theirs.
const KEY = 'tickgains-tracker-player'
const read = () => {
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}
const write = (v) => {
  try {
    if (v) localStorage.setItem(KEY, v)
    else localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}

const name = ref('')
const player = ref(null)
const loading = ref(false)
const error = ref('')
let started = false

export function useTrackerPlayer() {
  const store = usePlayersStore()
  const { me } = useRivals()

  async function load(raw, { typed = false } = {}) {
    const wanted = String(raw || '').trim()
    if (!wanted) return
    if (!/^[A-Za-z0-9 _-]{1,12}$/.test(wanted)) {
      error.value = 'Usernames are 1 to 12 characters: letters, numbers, spaces, hyphens or underscores.'
      return
    }
    loading.value = true
    error.value = ''
    try {
      if (!store.loaded) await store.loadPlayers()
      const find = () => store.players.find((p) => p.username.toLowerCase() === wanted.toLowerCase())
      // Players we do not know yet are added through the normal tracking flow (a hiscores lookup), the same as searching for them anywhere else.
      if (!find()) await store.addPlayer(wanted)
      const found = find()
      if (!found?.latest) throw new Error('No stats found for that player yet.')
      player.value = found
      name.value = found.displayName
      write(found.displayName)
      if (typed) {
        recordRecent(found)
        track('tracker_player_loaded')
      }
    } catch (err) {
      error.value = err?.message || 'Could not find that player on the OSRS Hiscores.'
    } finally {
      loading.value = false
    }
  }
  function clear() {
    player.value = null
    name.value = ''
    error.value = ''
    write('')
  }
  // First use on a page: the name saved here, else the visitor's own player.
  if (!started) {
    started = true
    const start = read() || me.value
    if (start) load(start)
  }

  const levels = computed(() => {
    const skills = player.value?.latest?.skills
    if (!skills) return null
    const out = {}
    for (const s of SKILL_NAMES) if (Number.isFinite(skills[s]?.level)) out[s] = skills[s].level
    return Object.keys(out).length ? out : null
  })
  // Their total XP in each skill, to work out the levels a reward would give.
  const xp = computed(() => {
    const skills = player.value?.latest?.skills
    if (!skills) return null
    const out = {}
    for (const s of SKILL_NAMES) if (Number.isFinite(skills[s]?.xp)) out[s] = skills[s].xp
    return Object.keys(out).length ? out : null
  })
  return { player, name, loading, error, levels, xp, load, clear }
}
