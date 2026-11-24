<template>
  <section class="trk-smart" aria-labelledby="trk-smart-h">
    <header class="trk-smart-head">
      <span class="spl-spark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z" /></svg>
      </span>
      <div class="trk-smart-title">
        <span class="spl-eyebrow">Picked for you <span class="beta-tag" title="Still being tuned: check a suggestion before you rely on it">Beta</span></span>
        <h2 id="trk-smart-h">What to do next</h2>
        <p>{{ basis }}</p>
      </div>
    </header>

    <div class="trk-who">
      <template v-if="player">
        <span class="trk-who-chip"><span class="trk-avatar"><PlayerAvatar :name="player.username" /></span> Tailored to <b>{{ player.displayName }}</b> <i>Overall {{ player.latest.overallLevel.toLocaleString('en-US') }}</i></span>
        <button class="btn-text" type="button" @click="clear">Change</button>
      </template>
      <form v-else class="trk-who-form" autocomplete="off" @submit.prevent="submit">
        <label for="trk-who-in">Your OSRS name <small>(optional)</small></label>
        <span class="trk-who-row">
          <input id="trk-who-in" v-model="typed" type="search" name="osrs-player-lookup" placeholder="e.g. Zezima" maxlength="12" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" :disabled="loading" data-1p-ignore data-lpignore="true" />
          <button class="btn btn-primary" type="submit" :disabled="loading || typed.trim().length < 1">{{ loading ? 'Reading your stats…' : 'Tailor to my levels' }}</button>
        </span>
        <small v-if="error" class="trk-who-error">{{ error }}</small>
        <small v-else class="trk-who-hint">Checks your levels so quests you can start now come first. Nothing is saved to the site except your name in this browser.</small>
      </form>
    </div>

    <div v-if="thinking" class="trk-think" aria-live="polite" aria-label="Working out what to suggest">
      <i v-for="n in 3" :key="n" class="spl-skel" :style="{ '--d': `${n * 120}ms` }" />
    </div>
    <ol v-else-if="list.length" class="trk-picks">
      <li v-for="(s, i) in list" :key="s.key" class="trk-pick" :class="[`is-${s.status}`, { first: i === 0 }]" :style="{ '--i': i }">
        <span class="trk-rank" aria-hidden="true">{{ i + 1 }}</span>
        <div class="trk-pick-main">
          <p class="trk-pick-title">
            <b>{{ s.name }}</b>
            <i class="trk-kind" :class="`is-${s.kind}`">{{ s.kind === 'diary' ? 'Diary' : 'Quest' }}</i>
            <i v-if="i === 0" class="trk-best">Best next step</i>
          </p>
          <p class="trk-pick-why">{{ s.why }}</p>
          <p class="trk-pick-note"><span aria-hidden="true">{{ s.status === 'ready' ? '✓' : s.status === 'almost' ? '↗' : '•' }}</span> {{ s.note }}<template v-if="s.meta"> <em>· {{ s.meta }}</em></template></p>
        </div>
        <div class="trk-pick-actions">
          <button class="btn" :class="{ 'btn-primary': i === 0 }" type="button" :title="`Mark ${s.name} as done`" @click="done(s)">I have done this</button>
          <button class="btn-text" type="button" @click="$emit('focus', s)">Details</button>
        </div>
      </li>
    </ol>
    <p v-else class="trk-picks-none">Nothing more to suggest right now. {{ levels ? 'What is left needs more levels first.' : 'Everything with its prerequisites done is ticked off.' }} Browse the full list below.</p>

    <p class="trk-smart-foot">
      Ranked by what each one opens in the planner, the XP it gives and how long it takes.
      <template v-if="!levels">Without your levels these cannot be checked against what you can do yet.</template>
    </p>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { useRequirements } from '@/composables/useRequirements'
import { useTrackerPlayer } from '@/composables/useTrackerPlayer'
import { suggestNext } from '@/utils/trackerSuggestions'
import { track } from '@/utils/analytics'

// The tracker's "smart" part: the next few things worth doing, picked from what is left (see utils/trackerSuggestions.js), each with a sentence
// saying why. With a player it checks their levels; without one it still ranks, and says it cannot check levels.
defineEmits(['focus'])
const { confirmations, setQuestDone, setDiaryDone } = useRequirements()
const { player, levels, loading, error, load, clear } = useTrackerPlayer()

const typed = ref('')
const submit = () => load(typed.value, { typed: true })

const list = computed(() => suggestNext(confirmations.value, levels.value))
const basis = computed(() => (levels.value ? 'Quests and diaries you can start now, ranked by what they open up in the planner.' : 'The most useful quests and diaries left, ranked by what they open up in the planner.'))

// A short "thinking" beat when the page opens and when the player changes, like the Smart Planner.
const thinking = ref(true)
let timer = null
function think() {
  thinking.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (thinking.value = false), 450)
}
think()
watch(levels, think)
onBeforeUnmount(() => clearTimeout(timer))

function done(s) {
  if (s.kind === 'diary') setDiaryDone(s.id, true)
  else setQuestDone(s.name, true)
  track('tracker_suggestion_done', { kind: s.kind })
}
</script>
