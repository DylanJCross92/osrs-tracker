<template>
  <div class="cj">
    <div v-if="done" class="cj-done" role="status">
      <span class="cj-done-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg></span>
      <div>
        <b>{{ done.status === 'member' ? (done.alreadyMember ? `${done.player.displayName} is already in ${done.name}.` : `${done.player.displayName} is in ${done.name}.`) : (done.alreadyRequested ? 'Your request is already waiting.' : 'Request sent.') }}</b>
        <p v-if="done.status === 'pending'">{{ done.player.displayName }} joins {{ done.name }} once its owner or a moderator approves it. Nothing else to do.</p>
        <p v-else-if="instant">You are in this week's race. Your XP counts from the moment you joined.</p>
      </div>
    </div>

    <template v-else>
      <PlannerPlayerBox
        v-model:username="typed"
        :player="player"
        :editing="false"
        :looking-up="loading"
        :lookup-error="error"
        :suggestions="suggestions"
        :show-recent="focused && !typed.trim()"
        @submit="submit"
        @change="change"
        @pick="pick"
        @focus="focused = true"
        @blur="onBlur"
      >
        <template #hint>
          <p v-if="loading" class="pt-hint">Loading stats…</p>
          <p v-else-if="player && !alreadyIn" class="pt-hint">{{ instant ? 'Join with this player.' : 'Ask to join with this player.' }}</p>
          <p v-else-if="player" class="pt-hint">Change the name to enter someone else.</p>
          <p v-else class="pt-hint">Enter your RuneScape name. Press Enter to load it.</p>
        </template>
      </PlannerPlayerBox>
      <p v-if="problem" class="auth-error" role="alert">{{ problem }}</p>
      <p v-if="alreadyIn" class="cj-in" role="status">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
        <span><b>{{ player.displayName }}</b> {{ instant ? 'is in this week\'s race.' : 'is already in this clan.' }}</span>
      </p>
      <button v-else class="btn btn-primary cj-go" type="button" :disabled="busy || !player" @click="send">{{ busy ? 'Sending…' : instant ? 'Join the race' : 'Ask to join' }}</button>
      <p v-if="!instant && !alreadyIn" class="cj-note">The clan's owner or a moderator approves every request. No account needed.</p>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PlannerPlayerBox from '@/components/planner/PlannerPlayerBox.vue'
import { ApiError } from '@/api/client'
import { clansApi } from '@/api/clans'
import { playersApi } from '@/api/players'
import { useTrackerPlayer } from '@/composables/useTrackerPlayer'
import { track } from '@/utils/analytics'

// Asking to join a clan from its page or the Clans page: the site's usual name box (typeahead, recent players, a new name added in one go),
// then one button. `instant` is for a clan that lets everyone in (the weekly race), where there is no approval to wait for.
const props = defineProps({
  slug: { type: String, required: true },
  instant: { type: Boolean, default: false },
  from: { type: String, default: 'clan_page' },
  // Lower case names already in the clan, so a player who is in is told so instead of being asked to join again.
  members: { type: Array, default: () => [] },
})
const emit = defineEmits(['joined'])

const { player, loading, error, load, clear } = useTrackerPlayer()
const typed = ref('')
const focused = ref(false)
const suggestions = ref([])
const busy = ref(false)
const problem = ref('')
// Set once it went through: { status, name, player, alreadyMember, alreadyRequested }.
const done = ref(null)
const alreadyIn = computed(() => Boolean(player.value && props.members.includes(player.value.username.toLowerCase())))

const submit = () => {
  suggestions.value = []
  load(typed.value, { typed: true })
}
let suggestTimer = null
watch(typed, (q) => {
  clearTimeout(suggestTimer)
  const term = (q || '').trim()
  if (term.length < 2 || (player.value && term.toLowerCase() === player.value.displayName.toLowerCase())) {
    suggestions.value = []
    return
  }
  suggestTimer = setTimeout(async () => {
    try {
      const rows = await playersApi.search(term)
      if ((typed.value || '').trim() === term) suggestions.value = rows
    } catch {
      suggestions.value = []
    }
  }, 250)
})
function change() {
  clear()
  typed.value = ''
  problem.value = ''
}
function pick(p) {
  suggestions.value = []
  typed.value = p.displayName || p.username
  load(typed.value, { typed: true })
}
function onBlur() {
  focused.value = false
  if (!player.value && typed.value.trim().length > 1 && !suggestions.value.length) setTimeout(() => !suggestions.value.length && !player.value && load(typed.value, { typed: true }), 150)
}
onBeforeUnmount(() => clearTimeout(suggestTimer))

async function send() {
  if (busy.value || !player.value) return
  busy.value = true
  problem.value = ''
  try {
    const res = await clansApi.request(props.slug, player.value.username)
    track('clan_join_request', { status: res.status, verified: res.verified, from: props.from })
    done.value = res
    if (res.status === 'member') emit('joined', res)
  } catch (err) {
    problem.value = err instanceof ApiError ? err.message : 'Something went wrong, please try again.'
  } finally {
    busy.value = false
  }
}
</script>
