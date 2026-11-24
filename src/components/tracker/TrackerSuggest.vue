<template>
  <section class="trk-smart" :class="{ 'is-open': open }" aria-labelledby="trk-smart-h">
    <!-- One compact row that opens the suggestions: the full list below stays in view. -->
    <button class="trk-smart-head" type="button" :aria-expanded="open" aria-controls="trk-smart-body" @click="flip">
      <span class="spl-spark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z" /></svg>
      </span>
      <span class="trk-smart-title">
        <span class="trk-smart-line">
          <span class="spl-eyebrow">Picked for you <span class="beta-tag" title="Still being tuned: check a suggestion before you rely on it">Beta</span></span>
          <span id="trk-smart-h" class="trk-smart-h2">What to do next</span>
        </span>
        <span v-if="!open" class="trk-smart-peek">
          <template v-if="list.length"><b>{{ list[0].name }}</b><template v-for="s in list.slice(1, 3)" :key="s.key"> · {{ s.name }}</template><template v-if="list.length > 3"> and {{ list.length - 3 }} more</template></template>
          <template v-else>Nothing more to suggest right now</template>
        </span>
        <span v-else class="trk-smart-peek">{{ basis }}</span>
      </span>
      <span class="trk-smart-cta">{{ open ? 'Hide' : 'Show suggestions' }}
        <svg :class="{ open }" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </span>
    </button>

    <div v-if="open" id="trk-smart-body" class="trk-smart-body">
    <!-- The same name box as everywhere else on the site: recent players, typeahead of tracked players, and a name we do not know yet is added in one go. -->
    <div class="trk-who">
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
          <p v-if="loading" class="pt-hint">Reading stats…</p>
          <p v-else class="pt-hint">Optional. Add your name and quests you can start now come first. Press Enter to load a player.</p>
        </template>
      </PlannerPlayerBox>
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
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PlannerPlayerBox from '@/components/planner/PlannerPlayerBox.vue'
import { playersApi } from '@/api/players'
import { useRequirements } from '@/composables/useRequirements'
import { useTrackerPlayer } from '@/composables/useTrackerPlayer'
import { suggestNext } from '@/utils/trackerSuggestions'
import { track } from '@/utils/analytics'

// The tracker's "smart" part: the next few things worth doing, picked from what is left (see utils/trackerSuggestions.js), each with a sentence
// saying why. With a player it checks their levels; without one it still ranks, and says it cannot check levels.
defineEmits(['focus'])
const { confirmations, setQuestDone, setDiaryDone } = useRequirements()
const { player, levels, loading, error, load, clear } = useTrackerPlayer()

// Closed to start with, so the full list is in view; the choice is remembered in this browser.
const KEY = 'tickgains-tracker-smart-open'
const read = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
const open = ref(read())
function flip() {
  open.value = !open.value
  try {
    localStorage.setItem(KEY, open.value ? '1' : '0')
  } catch {
    /* storage unavailable */
  }
  track('tracker_suggestions_toggled', { open: open.value })
}

const typed = ref('')
const focused = ref(false)
const suggestions = ref([])
const submit = () => {
  suggestions.value = []
  load(typed.value, { typed: true })
}
// Typeahead among tracked players, the same as the planner's name box.
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
}
// A name picked from the list (or the recent players) loads straight away.
function pick(p) {
  suggestions.value = []
  typed.value = p.displayName || p.username
  load(typed.value, { typed: true })
}
// Leaving the box with a name typed loads it, so stats arrive without a button (unless a suggestion is about to be clicked).
function onBlur() {
  focused.value = false
  if (!player.value && typed.value.trim().length > 1 && !suggestions.value.length) setTimeout(() => !suggestions.value.length && !player.value && load(typed.value, { typed: true }), 150)
}

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
onBeforeUnmount(() => {
  clearTimeout(timer)
  clearTimeout(suggestTimer)
})

function done(s) {
  if (s.kind === 'diary') setDiaryDone(s.id, true)
  else setQuestDone(s.name, true)
  track('tracker_suggestion_done', { kind: s.kind })
}
</script>
